'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const questions = [
  { id: 'stage', text: "What stage are you at? Just an idea, building the product, have early users, generating revenue, or scaling?" },
  { id: 'product', text: "What are you building, and what problem does it solve?" },
  { id: 'customer', text: "Who is your ideal customer? Be specific — what kind of person or company?" },
  { id: 'tried', text: "What have you already tried, and what happened?" },
  { id: 'revenue', text: "How do you make money today, or how do you plan to?" },
  { id: 'competitors', text: "Who are your main competitors? What do people do today instead of your solution?" },
  { id: 'budget', text: "What's your budget and runway situation?" },
  { id: 'success', text: "What does success look like in 90 days?" },
  { id: 'concerns', text: "What keeps you up at night? What's your biggest worry?" },
];

export default function OnboardingPage() {
  const [user, setUser] = useState<any>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = '/auth';
      return;
    }
    setUser(user);
    
    // Check if already completed onboarding
    const { data: profile } = await supabase
      .from('founder_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (profile?.onboarding_complete) {
      window.location.href = '/dashboard';
    }
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;
    
    setLoading(true);
    
    // Save answer
    const q = questions[currentQ];
    setAnswers({ ...answers, [q.id]: input });
    
    // Save to database
    await supabase.from('onboarding_answers').insert({
      user_id: user.id,
      question_id: q.id,
      question_text: q.text,
      answer_text: input,
    });
    
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
      setInput('');
    } else {
      // Generate summary
      await generateSummary();
    }
    
    setLoading(false);
  };

  const generateSummary = async () => {
    // Create founder profile with all answers
    const profileData = {
      user_id: user.id,
      stage: answers.stage,
      product_description: answers.product,
      problem_solved: answers.product, // Extracted from product
      ideal_customer: answers.customer,
      revenue_model: answers.revenue,
      competitors: { list: answers.competitors },
      budget_situation: answers.budget,
      goal_90_day: answers.success,
      biggest_concern: answers.concerns,
      extracted_data: answers,
    };
    
    await supabase.from('founder_profiles').insert(profileData);
    
    // Generate summary text
    const summaryText = `**The Business**: ${answers.product}

**The Problem**: ${answers.product}

**The Customer**: ${answers.customer}

**The Stage**: ${answers.stage}

**The Revenue Model**: ${answers.revenue}

**The Competition**: ${answers.competitors}

**The 90-Day Goal**: ${answers.success}

**The Constraints**: ${answers.budget}

**The Biggest Risk**: ${answers.concerns}`;
    
    setSummary(summaryText);
    setShowSummary(true);
  };

  const handleConfirm = async () => {
    await supabase
      .from('founder_profiles')
      .update({ 
        onboarding_complete: true, 
        confirmed_summary: summary,
        confirmed_at: new Date().toISOString()
      })
      .eq('user_id', user.id);
    
    await supabase
      .from('profiles')
      .update({ onboarding_complete: true })
      .eq('id', user.id);
    
    window.location.href = '/dashboard';
  };

  if (showSummary) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', color: 'white', padding: '20px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>🎯 Foundry - Confirm Your Profile</h1>
          
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
            <h2 style={{ marginBottom: '16px' }}>Here's what I understand about your business:</h2>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: '1.6', color: '#d1d5db' }}>
              {summary}
            </pre>
          </div>
          
          <p style={{ marginBottom: '20px', color: '#9ca3af' }}>Is this right? Does this capture your business accurately?</p>
          
          <button
            onClick={handleConfirm}
            style={{
              width: '100%',
              padding: '16px',
              background: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            ✅ Yes, This Looks Right
          </button>
          
          <button
            onClick={() => setShowSummary(false)}
            style={{
              width: '100%',
              padding: '16px',
              background: 'transparent',
              color: '#6b7280',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              fontSize: '16px',
              marginTop: '12px',
              cursor: 'pointer'
            }}
          >
            Edit Answers
          </button>
        </div>
      </div>
    );
  }

  const q = questions[currentQ];
  const progress = ((currentQ + 1) / questions.length) * 100;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: 'white', padding: '20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ height: '4px', background: '#27272a', borderRadius: '2px' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: '#4f46e5', borderRadius: '2px', transition: 'width 0.3s' }} />
          </div>
          <p style={{ textAlign: 'right', marginTop: '8px', fontSize: '14px', color: '#9ca3af' }}>
            Question {currentQ + 1} of {questions.length}
          </p>
        </div>

        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '24px' }}>
          <p style={{ fontSize: '18px', lineHeight: '1.6', marginBottom: '24px' }}>
            {q.text}
          </p>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your answer here..."
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '16px',
              background: '#0a0a0f',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              color: 'white',
              fontSize: '16px',
              resize: 'vertical',
              marginBottom: '16px'
            }}
          />

          <button
            onClick={handleSubmit}
            disabled={!input.trim() || loading}
            style={{
              width: '100%',
              padding: '16px',
              background: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
              opacity: !input.trim() || loading ? 0.7 : 1
            }}
          >
            {loading ? 'Saving...' : currentQ === questions.length - 1 ? 'Complete' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
