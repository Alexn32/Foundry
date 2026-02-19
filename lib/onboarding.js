// Founder Onboarding System
// Conversational, one question at a time, natural advisor feel

const { Anthropic } = require('@anthropic-ai/sdk');

class FounderOnboarding {
  constructor(anthropicClient) {
    this.anthropic = anthropicClient;
    
    // Onboarding question sequence
    this.questions = [
      {
        id: 'stage',
        text: "What stage are you at right now? Just an idea, building the product, have early users, generating revenue, or scaling?",
        category: 'stage',
        type: 'single_choice',
        options: ['Just an idea', 'Building the product', 'Have early users', 'Generating revenue', 'Scaling']
      },
      {
        id: 'product',
        text: "What are you building, and what problem does it solve?",
        category: 'product',
        type: 'open_ended',
        followUp: "Tell me more about the problem. Who feels this pain most acutely?"
      },
      {
        id: 'customer',
        text: "Who is your ideal customer? Be specific — what kind of person or company, what size, what industry?",
        category: 'customer',
        type: 'open_ended'
      },
      {
        id: 'tried',
        text: "What have you already tried, and what happened?",
        category: 'history',
        type: 'open_ended',
        context: "I'm asking because your past attempts tell me what you've learned and what roads might be dead ends."
      },
      {
        id: 'revenue',
        text: "How do you make money today, or how do you plan to?",
        category: 'revenue',
        type: 'open_ended',
        followUp: "What's your pricing model? One-time, subscription, usage-based, something else?"
      },
      {
        id: 'competitors',
        text: "Who are your main competitors? Even if you think you don't have any, what do people do today instead of using your solution?",
        category: 'competitors',
        type: 'open_ended'
      },
      {
        id: 'budget',
        text: "What's your budget and runway situation? How much can you spend, and how much time do you have before you need to show results?",
        category: 'constraints',
        type: 'open_ended',
        context: "This helps me prioritize what we tackle first."
      },
      {
        id: 'success_90',
        text: "What does success look like in 90 days? If we crushed it this quarter, what would have happened?",
        category: 'goals',
        type: 'open_ended'
      },
      {
        id: 'concerns',
        text: "What keeps you up at night? What's the thing you're most worried about right now?",
        category: 'risks',
        type: 'open_ended',
        context: "I want to make sure we're addressing your biggest fears, not just the obvious stuff."
      }
    ];
  }

  // Start onboarding for a new founder
  async startOnboarding(founderId, workspaceId) {
    const onboardingState = {
      founderId,
      workspaceId,
      currentQuestionIndex: 0,
      answers: {},
      uploadedFiles: [],
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString()
    };

    // Store in database
    await this.saveOnboardingState(onboardingState);

    // Return first question with natural greeting
    return {
      message: "Hey! I'm Clyde, your AI co-founder. I'm going to ask you some questions to understand your business — not like a form, more like a conversation with a smart advisor. Ready?",
      question: this.questions[0],
      progress: { current: 1, total: this.questions.length },
      canUploadFiles: true
    };
  }

  // Process founder's answer and return next question or summary
  async processAnswer(founderId, answer, files = []) {
    const state = await this.getOnboardingState(founderId);
    
    if (!state) {
      throw new Error('Onboarding not started');
    }

    const currentQuestion = this.questions[state.currentQuestionIndex];
    
    // Store answer
    state.answers[currentQuestion.id] = {
      question: currentQuestion.text,
      answer: answer,
      category: currentQuestion.category,
      answeredAt: new Date().toISOString()
    };

    // Store uploaded files
    if (files.length > 0) {
      for (const file of files) {
        state.uploadedFiles.push({
          id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          category: this.categorizeFile(file),
          uploadedAt: new Date().toISOString(),
          processed: false
        });
      }
    }

    // Move to next question
    state.currentQuestionIndex++;
    state.lastMessageAt = new Date().toISOString();

    // Check if we have enough to generate summary
    if (state.currentQuestionIndex >= this.questions.length) {
      // Generate summary using Claude
      const summary = await this.generateSummary(state);
      state.summary = summary;
      state.status = 'awaiting_confirmation';
      await this.saveOnboardingState(state);

      return {
        type: 'summary',
        message: summary.message,
        summary: summary.data,
        canConfirm: true,
        canEdit: true,
        uploadedFiles: state.uploadedFiles
      };
    }

    // Get next question
    const nextQuestion = this.questions[state.currentQuestionIndex];
    
    // Generate natural transition using Claude
    const transition = await this.generateTransition(
      currentQuestion, 
      nextQuestion, 
      answer
    );

    await this.saveOnboardingState(state);

    return {
      type: 'question',
      message: transition,
      question: nextQuestion,
      progress: { 
        current: state.currentQuestionIndex + 1, 
        total: this.questions.length 
      },
      canUploadFiles: true,
      uploadedFilesCount: state.uploadedFiles.length
    };
  }

  // Generate natural transition between questions
  async generateTransition(previousQuestion, nextQuestion, previousAnswer) {
    try {
      const prompt = `The founder just answered: "${previousAnswer}"

Previous question was: "${previousQuestion.text}"

Next question is: "${nextQuestion.text}"

Generate a natural, conversational transition (1-2 sentences max) that acknowledges their answer and smoothly leads into the next question. Don't be robotic. Sound like a smart advisor who actually listened.`;

      const message = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 150,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }]
      });

      return message.content[0].text.trim();
    } catch (error) {
      console.error('Transition generation error:', error);
      // Fallback transition
      return `Got it. ${nextQuestion.text}`;
    }
  }

  // Generate summary using Claude
  async generateSummary(state) {
    const prompt = `Based on this founder's onboarding answers, create a clear business summary.

ANSWERS:
${Object.entries(state.answers).map(([key, value]) => `
Q: ${value.question}
A: ${value.answer}
`).join('\n')}

UPLOADED FILES: ${state.uploadedFiles.length > 0 ? state.uploadedFiles.map(f => f.name).join(', ') : 'None'}

Create a summary in this exact format:

---
**The Business**: [One sentence what they do]

**The Problem**: [The pain they solve]

**The Customer**: [Who they serve]

**The Stage**: [Current stage]

**The Revenue Model**: [How they make money]

**The Competition**: [Main competitors/alternatives]

**The 90-Day Goal**: [What success looks like]

**The Constraints**: [Budget, runway, key challenges]

**The Biggest Risk**: [What keeps them up at night]
---

Be concise but comprehensive. Use their exact words where possible.`;

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1500,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      });

      const summaryText = message.content[0].text;
      
      // Parse summary into structured data
      const summaryData = this.parseSummary(summaryText);

      return {
        message: `Here's what I understand about your business:\n\n${summaryText}\n\nIs this right? Does this capture your business accurately? You can confirm, correct anything, or add what's missing.`,
        data: summaryData,
        rawText: summaryText
      };
    } catch (error) {
      console.error('Summary generation error:', error);
      return {
        message: "I've gathered your information. Let me summarize what I understand about your business...",
        data: state.answers,
        rawText: JSON.stringify(state.answers, null, 2)
      };
    }
  }

  // Parse summary text into structured data
  parseSummary(text) {
    const sections = {};
    const lines = text.split('\n');
    let currentSection = null;

    for (const line of lines) {
      const match = line.match(/\*\*(.+?)\*\*:\s*(.+)/);
      if (match) {
        const key = match[1].toLowerCase().replace(/\s+/g, '_');
        sections[key] = match[2].trim();
      }
    }

    return sections;
  }

  // Handle founder confirmation of summary
  async confirmSummary(founderId, confirmation) {
    const state = await this.getOnboardingState(founderId);
    
    if (confirmation.action === 'confirm') {
      // Lock in the profile
      state.status = 'completed';
      state.confirmedAt = new Date().toISOString();
      state.confirmedSummary = state.summary;
      
      // Create founder profile
      const profile = await this.createFounderProfile(state);
      
      await this.saveOnboardingState(state);
      
      return {
        type: 'complete',
        message: "Perfect! Your profile is locked in. Your agents now have full context and can start working. They'll pull from this profile before every task — no need to repeat yourself.",
        profile: profile,
        nextSteps: [
          'Competitor Intelligence Agent can now analyze your market',
          'Code Agent can start building with your context in mind',
          'Upload more files anytime — they\'ll be automatically ingested'
        ]
      };
    } else if (confirmation.action === 'edit') {
      // Store corrections
      state.corrections = state.corrections || [];
      state.corrections.push({
        field: confirmation.field,
        correction: correction.value,
        timestamp: new Date().toISOString()
      });
      
      // Update summary with correction
      state.summary.data[confirmation.field] = confirmation.value;
      
      await this.saveOnboardingState(state);
      
      return {
        type: 'summary_updated',
        message: `Got it. I've updated that. Here's the corrected summary:\n\n${this.formatSummary(state.summary.data)}\n\nAnything else to adjust?`,
        summary: state.summary.data
      };
    } else if (confirmation.action === 'add') {
      // Add additional information
      state.additionalInfo = state.additionalInfo || [];
      state.additionalInfo.push({
        content: confirmation.content,
        timestamp: new Date().toISOString()
      });
      
      await this.saveOnboardingState(state);
      
      return {
        type: 'summary_updated',
        message: "Thanks for adding that. I've included it in your profile. Anything else?",
        summary: state.summary.data
      };
    }
  }

  // Create founder profile from completed onboarding
  async createFounderProfile(state) {
    return {
      founderId: state.founderId,
      workspaceId: state.workspaceId,
      createdAt: state.startedAt,
      confirmedAt: state.confirmedAt,
      
      // Core business info
      business: {
        stage: state.answers.stage?.answer,
        description: state.answers.product?.answer,
        problem: state.answers.product?.followUpAnswer,
        customer: state.answers.customer?.answer,
        revenueModel: state.answers.revenue?.answer,
        competitors: state.answers.competitors?.answer,
      },
      
      // Strategic context
      strategy: {
        goals90Day: state.answers.success_90?.answer,
        constraints: state.answers.budget?.answer,
        biggestRisk: state.answers.concerns?.answer,
        history: state.answers.tried?.answer
      },
      
      // Confirmed summary
      summary: state.summary?.data,
      
      // Files
      files: state.uploadedFiles,
      
      // Context for agents
      agentContext: this.formatAgentContext(state),
      
      // Mutable — agents write results here
      agentOutputs: [],
      decisions: [],
      metrics: {}
    };
  }

  // Format context for agents to consume
  formatAgentContext(state) {
    return `
FOUNDER PROFILE
===============

STAGE: ${state.answers.stage?.answer || 'Unknown'}

BUSINESS: ${state.answers.product?.answer || 'Unknown'}
PROBLEM: ${state.answers.product?.followUpAnswer || 'Unknown'}

CUSTOMER: ${state.answers.customer?.answer || 'Unknown'}

REVENUE MODEL: ${state.answers.revenue?.answer || 'Unknown'}

COMPETITORS: ${state.answers.competitors?.answer || 'Unknown'}

90-DAY GOAL: ${state.answers.success_90?.answer || 'Unknown'}

CONSTRAINTS: ${state.answers.budget?.answer || 'Unknown'}

BIGGEST CONCERN: ${state.answers.concerns?.answer || 'Unknown'}

PREVIOUS ATTEMPTS: ${state.answers.tried?.answer || 'None recorded'}

FILES: ${state.uploadedFiles.map(f => f.name).join(', ') || 'None'}
`;
  }

  // Categorize uploaded files
  categorizeFile(file) {
    const name = file.name.toLowerCase();
    if (name.includes('pitch') || name.includes('deck')) return 'pitch_deck';
    if (name.includes('plan') || name.includes('business')) return 'business_plan';
    if (name.includes('competitor') || name.includes('market')) return 'market_research';
    if (name.includes('financial') || name.includes('model')) return 'financial_model';
    if (name.includes('customer') || name.includes('research')) return 'customer_research';
    if (name.includes('product') || name.includes('screenshot')) return 'product_assets';
    return 'other';
  }

  // Database methods (implement with your DB)
  async saveOnboardingState(state) {
    // Implement with your database
    global.onboardingStates = global.onboardingStates || {};
    global.onboardingStates[state.founderId] = state;
  }

  async getOnboardingState(founderId) {
    global.onboardingStates = global.onboardingStates || {};
    return global.onboardingStates[founderId];
  }

  formatSummary(data) {
    return Object.entries(data)
      .map(([key, value]) => `**${key.replace(/_/g, ' ').toUpperCase()}**: ${value}`)
      .join('\n\n');
  }
}

module.exports = FounderOnboarding;
