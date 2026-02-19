// Founder Profile Service
// CRUD operations for founder profiles
// Used by: Onboarding, Agents, Dashboard

const { PrismaClient } = require('@prisma/client');

class FounderProfileService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  // Create profile from completed onboarding
  async createFromOnboarding(workspaceId, onboardingData) {
    const extracted = onboardingData.extractedData || {};
    
    const profile = await this.prisma.founderProfile.create({
      data: {
        workspaceId,
        
        // Core business info
        stage: extracted.stage?.current_stage || 'unknown',
        productDescription: extracted.product?.what_it_is || '',
        problemSolved: extracted.product?.problem_solved || '',
        idealCustomer: extracted.customer?.who_they_are || '',
        revenueModel: extracted.revenue?.model || '',
        competitors: extracted.competitors || {},
        budgetSituation: extracted.budget?.budget_range || '',
        runwayMonths: parseInt(extracted.budget?.runway_months) || null,
        goal90Day: extracted.success_90?.specific_metrics || '',
        biggestConcern: extracted.concerns?.biggest_worry || '',
        
        // Structured data
        extractedData: extracted,
        confirmedSummary: onboardingData.summary?.data || {},
        
        // Status
        status: 'active',
        onboardingComplete: true,
        confirmedAt: new Date()
      }
    });

    return profile;
  }

  // Get full profile with all relations
  async getFullProfile(workspaceId) {
    const profile = await this.prisma.founderProfile.findUnique({
      where: { workspaceId },
      include: {
        workspace: {
          include: {
            competitors: true,
            files: true,
            agentOutputs: {
              orderBy: { createdAt: 'desc' },
              take: 20
            }
          }
        }
      }
    });

    return profile;
  }

  // Update specific fields
  async updateField(workspaceId, field, value) {
    const allowedFields = [
      'stage', 'productDescription', 'problemSolved', 'idealCustomer',
      'revenueModel', 'competitors', 'budgetSituation', 'runwayMonths',
      'goal90Day', 'biggestConcern', 'extractedData', 'confirmedSummary'
    ];

    if (!allowedFields.includes(field)) {
      throw new Error(`Field ${field} cannot be updated`);
    }

    return await this.prisma.founderProfile.update({
      where: { workspaceId },
      data: { [field]: value, updatedAt: new Date() }
    });
  }

  // Get profile for agent context
  async getAgentContext(workspaceId) {
    const profile = await this.getFullProfile(workspaceId);
    
    if (!profile) {
      return null;
    }

    return this.formatForAgents(profile);
  }

  // Format profile data for agent consumption
  formatForAgents(profile) {
    const data = profile.extractedData || {};
    
    return {
      // Identity
      founderId: profile.workspace.ownerId,
      workspaceId: profile.workspaceId,
      
      // Business Core
      stage: profile.stage,
      product: profile.productDescription,
      problem: profile.problemSolved,
      customer: profile.idealCustomer,
      revenue: profile.revenueModel,
      
      // Strategy
      goal90Day: profile.goal90Day,
      runway: profile.runwayMonths,
      budget: profile.budgetSituation,
      concerns: profile.biggestConcern,
      
      // Competitive
      competitors: profile.competitors,
      competitorList: profile.workspace.competitors.map(c => ({
        name: c.name,
        website: c.website,
        threat: c.threatLevel
      })),
      
      // Assets
      files: profile.workspace.files.map(f => ({
        name: f.name,
        category: f.category,
        processed: f.processed
      })),
      
      // History
      recentOutputs: profile.workspace.agentOutputs.slice(0, 5).map(o => ({
        type: o.type,
        createdAt: o.createdAt
      })),
      
      // Raw for advanced use
      raw: data
    };
  }

  // Archive profile (soft delete)
  async archive(workspaceId) {
    return await this.prisma.founderProfile.update({
      where: { workspaceId },
      data: { status: 'archived', updatedAt: new Date() }
    });
  }

  // Get profile summary for dashboard
  async getDashboardSummary(workspaceId) {
    const profile = await this.prisma.founderProfile.findUnique({
      where: { workspaceId },
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                competitors: true,
                tasks: true,
                files: true,
                alerts: { where: { read: false } }
              }
            }
          }
        }
      }
    });

    if (!profile) return null;

    return {
      stage: profile.stage,
      product: profile.productDescription?.substring(0, 100),
      stats: {
        competitors: profile.workspace._count.competitors,
        tasks: profile.workspace._count.tasks,
        files: profile.workspace._count.files,
        unreadAlerts: profile.workspace._count.alerts
      },
      lastUpdated: profile.updatedAt
    };
  }
}

module.exports = FounderProfileService;
