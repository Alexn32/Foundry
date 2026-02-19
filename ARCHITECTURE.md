# Foundry Architecture

## Design Principles
1. **Configuration over code** - Change behavior via env vars, not code changes
2. **Clear separation** - Business logic separate from infrastructure
3. **Database migrations** - Schema changes are versioned and reversible
4. **Service layer** - Core logic isolated, easy to test and modify

## Database Schema (Prisma)
- Founder profiles isolated by workspace
- Agent outputs linked to founders
- File metadata stored, content processed
- All changes tracked with timestamps

## Environment Configuration
- Database URL configurable
- AI provider swappable (Anthropic, OpenAI, etc.)
- Feature flags for gradual rollouts
- Debug modes for development

## Service Structure
```
/services
  /onboarding.js    - Onboarding logic
  /agents           - Agent implementations
    /competitor-intelligence.js
    /code.js
    /marketing.js
  /founder-profile.js - Profile CRUD
  /context-engine.js  - Agent context retrieval
```

## Easy Modification Points
- Questions? Edit `lib/questions.js`
- AI prompts? Edit service files
- New agent? Add to `/services/agents/`
- Database schema? Edit `prisma/schema.prisma`
