// Context Engine
// Retrieves and formats founder context for agents
// Ensures no founder repeats themselves

const FounderProfileService = require('./founder-profile');

class ContextEngine {
  constructor() {
    this.profileService = new FounderProfileService();
  }

  // Main entry: Get full context for an agent
  async getContextForAgent(workspaceId, agentId, taskType = null) {
    const profile = await this.profileService.getAgentContext(workspaceId);
    
    if (!profile) {
      return { error: 'No founder profile found' };
    }

    // Build context based on agent type
    const context = {
      founder: this.formatFounderInfo(profile),
      business: this.formatBusinessInfo(profile),
      strategy: this.formatStrategyInfo(profile),
      market: this.formatMarketInfo(profile),
      history: await this.formatHistory(workspaceId, agentId),
      constraints: this.formatConstraints(profile)
    };

    // Agent-specific context
    if (agentId === 'competitor-intelligence') {
      context.focus = this.formatCompetitorFocus(profile);
    } else if (agentId === 'code') {
      context.focus = this.formatCodeFocus(profile);
    } else if (agentId === 'marketing') {
      context.focus = this.formatMarketingFocus(profile);
    }

    return context;
  }

  // Format for system prompt
  formatForSystemPrompt(context) {
    return `You are an AI co-founder assisting with this business:

FOUNDER CONTEXT:
Stage: ${context.founder.stage}
Product: ${context.business.product}
Problem: ${context.business.problem}
Customer: ${context.business.customer}
Revenue: ${context.business.revenue}

STRATEGIC CONTEXT:
90-Day Goal: ${context.strategy.goal}
Runway: ${context.strategy.runway} months
Budget: ${context.strategy.budget}
Biggest Concern: ${context.strategy.concerns}

COMPETITIVE LANDSCAPE:
${context.market.competitors}

WHAT YOU'VE ALREADY DONE:
${context.history.recent}

CONSTRAINTS:
${context.constraints.summary}

INSTRUCTIONS:
- Use this context to inform your work
- Don't ask the founder to repeat what's here
- Reference specific details from their profile
- Make recommendations based on their stage and constraints
`;
  }

  // Format founder info
  formatFounderInfo(profile) {
    return {
      id: profile.founderId,
      stage: profile.stage,
      experience: this.inferExperience(profile)
    };
  }

  // Format business info
  formatBusinessInfo(profile) {
    return {
      product: profile.product,
      problem: profile.problem,
      customer: profile.customer,
      revenue: profile.revenue,
      solution: profile.product // Alternative framing
    };
  }

  // Format strategy info
  formatStrategyInfo(profile) {
    return {
      goal: profile.goal90Day,
      runway: profile.runway,
      runwayStatus: this.calculateRunwayStatus(profile.runway),
      budget: profile.budget,
      concerns: profile.concerns
    };
  }

  // Format market/competitor info
  formatMarketInfo(profile) {
    const competitorNames = profile.competitorList?.map(c => c.name).join(', ') || 'None identified yet';
    
    return {
      competitors: competitorNames,
      competitorCount: profile.competitorList?.length || 0,
      positioning: this.inferPositioning(profile)
    };
  }

  // Format work history
  async formatHistory(workspaceId, agentId) {
    // Get recent tasks by this agent
    const recentTasks = await this.profileService.prisma.task.findMany({
      where: { 
        workspaceId,
        agentId
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        type: true,
        status: true,
        title: true,
        completedAt: true
      }
    });

    if (recentTasks.length === 0) {
      return {
        recent: 'No previous work with this agent.',
        lastTask: null
      };
    }

    const completed = recentTasks.filter(t => t.status === 'completed');
    
    return {
      recent: completed.map(t => `- ${t.title} (${t.status})`).join('\n'),
      lastTask: recentTasks[0],
      totalTasks: recentTasks.length
    };
  }

  // Format constraints
  formatConstraints(profile) {
    const constraints = [];
    
    if (profile.runway && profile.runway < 6) {
      constraints.push(`Short runway (${profile.runway} months) - prioritize revenue`);
    }
    
    if (profile.budget?.includes('limited') || profile.budget?.includes('small')) {
      constraints.push('Limited budget - focus on high-ROI activities');
    }
    
    if (profile.stage === 'idea') {
      constraints.push('Early stage - focus on validation before scaling');
    }
    
    return {
      summary: constraints.join('\n') || 'No major constraints identified',
      list: constraints
    };
  }

  // Agent-specific: Competitor focus
  formatCompetitorFocus(profile) {
    return {
      knownCompetitors: profile.competitorList,
      gaps: this.identifyCompetitorGaps(profile),
      priority: this.inferCompetitorPriority(profile)
    };
  }

  // Agent-specific: Code focus
  formatCodeFocus(profile) {
    return {
      stage: profile.stage,
      mvpStatus: profile.stage === 'building' ? 'In progress' : 'Unknown',
      techStack: null, // Could be extracted from files
      priority: profile.stage === 'idea' ? 'Build MVP' : 'Iterate and scale'
    };
  }

  // Agent-specific: Marketing focus
  formatMarketingFocus(profile) {
    return {
      customer: profile.customer,
      stage: profile.stage,
      goal: profile.goal90Day,
      channelsTried: this.extractChannelsFromHistory(profile),
      priority: this.inferMarketingPriority(profile)
    };
  }

  // Helper: Infer experience level
  inferExperience(profile) {
    const hasHistory = profile.raw?.tried?.what_was_attempted;
    const hasRevenue = profile.revenue && !profile.revenue.includes('plan');
    
    if (hasRevenue) return 'experienced';
    if (hasHistory) return 'learning';
    return 'first_time';
  }

  // Helper: Calculate runway status
  calculateRunwayStatus(runway) {
    if (!runway) return 'unknown';
    if (runway < 3) return 'critical';
    if (runway < 6) return 'short';
    if (runway < 12) return 'moderate';
    return 'healthy';
  }

  // Helper: Infer positioning
  inferPositioning(profile) {
    const problem = profile.problem || '';
    const product = profile.product || '';
    
    if (problem.includes('expensive') || problem.includes('cost')) {
      return 'cost-effective alternative';
    }
    if (problem.includes('complex') || problem.includes('difficult')) {
      return 'simplified solution';
    }
    if (problem.includes('slow') || problem.includes('time')) {
      return 'faster alternative';
    }
    return 'differentiated solution';
  }

  // Helper: Identify competitor gaps
  identifyCompetitorGaps(profile) {
    const gaps = [];
    
    if (!profile.competitorList || profile.competitorList.length === 0) {
      gaps.push('No competitors identified yet');
    }
    
    if (profile.competitorList?.length < 3) {
      gaps.push('Limited competitive intelligence');
    }
    
    return gaps;
  }

  // Helper: Infer competitor priority
  inferCompetitorPriority(profile) {
    if (profile.stage === 'idea') return 'low';
    if (profile.stage === 'building') return 'medium';
    if (profile.stage === 'early_users') return 'high';
    return 'critical';
  }

  // Helper: Extract channels from history
  extractChannelsFromHistory(profile) {
    // Could parse from raw onboarding data
    return [];
  }

  // Helper: Infer marketing priority
  inferMarketingPriority(profile) {
    if (profile.stage === 'idea') return 'validation';
    if (profile.stage === 'building') return 'pre_launch';
    if (profile.stage === 'early_users') return 'acquisition';
    return 'scale';
  }
}

module.exports = ContextEngine;
