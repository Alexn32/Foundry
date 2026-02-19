// Centralized configuration
// All settings loaded from environment variables
// Single source of truth for the entire application

require('dotenv').config();

const config = {
  // Server
  port: parseInt(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  database: {
    url: process.env.DATABASE_URL,
  },
  
  // AI Provider
  ai: {
    provider: process.env.AI_PROVIDER || 'anthropic',
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
    models: {
      onboarding: process.env.ONBOARDING_MODEL || 'claude-3-sonnet-20240229',
      analysis: process.env.ANALYSIS_MODEL || 'claude-3-sonnet-20240229',
      code: process.env.CODE_MODEL || 'claude-3-sonnet-20240229',
    }
  },
  
  // Features
  features: {
    competitorScraping: process.env.ENABLE_COMPETITOR_SCRAPING === 'true',
    fileProcessing: process.env.ENABLE_FILE_PROCESSING !== 'false',
    realTimeAlerts: process.env.ENABLE_REAL_TIME_ALERTS === 'true',
  },
  
  // Onboarding
  onboarding: {
    maxFollowUpQuestions: parseInt(process.env.MAX_FOLLOW_UP_QUESTIONS) || 3,
    minClarityScore: parseInt(process.env.MIN_CLARITY_SCORE) || 6,
  },
  
  // Agent settings
  agents: {
    approvalRequired: process.env.AGENT_APPROVAL_REQUIRED !== 'false',
    defaultPriority: process.env.DEFAULT_TASK_PRIORITY || 'medium',
  },
  
  // Monitoring
  monitoring: {
    logLevel: process.env.LOG_LEVEL || 'info',
    enableMetrics: process.env.ENABLE_METRICS === 'true',
  },
  
  // CORS
  cors: {
    origins: [
      'https://foundry-nine-pi.vercel.app',
      'https://*.vercel.app',
      'http://localhost:3000',
    ]
  }
};

// Validate required config
function validateConfig() {
  const required = [];
  
  if (!config.database.url) {
    required.push('DATABASE_URL');
  }
  
  if (config.ai.provider === 'anthropic' && !config.ai.anthropic.apiKey) {
    required.push('ANTHROPIC_API_KEY');
  }
  
  if (config.ai.provider === 'openai' && !config.ai.openai.apiKey) {
    required.push('OPENAI_API_KEY');
  }
  
  if (required.length > 0) {
    console.error('❌ Missing required environment variables:');
    required.forEach(v => console.error(`  - ${v}`));
    process.exit(1);
  }
}

module.exports = { config, validateConfig };
