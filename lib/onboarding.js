// Enhanced Founder Onboarding with Smart Follow-ups
// Asks follow-up questions until we have sufficient detail

const { Anthropic } = require('@anthropic-ai/sdk');

class FounderOnboarding {
  constructor(anthropicClient) {
    this.anthropic = anthropicClient;
    
    // Information requirements for each category
    this.informationRequirements = {
      stage: {
        required: ['current_stage', 'key_metrics', 'time_in_stage'],
        validate: (info) => info.current_stage && info.details && info.details.length > 20
      },
      product: {
        required: ['what_it_is', 'problem_solved', 'unique_approach'],
        validate: (info) => info.what_it_is && info.problem_solved && 
          (info.what_it_is.length > 30) && (info.problem_solved.length > 30)
      },
      customer: {
        required: ['who_they_are', 'pain_points', 'decision_maker'],
        validate: (info) => info.who_they_are && info.who_they_are.length > 25
      },
      tried: {
        required: ['what_was_attempted', 'results', 'learnings'],
        validate: (info) => info.what_was_attempted && info.results
      },
      revenue: {
        required: ['model', 'price_point', 'target_arr'],
        validate: (info) => info.model && info.model.length > 10
      },
      competitors: {
        required: ['named_competitors', 'alternatives', 'differentiation'],
        validate: (info) => (info.named_competitors && info.named_competitors.length > 0) || 
          (info.alternatives && info.alternatives.length > 20)
      },
      budget: {
        required: ['budget_range', 'runway_months', 'funding_status'],
        validate: (info) => info.budget_range || info.runway_months
      },
      success_90: {
        required: ['specific_metrics', 'milestones', 'success_criteria'],
        validate: (info) => info.specific_metrics && info.specific_metrics.length > 20
      },
      concerns: {
        required: ['biggest_worry', 'risk_factors', 'blockers'],
        validate: (info) => info.biggest_worry && info.biggest_worry.length > 15
      }
    };

    this.questions = [
      {
        id: 'stage',
        text: "What stage are you at right now? Just an idea, building the product, have early users, generating revenue, or scaling?",
        category: 'stage',
        type: 'open_ended',
        probingQuestions: [
          "How long have you been at this stage?",
          "What's the main thing you're focused on right now?",
          "What metrics are you tracking to know you're making progress?"
        ]
      },
      {
        id: 'product',
        text: "What are you building, and what problem does it solve?",
        category: 'product',
        type: 'open_ended',
        probingQuestions: [
          "Tell me more about the problem. When does someone feel this pain most acutely?",
          "How are people solving this today without your product?",
          "What makes your approach different or better?",
          "Who feels this pain most intensely?"
        ]
      },
      {
        id: 'customer',
        text: "Who is your ideal customer? Be specific — what kind of person or company, what size, what industry?",
        category: 'customer',
        type: 'open_ended',
        probingQuestions: [
          "What specific characteristics make them ideal?",
          "What job are they trying to get done?",
          "Who makes the buying decision? Is it the same person who uses it?",
          "Can you give me an example of a perfect customer?"
        ]
      },
      {
        id: 'tried',
        text: "What have you already tried, and what happened?",
        category: 'tried',
        type: 'open_ended',
        probingQuestions: [
          "What did you actually do? Walk me through it.",
          "What were the specific results — numbers if you have them?",
          "What did you learn from this? What would you do differently?",
          "Why do you think it didn't work as expected?"
        ]
      },
      {
        id: 'revenue',
        text: "How do you make money today, or how do you plan to?",
        category: 'revenue',
        type: 'open_ended',
        probingQuestions: [
          "What's your pricing model? One-time, subscription, usage-based?",
          "How much do you charge, or what are you thinking?",
          "What's your target revenue in the next year?",
          "Who pays — the user or someone else?"
        ]
      },
      {
        id: 'competitors',
        text: "Who are your main competitors? Even if you think you don't have any, what do people do today instead of using your solution?",
        category: 'competitors',
        type: 'open_ended',
        probingQuestions: [
          "Can you name 2-3 specific companies?",
          "What do people do now if they don't use a product for this?",
          "How are you different from them? Why would someone choose you?",
          "What are they better at than you?"
        ]
      },
      {
        id: 'budget',
        text: "What's your budget and runway situation? How much can you spend, and how much time do you have before you need to show results?",
        category: 'budget',
        type: 'open_ended',
        probingQuestions: [
          "What's your monthly budget for tools, services, and help?",
          "How many months of runway do you have?",
          "Are you bootstrapped, funded, or generating revenue?",
          "What happens if you don't hit your goals in that timeframe?"
        ]
      },
      {
        id: 'success_90',
        text: "What does success look like in 90 days? If we crushed it this quarter, what would have happened?",
        category: 'success_90',
        type: 'open_ended',
        probingQuestions: [
          "Be specific — what metrics would move? By how much?",
          "What would be true in 90 days that's not true now?",
          "What milestones would you hit?",
          "How would you know for certain it was a successful quarter?"
        ]
      },
      {
        id: 'concerns',
        text: "What keeps you up at night? What's the thing you're most worried about right now?",
        category: 'concerns',
        type: 'open_ended',
        probingQuestions: [
          "Why does this worry you specifically?",
          "What would happen if this fear came true?",
          "What are you doing to mitigate this risk?",
          "Is this a new concern or something that's been lingering?"
        ]
      }
    ];
  }

  // Evaluate if we have sufficient information (cost-optimized)
  async evaluateAnswerQuality(category, answer, conversationHistory) {
    // Quick heuristic check first (no API call) - saves ~70% of costs
    const wordCount = answer.split(/\s+/).length;
    const hasSpecifics = /\d+|\$|percent|month|year|customer|user|revenue|problem|solution|market|competitor/i.test(answer);
    
    // If answer is very short and vague, likely insufficient
    if (wordCount < 5) {
      return { 
        sufficient: false, 
        missing: ['more detail'], 
        follow_up_question: "Can you tell me more about that?",
        clarity_score: 3 
      };
    }
    
    // If answer is substantial and has specifics, likely sufficient
    if (wordCount > 20 && hasSpecifics) {
      return { sufficient: true, missing: [], clarity_score: 8 };
    }
    
    // Only use AI for borderline cases (saves ~70% of API calls)
    const prompt = `Briefly evaluate: "${answer.substring(0, 200)}"

Category: ${category}

Respond with JSON only:
{"sufficient": boolean, "missing": ["key missing info"], "clarity_score": 1-10}`;

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',  // Cheapest model at $0.25/1M tokens
        max_tokens: 150,  // Keep it short = cheaper
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      });

      const response = message.content[0].text;
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        result.follow_up_question = result.missing?.[0] 
          ? `Can you tell me more about ${result.missing[0]}?`
          : "Can you elaborate on that?";
        return result;
      }
      
      return { sufficient: true, missing: [], clarity_score: 7 };
    } catch (error) {
      console.error('Evaluation error:', error);
      return { sufficient: true, missing: [], clarity_score: 7 };
    }
  }

  getRequirementsForCategory(category) {
    const reqs = this.informationRequirements[category];
    if (!reqs) return '- General detail and clarity';
    return reqs.required.map(r => `- ${r.replace(/_/g, ' ')}`).join('\n');
  }

  // Main answer processing with follow-ups
  async processAnswer(founderId, answer, files = []) {
    const state = await this.getOnboardingState(founderId);
    
    if (!state) {
      throw new Error('Onboarding not started');
    }

    const currentQuestion = this.questions[state.currentQuestionIndex];
    const category = currentQuestion.category;
    
    // Store the answer
    if (!state.answers[category]) {
      state.answers[category] = {
        question: currentQuestion.text,
        responses: [],
        extractedInfo: {},
        answeredAt: new Date().toISOString()
      };
    }

    state.answers[category].responses.push({
      answer: answer,
      timestamp: new Date().toISOString()
    });

    // Evaluate answer quality
    const evaluation = await this.evaluateAnswerQuality(
      category, 
      answer, 
      state.answers[category].responses
    );

    // Extract structured information from answer
    const extractedInfo = await this.extractInformation(category, answer, state.answers[category].responses);
    state.answers[category].extractedInfo = extractedInfo;

    // Store files
    if (files.length > 0) {
      for (const file of files) {
        state.uploadedFiles.push({
          id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          category: this.categorizeFile(file),
          uploadedAt: new Date().toISOString(),
          linkedToQuestion: category
        });
      }
    }

    // Check if we need follow-up questions
    const needsMoreInfo = !evaluation.sufficient || evaluation.clarity_score < 6;
    const followUpCount = state.answers[category].responses.length - 1;
    const maxFollowUps = 3;

    if (needsMoreInfo && followUpCount < maxFollowUps) {
      // Generate contextual follow-up
      const followUpQuestion = await this.generateFollowUp(
        currentQuestion,
        state.answers[category].responses,
        evaluation.missing,
        extractedInfo
      );

      state.lastMessageAt = new Date().toISOString();
      await this.saveOnboardingState(state);

      return {
        type: 'follow_up',
        message: followUpQuestion,
        question: {
          ...currentQuestion,
          isFollowUp: true,
          followUpNumber: followUpCount + 1
        },
        progress: { 
          current: state.currentQuestionIndex + 1, 
          total: this.questions.length,
          followUp: followUpCount + 1
        },
        canUploadFiles: true,
        evaluation: evaluation,
        extractedInfo: extractedInfo
      };
    }

    // Move to next question
    state.currentQuestionIndex++;
    state.lastMessageAt = new Date().toISOString();

    // Check if onboarding complete
    if (state.currentQuestionIndex >= this.questions.length) {
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
        uploadedFiles: state.uploadedFiles,
        extractedData: this.compileExtractedData(state)
      };
    }

    // Get next question with transition
    const nextQuestion = this.questions[state.currentQuestionIndex];
    const transition = await this.generateTransition(
      currentQuestion, 
      nextQuestion, 
      state.answers[category].responses,
      extractedInfo
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

  // Extract structured information from answer (cost-optimized)
  async extractInformation(category, answer, previousResponses) {
    // Combine all responses
    const allResponses = previousResponses.map(r => r.answer).join('. ');
    
    // Shorter prompt = cheaper
    const prompt = `Extract key info about ${category} from: "${allResponses.substring(0, 400)}"

Return JSON with relevant fields. Be specific. Use null if missing.`;

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',  // Cheapest
        max_tokens: 400,  // Shorter = cheaper
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }]
      });

      const response = message.content[0].text;
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch (error) {
      return {};
    }
  }

  // Generate contextual follow-up question
  async generateFollowUp(question, responses, missingInfo, extractedInfo) {
    const allAnswers = responses.map(r => r.answer).join('\n\n');
    const missingList = missingInfo.join(', ');
    
    const prompt = `Generate a natural follow-up question to get missing information.

Original question: "${question.text}"

What they've said so far:
${allAnswers}

Missing information: ${missingList}

Already extracted: ${JSON.stringify(extractedInfo)}

Generate a conversational follow-up that:
1. Acknowledges what they've already shared
2. Specifically asks for the missing information
3. Sounds natural, not like an interrogation
4. Is 1-2 sentences max

Follow-up question:`;

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }]
      });

      return message.content[0].text.trim();
    } catch (error) {
      // Fallback to predefined probing questions
      const followUpIndex = responses.length - 1;
      if (followUpIndex < question.probingQuestions.length) {
        return question.probingQuestions[followUpIndex];
      }
      return "Can you tell me a bit more about that?";
    }
  }

  // Generate transition to next question
  async generateTransition(currentQuestion, nextQuestion, responses, extractedInfo) {
    const lastAnswer = responses[responses.length - 1]?.answer || '';
    
    const prompt = `Generate a natural transition to the next question.

They just answered questions about: ${currentQuestion.category}
Their last response: "${lastAnswer.substring(0, 200)}..."

Next topic: ${nextQuestion.category}
Next question: "${nextQuestion.text}"

Generate a 1-2 sentence transition that:
1. Briefly acknowledges their previous answer
2. Naturally leads into the next topic
3. Sounds conversational, not robotic

Transition:`;

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 150,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }]
      });

      return message.content[0].text.trim();
    } catch (error) {
      return `Got it. ${nextQuestion.text}`;
    }
  }

  // Generate final summary
  async generateSummary(state) {
    const compiledData = this.compileExtractedData(state);
    
    const prompt = `Create a comprehensive business summary based on this founder's answers.

EXTRACTED INFORMATION:
${JSON.stringify(compiledData, null, 2)}

Create a summary in this format:

---
**The Business**: [One sentence what they do]

**The Problem**: [The pain they solve, be specific about who feels it and when]

**The Customer**: [Ideal customer profile with specifics]

**The Stage**: [Current stage with timeline and key metrics]

**The Revenue Model**: [How they make money with pricing details]

**The Competition**: [Main competitors and alternatives]

**The 90-Day Goal**: [Specific, measurable goals]

**The Constraints**: [Budget, runway, and key challenges]

**The Biggest Risk**: [Primary concern and why it matters]
---

Use specific details from their answers. Be concise but comprehensive.`;

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1500,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      });

      const summaryText = message.content[0].text;
      const summaryData = this.parseSummary(summaryText);

      return {
        message: `Here's what I understand about your business:\n\n${summaryText}\n\nIs this right? Does this capture your business accurately? You can confirm, correct anything, or add what's missing.`,
        data: summaryData,
        rawText: summaryText,
        extractedData: compiledData
      };
    } catch (error) {
      return {
        message: "I've gathered your information. Let me summarize...",
        data: compiledData,
        rawText: JSON.stringify(compiledData, null, 2)
      };
    }
  }

  // Compile all extracted information
  compileExtractedData(state) {
    const data = {};
    for (const [category, answerData] of Object.entries(state.answers)) {
      data[category] = answerData.extractedInfo || {};
    }
    return data;
  }

  // Parse summary text
  parseSummary(text) {
    const sections = {};
    const lines = text.split('\n');

    for (const line of lines) {
      const match = line.match(/\*\*(.+?)\*\*:\s*(.+)/);
      if (match) {
        const key = match[1].toLowerCase().replace(/\s+/g, '_');
        sections[key] = match[2].trim();
      }
    }

    return sections;
  }

  // Start onboarding
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

    await this.saveOnboardingState(onboardingState);

    return {
      message: "Hey! I'm Clyde, your AI co-founder. I'm going to ask you some questions to understand your business — not like a form, more like a conversation with a smart advisor who actually listens. Ready?",
      question: this.questions[0],
      progress: { current: 1, total: this.questions.length },
      canUploadFiles: true
    };
  }

  // Confirm summary
  async confirmSummary(founderId, confirmation) {
    const state = await this.getOnboardingState(founderId);
    
    if (confirmation.action === 'confirm') {
      state.status = 'completed';
      state.confirmedAt = new Date().toISOString();
      state.confirmedSummary = state.summary;
      
      const profile = await this.createFounderProfile(state);
      await this.saveOnboardingState(state);
      
      return {
        type: 'complete',
        message: "Perfect! Your profile is locked in. Your agents now have full context and will never make you repeat yourself.",
        profile: profile
      };
    } else if (confirmation.action === 'edit') {
      state.corrections = state.corrections || [];
      state.corrections.push({
        field: confirmation.field,
        correction: confirmation.value,
        timestamp: new Date().toISOString()
      });
      
      state.summary.data[confirmation.field] = confirmation.value;
      await this.saveOnboardingState(state);
      
      return {
        type: 'summary_updated',
        message: `Got it. I've updated that. Here's the corrected summary. Anything else?`,
        summary: state.summary.data
      };
    }
  }

  // Create founder profile
  async createFounderProfile(state) {
    const compiledData = this.compileExtractedData(state);
    
    return {
      founderId: state.founderId,
      workspaceId: state.workspaceId,
      createdAt: state.startedAt,
      confirmedAt: state.confirmedAt,
      
      extractedData: compiledData,
      summary: state.summary?.data,
      
      files: state.uploadedFiles,
      
      agentContext: this.formatAgentContext(state),
      
      agentOutputs: [],
      decisions: [],
      metrics: {}
    };
  }

  formatAgentContext(state) {
    const data = this.compileExtractedData(state);
    return `FOUNDER PROFILE\n===============\n\n${Object.entries(data).map(([cat, info]) => `${cat.toUpperCase()}: ${JSON.stringify(info)}`).join('\n\n')}`;
  }

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

  // Database methods
  async saveOnboardingState(state) {
    global.onboardingStates = global.onboardingStates || {};
    global.onboardingStates[state.founderId] = state;
  }

  async getOnboardingState(founderId) {
    global.onboardingStates = global.onboardingStates || {};
    return global.onboardingStates[founderId];
  }
}

module.exports = FounderOnboarding;
