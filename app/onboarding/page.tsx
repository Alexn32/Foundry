'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Paperclip, 
  CheckCircle, 
  ChevronRight,
  FileText,
  Loader2,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingState {
  founderId: string;
  workspaceId: string;
  status: 'in_progress' | 'awaiting_confirmation' | 'completed';
  currentQuestionIndex: number;
  answers: Record<string, any>;
  uploadedFiles: any[];
  summary?: any;
}

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  type?: 'question' | 'answer' | 'summary' | 'system';
  question?: any;
  progress?: { current: number; total: number };
}

export default function Onboarding() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [files, setFiles] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const founderId = 'founder-' + Date.now();
  const workspaceId = 'workspace-' + Date.now();

  // Start onboarding on mount
  useEffect(() => {
    startOnboarding();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startOnboarding = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/onboarding/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ founderId, workspaceId })
      });
      
      const data = await response.json();
      
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: data.message,
          type: 'system'
        },
        {
          id: '2',
          role: 'assistant',
          content: data.question.text,
          type: 'question',
          question: data.question,
          progress: data.progress
        }
      ]);
      
      setOnboardingState({
        founderId,
        workspaceId,
        status: 'in_progress',
        currentQuestionIndex: 0,
        answers: {},
        uploadedFiles: []
      });
    } catch (error) {
      console.error('Failed to start onboarding:', error);
    }
    setIsLoading(false);
  };

  const sendAnswer = async () => {
    if (!inputValue.trim() && files.length === 0) return;
    
    setIsLoading(true);
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue || `Uploaded ${files.length} file(s)`,
      type: 'answer'
    };
    setMessages(prev => [...prev, userMessage]);
    
    try {
      // Upload files if any
      let uploadedFiles = [];
      if (files.length > 0) {
        const fileData = files.map(f => ({
          name: f.name,
          type: f.type,
          size: f.size
        }));
        
        const uploadRes = await fetch('/api/onboarding/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ founderId, files: fileData })
        });
        
        const uploadData = await uploadRes.json();
        uploadedFiles = uploadData.files || [];
        setFiles([]);
      }
      
      // Send answer
      const response = await fetch('/api/onboarding/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          founderId, 
          answer: inputValue,
          files: uploadedFiles
        })
      });
      
      const data = await response.json();
      
      if (data.type === 'summary') {
        // Show summary for confirmation
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.message,
          type: 'summary'
        }]);
        setSummaryData(data.summary);
        setShowSummary(true);
      } else {
        // Next question
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.message,
          type: 'system'
        }, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.question.text,
          type: 'question',
          question: data.question,
          progress: data.progress
        }]);
      }
      
      setInputValue('');
    } catch (error) {
      console.error('Failed to send answer:', error);
    }
    
    setIsLoading(false);
  };

  const confirmSummary = async (action: 'confirm' | 'edit' | 'add', details?: any) => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/onboarding/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          founderId,
          confirmation: { action, ...details }
        })
      });
      
      const data = await response.json();
      
      if (data.type === 'complete') {
        // Onboarding complete
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.message,
          type: 'system'
        }]);
        setShowSummary(false);
        
        // Redirect to dashboard after delay
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 3000);
      } else {
        // Summary updated
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.message,
          type: 'system'
        }]);
        setSummaryData(data.summary);
      }
    } catch (error) {
      console.error('Failed to confirm:', error);
    }
    
    setIsLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100 flex flex-col">
      {/* Header */}
      <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-indigo-500/20">
            🎯
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">Foundry</h1>
            <p className="text-xs text-zinc-500">AI Co-Founder Onboarding</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Target className="w-4 h-4" />
          <span>Building your founder profile</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        <div className="space-y-6">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-4',
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              {/* Avatar */}
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                message.role === 'user' 
                  ? 'bg-zinc-800' 
                  : 'bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/30'
              )}>
                {message.role === 'user' ? (
                  <span className="text-sm font-medium">You</span>
                ) : (
                  <span className="text-xl">🎯</span>
                )}
              </div>

              {/* Content */}
              <div className={cn(
                'max-w-[80%]',
                message.role === 'user' ? 'items-end' : 'items-start'
              )}>
                <div className={cn(
                  'px-5 py-3.5 rounded-2xl',
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : message.type === 'question'
                    ? 'bg-zinc-900 border border-zinc-800 text-zinc-200'
                    : message.type === 'summary'
                    ? 'bg-emerald-900/30 border border-emerald-500/30 text-zinc-200'
                    : 'bg-zinc-900/50 text-zinc-300'
                )}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  
                  {/* Progress indicator for questions */}
                  {message.progress && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                      <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 rounded-full transition-all"
                          style={{ width: `${(message.progress.current / message.progress.total) * 100}%` }}
                        />
                      </div>
                      <span>{message.progress.current} / {message.progress.total}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/30">
                <span className="text-xl">🎯</span>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 px-5 py-4 rounded-2xl">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Summary Confirmation Modal */}
      {showSummary && summaryData && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-zinc-800">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
                Confirm Your Business Profile
              </h2>
              <p className="text-zinc-400 mt-1">Review and confirm this accurately represents your business</p>
            </div>
            
            <div className="p-6 space-y-4">
              {Object.entries(summaryData).map(([key, value]) => (
                <div key={key} className="bg-zinc-950/50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                    {key.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm text-zinc-200">{value as string}</p>
                </div>
              ))}
            </div>
            
            <div className="p-6 border-t border-zinc-800 flex gap-3">
              <button
                onClick={() => confirmSummary('confirm')}
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {isLoading ? 'Creating Profile...' : 'This Looks Right'}
              </button>
              <button
                onClick={() => {
                  const correction = prompt('What needs to be corrected?');
                  if (correction) {
                    const field = prompt('Which field? (the_business, the_problem, the_customer, etc.)');
                    if (field) {
                      confirmSummary('edit', { field, value: correction });
                    }
                  }
                }}
                disabled={isLoading}
                className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium transition-colors"
              >
                Edit Something
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      {!showSummary && (
        <div className="border-t border-zinc-800 bg-zinc-950/50 p-4">
          <div className="max-w-3xl mx-auto">
            {/* File attachments */}
            {files.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-lg text-sm">
                    <FileText className="w-4 h-4 text-zinc-400" />
                    <span className="text-zinc-300 truncate max-w-[150px]">{file.name}</span>
                    <button 
                      onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                      className="text-zinc-500 hover:text-zinc-300"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="relative flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                className="hidden"
              />
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-xl transition-colors"
                title="Attach files"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && sendAnswer()}
                placeholder="Type your answer..."
                disabled={isLoading}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
              />
              
              <button
                onClick={sendAnswer}
                disabled={(!inputValue.trim() && files.length === 0) || isLoading}
                className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-zinc-600 mt-2 text-center">
              You can upload pitch decks, business plans, research — anything that adds context
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
