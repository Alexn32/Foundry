const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const websocket = require('@fastify/websocket');
const Anthropic = require('@anthropic-ai/sdk');

// Check for Anthropic API key
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not set!');
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// In-memory storage
const storage = {
  messages: [],
  tasks: [],
  competitors: [],
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
async function discoverCompetitors(productDescription) {
  const prompt = `Identify the top 10 most relevant competitors for this product:
"${productDescription}"

For each competitor, provide:
1. Company name
2. Website URL
3. One-sentence description
4. Pricing model
5. Key differentiator

Return ONLY a JSON array.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = message.content[0].text;
    
    // Try to parse JSON
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(content);
    } catch (e) {
      // Return placeholder if parsing fails
      return [
        { name: 'Competitor 1', website: 'https://example1.com', description: 'Sample competitor', pricing: 'Unknown', differentiator: 'TBD' },
        { name: 'Competitor 2', website: 'https://example2.com', description: 'Sample competitor', pricing: 'Unknown', differentiator: 'TBD' }
      ];
    }
  } catch (error) {
    console.error('Claude API error:', error);
    throw new Error('Failed to discover competitors');
  }
}

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
    tasks: storage.tasks.filter(t => t.workspaceId === workspaceId)
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
  
  // Create task
  const task = {
    id: `task-${Date.now()}`,
    workspaceId,
    agentId: 'competitor-intelligence',
    type: 'discover_competitors',
    status: 'pending',
    input: { productDescription },
    requiresApproval: true,
    approvalPrompt: `I'll identify the top 10 competitors for: "${productDescription}". Ready?`,
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
      const competitors = await discoverCompetitors(task.input.productDescription);
      
      // Store competitors
      for (const comp of competitors.slice(0, 10)) {
        storage.competitors.push({
          id: `comp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          workspaceId: task.workspaceId,
          name: comp.name || 'Unknown',
          website: comp.website || 'https://example.com',
          description: comp.description || 'Competitor',
          threatLevel: 'medium',
          createdAt: new Date().toISOString(),
        });
      }
      
      task.status = 'completed';
      task.output = { competitorsDiscovered: competitors.length };
      
      // Add AI response
      const aiMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        agentId: 'competitor-intelligence',
        content: `I discovered ${competitors.length} competitors for your product.`,
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
