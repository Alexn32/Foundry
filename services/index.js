// Services index - exports all business logic services
// Easy to modify: Add new services here

const FounderProfileService = require('./founder-profile');
const OnboardingService = require('./onboarding');
const ContextEngine = require('./context-engine');

// Agent services
const CompetitorIntelligenceAgent = require('./agents/competitor-intelligence');

module.exports = {
  FounderProfileService,
  OnboardingService,
  ContextEngine,
  Agents: {
    CompetitorIntelligenceAgent
  }
};
