const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const websocket = require('@fastify/websocket');
const OpenAI = require('openai');

// Check for OpenAI API key
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not set!');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory storage (replace with PostgreSQL in production)
const storage = {
  messages: [],
  tasks: [],
  competitors: [],
  analyses: [],
  alerts: [],
  workspaces: [{ id: 'demo-workspace', name: 'Demo Workspace', ownerId: 'founder-1', createdAt: new Date() }]
};

// Connected WebSocket clients
const clients = new Set();

// Register plugins
fastify.register(cors, { 
  origin: ['https://foundry-nine-pi.vercel.app', 'https://*.vercel.app', 'http://localhost:3000'],
  credentials: true
});
fastify.register(websocket);

// Health check
fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Competitor Intelligence Agent
const CompetitorIntelligenceAgent = {
  async discoverCompetitors(workspaceId, productDescription) {
    const prompt = `Given this product description: "${productDescription}"
    
Identify the top 10 most relevant competitors. For each, provide:
1. Company name
2. Website URL  
3. One-sentence description
4. Pricing model (if known)
5. Key differentiator

Respond ONLY with valid JSON array.`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Faster, cheaper
        messages: [
          { role: 'system', content: 'You are a competitive intelligence expert. Respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = completion.choices[0].message.content;
      
      // Try to parse JSON
      try {
        const competitors = JSON.parse(content);
        return competitors.slice(0, 10); // Max 10
      } catch (e) {
        // If JSON fails, extract competitors manually
        return this.parseCompetitorsFromText(content);
      }
    } catch (error) {
      console.error('OpenAI error:', error);
      throw new Error('Failed to discover competitors');
    }
  },

  parseCompetitorsFromText(text) {
    const competitors = [];
    const lines = text.split('\n').filter(l => l.trim());
    
    for (const line of lines) {
      // Look for company names and URLs
      const nameMatch = line.match(/^\d+\.\s*([^-:]+)/);
      const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
      
      if (nameMatch) {
        competitors.push({
          name: nameMatch[1].trim(),
          website: urlMatch ? urlMatch[1] : 'https://example.com',
          description: 'Competitor in your space',
          pricing: 'Unknown',
          differentiator: 'To be analyzed'
        });
      }
    }
    
    return competitors.length > 0 ? competitors : [
      { name: 'Competitor A', website: 'https://example.com', description: 'Sample competitor', pricing: 'Unknown', differentiator: 'TBD' }
    ];
  }
};

// API Routes

// Get workspace
fastify.get('/api/workspaces/:workspaceId', async (request, reply) => {
  const { workspaceId } = request.params;
  const workspace = storage.workspaces.find(w => w.id === workspaceId);
  
  if (!workspace) {
    return reply.status(404).send({ error: 'Workspace not found' });
  }
  
  return {
    ...workspace,
    competitors: storage.competitors.filter(c => c.workspaceId === workspaceId),
    tasks: storage.tasks.filter(t => t.workspaceId === workspaceId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    analyses: storage.analyses.filter(a => a.workspaceId === workspaceId),
    alerts: storage.alerts.filter(a => a.workspaceId === workspaceId && !a.read)
  };
});

// Get messages
fastify.get('/api/chat', async (request, reply) => {
  return { messages: storage.messages };
});

// Discover competitors
fastify.post('/api/workspaces/:workspaceId/competitors/discover', async (request, reply) => {
  const { workspaceId } = request.params;
  const { productDescription } = request.body;
  
  if (!productDescription) {
    return reply.status(400).send({ error: 'Product description required' });
  }
  
  // Create user message
  const userMessage = {
    id: Date.now().toString(),
    role: 'user',
    content: productDescription,
    timestamp: new Date().toISOString(),
  };
  storage.messages.push(userMessage);
  
  // Create task
  const task = {
    id: `task-${Date.now()}`,
    workspaceId,
    agentId: 'competitor-intelligence',
    type: 'discover_competitors',
    status: 'pending',
    input: { productDescription },
    requiresApproval: true,
    approvalPrompt: `I'll identify the top 10 competitors for: "${productDescription}". Ready to analyze the competitive landscape?`,
    createdAt: new Date().toISOString(),
  };
  storage.tasks.push(task);
  
  // Broadcast to clients
  clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'task_created', data: task }));
    }
  });
  
  return { taskId: task.id, message: userMessage };
});

// Approve task
fastify.post('/api/tasks/:taskId/approve', async (request, reply) => {
  const { taskId } = request.params;
  const { userId } = request.body;
  
  const task = storage.tasks.find(t => t.id === taskId);
  if (!task) {
    return reply.status(404).send({ error: 'Task not found' });
  }
  
  task.status = 'in_progress';
  task.approvedAt = new Date().toISOString();
  task.approvedBy = userId;
  
  // Execute task
  if (task.type === 'discover_competitors') {
    try {
      const competitors = await CompetitorIntelligenceAgent.discoverCompetitors(
        task.workspaceId,
        task.input.productDescription
      );
      
      // Store competitors
      for (const comp of competitors) {
        const competitor = {
          id: `comp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          workspaceId: task.workspaceId,
          name: comp.name,
          website: comp.website || 'https://example.com',
          description: comp.description || 'Competitor in your market',
          threatLevel: 'medium', // Default
          createdAt: new Date().toISOString(),
        };
        storage.competitors.push(competitor);
      }
      
      // Mark task complete
      task.status = 'completed';
      task.output = { competitorsDiscovered: competitors.length };
      
      // Add AI response message
      const aiMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        agentId: 'competitor-intelligence',
        content: `I discovered ${competitors.length} competitors for your product. Check the dashboard to see the full list and their details.`,
        timestamp: new Date().toISOString(),
      };
      storage.messages.push(aiMessage);
      
      // Broadcast
      clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ 
            type: 'competitors_discovered', 
            data: { taskId, competitors, message: aiMessage } 
          }));
        }
      });
      
      return { success: true, competitorsDiscovered: competitors.length };
      
    } catch (error) {
      task.status = 'failed';
      task.output = { error: error.message };
      return reply.status(500).send({ error: error.message });
    }
  }
  
  return { success: true };
});

// Clyde responds
fastify.post('/api/respond', async (request, reply) => {
  const { content } = request.body;
  
  const message = {
    id: Date.now().toString(),
    role: 'assistant',
    agentId: 'clyde',
    content,
    timestamp: new Date().toISOString(),
  };
  
  storage.messages.push(message);
  
  clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'message', data: message }));
    }
  });
  
  return { success: true, message };
});

// WebSocket
fastify.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    clients.add(connection.socket);
    
    connection.socket.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'subscribe' && data.workspaceId) {
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
const PORT = process.env.PORT || 3001;
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Foundry backend running on port ${PORT}`);
});
