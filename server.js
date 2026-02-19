const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const websocket = require('@fastify/websocket');
const Anthropic = require('@anthropic-ai/sdk');
const FounderOnboarding = require('./lib/onboarding');

// Check for Anthropic API key
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not set!');
  console.error('Get yours at: https://console.anthropic.com/settings/keys');
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize onboarding system
const onboarding = new FounderOnboarding(anthropic);

// In-memory storage
const storage = {
  messages: [],
  tasks: [],
  competitors: [],
  analyses: [],
  alerts: [],
  workspaces: [{ id: 'demo-workspace', name: 'Demo Workspace', ownerId: 'founder-1', createdAt: new Date() }]
};

const clients = new Set();

// Register plugins
fastify.register(cors, { 
  origin: ['https://foundry-nine-pi.vercel.app', 'https://*.vercel.app', 'http://localhost:3000'],
  credentials: true
});
fastify.register(websocket);

// Health check
fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Competitor Intelligence Agent using Claude
const CompetitorIntelligenceAgent = {
  async discoverCompetitors(workspaceId, productDescription) {
    const prompt = `You are a competitive intelligence expert. Analyze this product and identify competitors.

Product Description: "${productDescription}"

Identify the top 10 most relevant competitors. For each, provide:
1. Company name
2. Website URL (must be real, valid URL)
3. One-sentence description of what they do
4. Their pricing model (freemium, subscription, one-time, etc.)
5. Their key differentiator (what makes them unique)

Respond ONLY with a valid JSON array in this exact format:
[
  {
    "name": "Company Name",
    "website": "https://company.com",
    "description": "What they do",
    "pricing": "Pricing model",
    "differentiator": "What makes them unique"
  }
]`;

    try {
      const message = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        temperature: 0.7,
        messages: [
          { role: 'user', content: prompt }
        ]
      });

      const content = message.content[0].text;
      
      // Try to extract JSON
      try {
        // Look for JSON array in response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const competitors = JSON.parse(jsonMatch[0]);
          return competitors.slice(0, 10);
        }
        // Try parsing entire response
        const competitors = JSON.parse(content);
        return competitors.slice(0, 10);
      } catch (e) {
        console.log('JSON parse failed, extracting manually:', e.message);
        return this.parseCompetitorsFromText(content);
      }
    } catch (error) {
      console.error('Claude API error:', error);
      throw new Error('Failed to discover competitors: ' + error.message);
    }
  },

  parseCompetitorsFromText(text) {
    const competitors = [];
    const lines = text.split('\n').filter(l => l.trim());
    
    let currentCompetitor = {};
    
    for (const line of lines) {
      const cleanLine = line.trim();
      
      // Check for company name (often starts with number or bullet)
      const nameMatch = cleanLine.match(/^(?:\d+[.\)]\s*|[-•]\s*)([^:{\[]+)/i);
      if (nameMatch && !cleanLine.includes('http')) {
        if (currentCompetitor.name) {
          competitors.push({ ...currentCompetitor });
        }
        currentCompetitor = {
          name: nameMatch[1].trim(),
          website: 'https://example.com',
          description: 'Competitor in your market',
          pricing: 'Unknown',
          differentiator: 'To be analyzed'
        };
      }
      
      // Extract URL
      const urlMatch = cleanLine.match(/(https?:\/\/[\w.-]+)/);
      if (urlMatch && currentCompetitor.name) {
        currentCompetitor.website = urlMatch[1];
      }
      
      // Extract description
      if (cleanLine.toLowerCase().includes('description') && cleanLine.includes(':')) {
        const desc = cleanLine.split(':')[1]?.trim();
        if (desc) currentCompetitor.description = desc;
      }
    }
    
    if (currentCompetitor.name) {
      competitors.push(currentCompetitor);
    }
    
    return competitors.length > 0 ? competitors : [
      { name: 'Sample Competitor', website: 'https://example.com', description: 'Sample', pricing: 'Unknown', differentiator: 'TBD' }
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
fastify.get('/api/chat', async () => ({ messages: storage.messages }));

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
  
  // Create task requiring approval
  const task = {
    id: `task-${Date.now()}`,
    workspaceId,
    agentId: 'competitor-intelligence',
    type: 'discover_competitors',
    status: 'pending',
    input: { productDescription },
    requiresApproval: true,
    approvalPrompt: `I'll use Claude AI to identify the top 10 competitors for: "${productDescription}". Ready to analyze the competitive landscape?`,
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
          name: comp.name || 'Unknown Competitor',
          website: comp.website || 'https://example.com',
          description: comp.description || 'Competitor in your market',
          pricing: comp.pricing || 'Unknown',
          differentiator: comp.differentiator || 'To be analyzed',
          threatLevel: 'medium',
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
        content: `I discovered ${competitors.length} competitors using Claude AI. Check the dashboard for the full analysis.`,
        timestamp: new Date().toISOString(),
      };
      storage.messages.push(aiMessage);
      
      // Broadcast to all clients
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

// ============ ONBOARDING ROUTES ============

// Start onboarding
fastify.post('/api/onboarding/start', async (request, reply) => {
  const { founderId, workspaceId } = request.body;
  
  try {
    const result = await onboarding.startOnboarding(founderId, workspaceId);
    return result;
  } catch (error) {
    console.error('Onboarding start error:', error);
    return reply.status(500).send({ error: error.message });
  }
});

// Process answer and get next question
fastify.post('/api/onboarding/answer', async (request, reply) => {
  const { founderId, answer, files } = request.body;
  
  try {
    const result = await onboarding.processAnswer(founderId, answer, files);
    return result;
  } catch (error) {
    console.error('Onboarding answer error:', error);
    return reply.status(500).send({ error: error.message });
  }
});

// Confirm or edit summary
fastify.post('/api/onboarding/confirm', async (request, reply) => {
  const { founderId, confirmation } = request.body;
  
  try {
    const result = await onboarding.confirmSummary(founderId, confirmation);
    return result;
  } catch (error) {
    console.error('Onboarding confirm error:', error);
    return reply.status(500).send({ error: error.message });
  }
});

// Upload files during onboarding
fastify.post('/api/onboarding/upload', async (request, reply) => {
  const { founderId, files } = request.body;
  
  try {
    const state = await onboarding.getOnboardingState(founderId);
    if (!state) {
      return reply.status(404).send({ error: 'Onboarding not found' });
    }
    
    // Process uploaded files
    for (const file of files) {
      state.uploadedFiles.push({
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        type: file.type,
        size: file.size,
        category: onboarding.categorizeFile(file),
        uploadedAt: new Date().toISOString(),
        processed: false
      });
    }
    
    await onboarding.saveOnboardingState(state);
    
    return { 
      success: true, 
      message: `Uploaded ${files.length} file(s). I'll analyze these and factor them into your profile.`,
      files: state.uploadedFiles 
    };
  } catch (error) {
    console.error('File upload error:', error);
    return reply.status(500).send({ error: error.message });
  }
});

// Get founder profile
fastify.get('/api/founders/:founderId/profile', async (request, reply) => {
  const { founderId } = request.params;
  
  // In production, fetch from database
  // For now, check if onboarding is complete
  const state = await onboarding.getOnboardingState(founderId);
  
  if (!state || state.status !== 'completed') {
    return reply.status(404).send({ error: 'Profile not found or onboarding incomplete' });
  }
  
  return {
    founderId: state.founderId,
    workspaceId: state.workspaceId,
    business: state.answers,
    summary: state.summary?.data,
    files: state.uploadedFiles,
    agentContext: state.agentContext
  };
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
  console.log(`🤖 Using Claude (Anthropic) for AI agents`);
});
