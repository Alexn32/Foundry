# Foundry Backend

Simple Fastify API server for Foundry.

## Deploy

1. Set environment variable:
   - `ANTHROPIC_API_KEY` = your Anthropic API key

2. Railway auto-deploys from GitHub

## API Endpoints

- `GET /health` - Health check
- `GET /api/workspaces/:id` - Get workspace data
- `GET /api/chat` - Get messages
- `POST /api/workspaces/:id/competitors/discover` - Start competitor discovery
- `POST /api/tasks/:id/approve` - Approve and execute task
