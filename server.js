const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const Anthropic = require('@anthropic-ai/sdk');

// Load env
require('dotenv').config();

// Validate API key
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY required');
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// In-memory storage (use DB in production)
const storage = {
  messages: [],
  tasks: [],
  competitors: [],
  workspaces: [{ id: 'demo', name: 'Demo', ownerId: 'founder-1' }]
};

// Register CORS
fastify.register(cors, { 
  origin: ['https://foundry-nine-pi.vercel.app', 'http://localhost:3000'],
  credentials: true
});

// Health check
fastify.get('/health', async () => ({ 
  status: 'ok', 
  timestamp: new Date().toISOString() 
}));

// Get workspace data
fastify.get('/api/workspaces/:workspaceId', async (request, reply) => {
  const { workspaceId } = request.params;
  const workspace = storage.workspaces.find(w => w.id === workspaceId);
  
  if (!workspace) {
    return reply.status(404).send({ error: 'Not found' });
  }
  
  return {
    ...workspace,
    competitors: storage.competitors.filter(c => c.workspaceId === workspaceId),
    tasks: storage.tasks.filter(t => t.workspaceId === workspaceId)
  };
});

// Get messages
fastify.get('/api/chat', async () => ({ messages: storage.messages }));

// Discover competitors using Claude
fastify.post('/api/workspaces/:workspaceId/competitors/discover', async (request, reply) => {
  const { workspaceId } = request.params;
  const { productDescription } = request.body;
  
  if (!productDescription) {
    return reply.status(400).send({ error: 'Description required' });
  }
  
  // Create task
  const task = {
    id: `task-${Date.now()}`,
    workspaceId,
    agentId: 'competitor-intelligence',
    type: 'discover_competitors',
    status: 'pending',
    input: { productDescription },
    requiresApproval: true,
    approvalPrompt: `Find competitors for: "${productDescription}"?`,
    createdAt: new Date().toISOString(),
  };
  storage.tasks.push(task);
  
  return { taskId: task.id, status: 'pending_approval' };
});

// Approve and execute task
fastify.post('/api/tasks/:taskId/approve', async (request, reply) => {
  const { taskId } = request.params;
  const task = storage.tasks.find(t => t.id === taskId);
  
  if (!task) {
    return reply.status(404).send({ error: 'Task not found' });
  }
  
  task.status = 'in_progress';
  
  try {
    // Call Claude
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `List 5 competitors for this product: "${task.input.productDescription}". Return JSON array with name, website, description.`
      }]
    });
    
    const content = message.content[0].text;
    let competitors = [];
    
    // Parse JSON
    try {
      const match = content.match(/\[[\s\S]*\]/);
      competitors = match ? JSON.parse(match[0]) : [];
    } catch (e) {
      competitors = [{ name: 'Sample', website: 'https://example.com', description: 'Competitor' }];
    }
    
    // Store competitors
    for (const comp of competitors.slice(0, 5)) {
      storage.competitors.push({
        id: `comp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        workspaceId: task.workspaceId,
        name: comp.name || 'Unknown',
        website: comp.website || 'https://example.com',
        description: comp.description || 'Competitor',
        threatLevel: 'medium',
        createdAt: new Date().toISOString(),
      });
    }
    
    task.status = 'completed';
    task.output = { competitorsFound: competitors.length };
    
    return { 
      success: true, 
      competitorsFound: competitors.length,
      competitors: storage.competitors.slice(-5)
    };
    
  } catch (error) {
    console.error('Claude error:', error);
    task.status = 'failed';
    return reply.status(500).send({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Foundry API running on port ${PORT}`);
});
