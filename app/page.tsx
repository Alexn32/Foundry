'use client';

import { useState, useEffect } from 'react';
import { Target, Code, TrendingUp, DollarSign, Users, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const API_URL = 'https://foundry-production-7b5f.up.railway.app';

const agents = [
  { id: 'competitor-intelligence', name: 'Competitor Intel', icon: <Target className="w-5 h-5" />, color: 'bg-red-500', description: 'Monitors market' },
  { id: 'code', name: 'Code Agent', icon: <Code className="w-5 h-5" />, color: 'bg-blue-500', description: 'Builds product' },
  { id: 'marketing', name: 'Marketing', icon: <TrendingUp className="w-5 h-5" />, color: 'bg-emerald-500', description: 'Drives growth' },
  { id: 'cfo', name: 'CFO Agent', icon: <DollarSign className="w-5 h-5" />, color: 'bg-amber-500', description: 'Tracks finances' },
  { id: 'outreach', name: 'Outreach', icon: <Users className="w-5 h-5" />, color: 'bg-purple-500', description: 'Partnerships' },
];

export default function Dashboard() {
  const [activeAgent, setActiveAgent] = useState(agents[0]);
  const [inputValue, setInputValue] = useState('');
  const [tasks, setTasks] = useState([]);
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch data on load
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/workspaces/demo`);
      const data = await res.json();
      if (data.tasks) setTasks(data.tasks);
      if (data.competitors) setCompetitors(data.competitors);
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  const discoverCompetitors = async () => {
    if (!inputValue.trim()) return;
    setLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/api/workspaces/demo/competitors/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productDescription: inputValue })
      });
      const data = await res.json();
      
      if (data.taskId) {
        setMessage('Task created! Waiting for your approval...');
        await fetchData();
      }
    } catch (error) {
      setMessage('Error: ' + error.message);
    }
    
    setLoading(false);
  };

  const approveTask = async (taskId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/tasks/${taskId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'founder-1' })
      });
      const data = await res.json();
      
      if (data.success) {
        setMessage(`Found ${data.competitorsFound} competitors!`);
        setCompetitors(data.competitors || []);
        await fetchData();
      }
    } catch (error) {
      setMessage('Error: ' + error.message);
    }
    setLoading(false);
  };

  const pendingTasks = tasks.filter(t => t.status === 'pending' && t.requiresApproval);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-xl">🎯</div>
            <div>
              <h1 className="font-bold text-lg">Foundry</h1>
              <p className="text-xs text-zinc-500">AI Co-Founder</p>
            </div>
          </div>
        </div>

        {pendingTasks.length > 0 && (
          <div className="mx-4 mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <div className="flex items-center gap-2 text-amber-500">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{pendingTasks.length} pending</span>
            </div>
          </div>
        )}

        <div className="flex-1 px-3 py-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-2">Your Team</p>
          <div className="space-y-1">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setActiveAgent(agent)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${
                  activeAgent.id === agent.id
                    ? 'bg-zinc-800 text-white border border-zinc-700'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${agent.color.replace('bg-', 'bg-opacity-20 bg-')}`}>
                  {agent.icon}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{agent.name}</p>
                  <p className="text-xs text-zinc-500">{agent.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-zinc-900/50 rounded-lg p-2">
              <p className="text-zinc-500">Competitors</p>
              <p className="text-lg font-semibold text-white">{competitors.length}</p>
            </div>
            <div className="bg-zinc-900/50 rounded-lg p-2">
              <p className="text-zinc-500">Tasks</p>
              <p className="text-lg font-semibold text-white">{tasks.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeAgent.color.replace('bg-', 'bg-opacity-20 bg-')}`}>
              {activeAgent.icon}
            </div>
            <div>
              <h2 className="font-semibold">{activeAgent.name}</h2>
              <p className="text-xs text-zinc-500">{activeAgent.description}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeAgent.id === 'competitor-intelligence' && (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                  <p className="text-sm text-zinc-400">Tracked</p>
                  <p className="text-2xl font-bold">{competitors.length}</p>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                  <p className="text-sm text-zinc-400">High Threat</p>
                  <p className="text-2xl font-bold text-red-500">
                    {competitors.filter(c => c.threatLevel === 'high').length}
                  </p>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                  <p className="text-sm text-zinc-400">Tasks</p>
                  <p className="text-2xl font-bold">{tasks.length}</p>
                </div>
              </div>

              {/* Message */}
              {message && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-emerald-400">
                  {message}
                </div>
              )}

              {/* Pending Approvals */}
              {pendingTasks.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase">Pending Approval</h3>
                  {pendingTasks.map(task => (
                    <div key={task.id} className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                      <p className="text-amber-400 mb-2">{task.approvalPrompt}</p>
                      <button
                        onClick={() => approveTask(task.id)}
                        disabled={loading}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white rounded-lg text-sm font-medium"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve & Run'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Competitors List */}
              {competitors.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase">Discovered Competitors</h3>
                  {competitors.map(comp => (
                    <div key={comp.id} className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{comp.name}</p>
                          <a href={comp.website} target="_blank" className="text-xs text-zinc-500 hover:text-indigo-400">{comp.website}</a>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          comp.threatLevel === 'high' ? 'bg-red-500/20 text-red-400' :
                          comp.threatLevel === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {comp.threatLevel}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !loading && discoverCompetitors()}
                  placeholder="Describe your product (e.g., 'A CRM for dentists')..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pr-14 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
                />
                <button
                  onClick={discoverCompetitors}
                  disabled={!inputValue.trim() || loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {activeAgent.id !== 'competitor-intelligence' && (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
              <div className="w-20 h-20 rounded-2xl bg-zinc-900 flex items-center justify-center">
                {activeAgent.icon}
              </div>
              <p className="text-lg">{activeAgent.name} coming soon</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
