const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const websocket = require('@fastify/websocket');
const { PrismaClient } = require('@prisma/client');
const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const OpenAI = require('openai');

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Redis connection for BullMQ
const redis = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
});

// Task queue
const taskQueue = new Queue('agent-tasks', { connection: redis });

// Connected WebSocket clients (founder dashboards)
const clients = new Set();

// Register plugins
fastify.register(cors, { origin: true });
fastify.register(websocket);

// Competitor Intelligence Agent Logic
const CompetitorIntelligenceAgent = {
  async discoverCompetitors(workspaceId, productDescription) {
    // Use OpenAI to identify potential competitors
    const prompt = `Given this product description: "${productDescription}"
    
Identify the top 10 most relevant competitors. For each, provide:
1. Company name
2. Website URL
3. One-sentence description of what they do
4. Their pricing model (if known)
5. Their key differentiator

Format as JSON array: [{"name": "...", "website": "...", "description": "...", "pricing": "...", "differentiator": "..."}]`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a competitive intelligence expert. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
    });

    try {
      const competitors = JSON.parse(completion.choices[0].message.content);
      return competitors;
    } catch (e) {
      // If JSON parsing fails, extract competitors manually
      return this.parseCompetitorResponse(completion.choices[0].message.content);
    }
  },

  async analyzeCompetitor(competitorId) {
    const competitor = await prisma.competitor.findUnique({
      where: { id: competitorId }
    });

    if (!competitor) throw new Error('Competitor not found');

    // In production, this would scrape the website
    // For MVP, use OpenAI to analyze based on known info
    const prompt = `Analyze this competitor:
Name: ${competitor.name}
Website: ${competitor.website}
Description: ${competitor.description || 'N/A'}

Provide a comprehensive analysis including:
1. Target customer segment
2. Key features and capabilities
3. Pricing strategy analysis
4. Market positioning
5. Strengths and weaknesses
6. Threat level (low/medium/high)
7. Opportunities for differentiation

Format as JSON: {"targetCustomer": "...", "keyFeatures": [...], "pricingStrategy": "...", "positioning": "...", "strengths": [...], "weaknesses": [...], "threatLevel": "...", "opportunities": [...]}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a competitive intelligence analyst. Provide detailed, actionable analysis.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
    });

    try {
      return JSON.parse(completion.choices[0].message.content);
    } catch (e) {
      return { raw: completion.choices[0].message.content };
    }
  },

  parseCompetitorResponse(content) {
    // Fallback parsing if JSON fails
    const lines = content.split('\n').filter(l => l.trim());
    const competitors = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^\d+\./) || line.includes('http')) {
        const name = line.replace(/^\d+\.\s*/, '').split(' - ')[0].trim();
        const website = line.match(/https?:\/\/[^\s]+/)?.[0] || '';
        if (name && website) {
          competitors.push({ name, website, description: '', pricing: '', differentiator: '' });
        }
      }
    }
    
    return competitors;
  }
};

// API Routes

// Create task for competitor discovery
fastify.post('/api/workspaces/:workspaceId/competitors/discover', async (request, reply) => {
  const { workspaceId } = request.params;
  const { productDescription } = request.body;

  // Create a task that requires approval
  const task = await prisma.task.create({
    data: {
      workspaceId,
      agentId: 'competitor-intelligence',
      type: 'discover_competitors',
      status: 'pending',
      input: { productDescription },
      requiresApproval: true,
      approvalPrompt: `I'll identify the top 10 competitors for: "${productDescription}". Ready to analyze the competitive landscape?`,
    }
  });

  // Broadcast to connected clients
  clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({
        type: 'task_created',
        data: task
      }));
    }
  });

  return { taskId: task.id, message: 'Task created, awaiting approval' };
});

// Approve task and execute
fastify.post('/api/tasks/:taskId/approve', async (request, reply) => {
  const { taskId } = request.params;
  const { userId } = request.body;

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: 'in_progress',
      approvedAt: new Date(),
      approvedBy: userId,
    }
  });

  // Execute based on task type
  if (task.type === 'discover_competitors') {
    const competitors = await CompetitorIntelligenceAgent.discoverCompetitors(
      task.workspaceId,
      task.input.productDescription
    );

    // Store discovered competitors
    for (const comp of competitors) {
      await prisma.competitor.create({
        data: {
          workspaceId: task.workspaceId,
          name: comp.name,
          website: comp.website,
          description: comp.description,
          pricing: comp.pricing ? { model: comp.pricing } : null,
        }
      });
    }

    // Create analysis task for each competitor
    for (const comp of competitors.slice(0, 3)) { // Analyze top 3
      await prisma.task.create({
        data: {
          workspaceId: task.workspaceId,
          agentId: 'competitor-intelligence',
          type: 'analyze_competitor',
          status: 'pending',
          input: { competitorName: comp.name },
          requiresApproval: true,
          approvalPrompt: `Should I perform deep analysis on ${comp.name}?`,
        }
      });
    }

    // Mark task complete
    await prisma.task.update({
      where: { id: taskId },
      data: { 
        status: 'completed',
        output: { competitorsDiscovered: competitors.length }
      }
    });

    // Broadcast results
    clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          type: 'competitors_discovered',
          data: { taskId, competitors }
        }));
      }
    });

    return { success: true, competitorsDiscovered: competitors.length };
  }

  return { success: true };
});

// Get workspace data
fastify.get('/api/workspaces/:workspaceId', async (request, reply) => {
  const { workspaceId } = request.params;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      competitors: true,
      tasks: {
        orderBy: { createdAt: 'desc' },
        take: 20
      },
      analyses: {
        orderBy: { createdAt: 'desc' },
        take: 10
      },
      alerts: {
        where: { read: false },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  return workspace;
});

// WebSocket for real-time updates
fastify.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    clients.add(connection.socket);
    
    connection.socket.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'subscribe' && data.workspaceId) {
          // Subscribe to workspace updates
          connection.socket.workspaceId = data.workspaceId;
        }
      } catch (e) {
        console.error('WebSocket message error:', e);
      }
    });

    connection.socket.on('close', () => {
      clients.delete(connection.socket);
    });
  });
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log('🚀 Foundry backend running on http://localhost:3001');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
