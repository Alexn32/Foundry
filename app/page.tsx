'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Target, 
  Code, 
  TrendingUp, 
  DollarSign, 
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  Send,
  ChevronRight,
  Globe,
  Shield,
  BarChart3,
  Bell,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  agentId: string;
  type: string;
  status: string;
  approvalPrompt?: string;
  requiresApproval?: boolean;
  input: any;
  output?: any;
  createdAt: string;
}

interface Competitor {
  id: string;
  name: string;
  website: string;
  description?: string;
  threatLevel?: string;
}

const agents = [
  { id: 'competitor-intelligence', name: 'Competitor Intelligence', icon: <Target className="w-5 h-5" />, color: 'bg-red-500', description: 'Monitors competitors & market' },
  { id: 'code', name: 'Code Agent', icon: <Code className="w-5 h-5" />, color: 'bg-blue-500', description: 'Builds your product' },
  { id: 'marketing', name: 'Marketing Agent', icon: <TrendingUp className="w-5 h-5" />, color: 'bg-emerald-500', description: 'Drives growth & revenue' },
  { id: 'cfo', name: 'CFO Agent', icon: <DollarSign className="w-5 h-5" />, color: 'bg-amber-500', description: 'Tracks finances & runway' },
  { id: 'outreach', name: 'Outreach Agent', icon: <Users className="w-5 h-5" />, color: 'bg-purple-500', description: 'Handles partnerships' },
];

export default function FoundryDashboard() {
  const [activeAgent, setActiveAgent] = useState(agents[0]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const workspaceId = 'demo-workspace';

  useEffect(() => {
    const ws = new WebSocket('ws://3.142.164.117:3001/ws');
    ws.onopen = () => { setWsConnected(true); ws.send(JSON.stringify({ type: 'subscribe', workspaceId })); };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'task_created') setTasks(prev => [data.data, ...prev]);
    };
    ws.onclose = () => setWsConnected(false);
    return () => ws.close();
  }, [workspaceId]);

  const sendMessage = async () => {
    if (!inputValue.trim()) return;
    await fetch(`/api/workspaces/${workspaceId}/competitors/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productDescription: inputValue })
    });
    setInputValue('');
  };

  const approveTask = async (taskId: string) => {
    await fetch(`/api/tasks/${taskId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'founder-1' })
    });
  };

  const pendingTasks = tasks.filter(t => t.status === 'pending' && t.requiresApproval);

  return (
    <div className="flex h-screen bg-[#0a0a0f] text-zinc-100 overflow-hidden">
      {/* LEFT SIDEBAR */}
      <div className="w-72 bg-zinc-950 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-indigo-500/20">🎯</div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">Foundry</h1>
              <p className="text-xs text-zinc-500">AI Co-Founder Platform</p>
            </div>
          </div>
        </div>

        <div className={cn("px-4 py-2 flex items-center gap-2 text-xs border-b border-zinc-800", wsConnected ? "text-emerald-500" : "text-amber-500")}>
          <div className={cn("w-2 h-2 rounded-full", wsConnected ? "bg-emerald-500" : "bg-amber-500")} />
          {wsConnected ? "Connected" : "Reconnecting..."}
        </div>

        {pendingTasks.length > 0 && (
          <div className="mx-4 mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <div className="flex items-center gap-2 text-amber-500">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{pendingTasks.length} pending approval</span>
            </div>
          </div>
        )}

        <div className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-2">Your Team</p>
          <div className="space-y-1">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setActiveAgent(agent)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200 group',
                  activeAgent.id === agent.id
                    ? 'bg-zinc-800/80 text-white border border-zinc-700'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                )}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", agent.color.replace('bg-', 'bg-opacity-20 bg-'))}>
                  {agent.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{agent.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{agent.description}</p>
                </div>
                {agent.id === 'competitor-intelligence' && competitors.length > 0 && (
                  <span className="px-2 py-0.5 bg-zinc-800 rounded-full text-xs text-zinc-400">{competitors.length}</span>
                )}
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
              <p className="text-zinc-500">Active Tasks</p>
              <p className="text-lg font-semibold text-white">{tasks.filter(t => t.status === 'in_progress').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* MIDDLE - Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", activeAgent.color.replace('bg-', 'bg-opacity-20 bg-'))}>
              {activeAgent.icon}
            </div>
            <div>
              <h2 className="font-semibold">{activeAgent.name}</h2>
              <p className="text-xs text-zinc-500">{activeAgent.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"><Bell className="w-5 h-5" /></button>
            <button className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"><Settings className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeAgent.id === 'competitor-intelligence' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Globe className="w-5 h-5 text-zinc-400" />
                    <span className="text-sm text-zinc-400">Markets Tracked</span>
                  </div>
                  <p className="text-2xl font-bold">{competitors.length > 0 ? '1' : '0'}</p>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Shield className="w-5 h-5 text-zinc-400" />
                    <span className="text-sm text-zinc-400">High Threat</span>
                  </div>
                  <p className="text-2xl font-bold text-red-500">{competitors.filter(c => c.threatLevel === 'high').length}</p>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <BarChart3 className="w-5 h-5 text-zinc-400" />
                    <span className="text-sm text-zinc-400">Analyses</span>
                  </div>
                  <p className="text-2xl font-bold">{tasks.filter(t => t.type === 'analyze_competitor' && t.status === 'completed').length}</p>
                </div>
              </div>

              {pendingTasks.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Pending Your Approval</h3>
                  {pendingTasks.map(task => (
                    <div key={task.id} className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-amber-400 mb-1">{task.type === 'discover_competitors' ? '🔍 Discover Competitors' : '📊 Analyze Competitor'}</p>
                          <p className="text-sm text-zinc-300">{task.approvalPrompt}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => approveTask(task.id)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">Approve</button>
                          <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors">Modify</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {competitors.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Tracked Competitors</h3>
                  <div className="space-y-2">
                    {competitors.map(comp => (
                      <div key={comp.id} className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 flex items-center justify-between group hover:border-zinc-700 transition-colors">
                        <div>
                          <p className="font-medium">{comp.name}</p>
                          <a href={comp.website} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-500 hover:text-indigo-400">{comp.website}</a>
                        </div>
                        <div className="flex items-center gap-3">
                          {comp.threatLevel && (
                            <span className={cn("px-2 py-1 rounded text-xs font-medium", comp.threatLevel === 'high' ? "bg-red-500/20 text-red-400" : comp.threatLevel === 'medium' ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400")}>{comp.threatLevel} threat</span>
                          )}
                          <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Describe your product to discover competitors..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pr-14 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
                />
                <button onClick={sendMessage} disabled={!inputValue.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {activeAgent.id !== 'competitor-intelligence' && (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
              <div className="w-20 h-20 rounded-2xl bg-zinc-900 flex items-center justify-center">{activeAgent.icon}</div>
              <p className="text-lg">{activeAgent.name} coming soon</p>
              <p className="text-sm text-zinc-600">Currently building Competitor Intelligence Agent</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR - Activity */}
      <div className="w-80 bg-zinc-950 border-l border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="font-semibold flex items-center gap-2 text-sm"><Clock className="w-4 h-4 text-zinc-400" />Recent Activity</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {tasks.length === 0 && <p className="text-sm text-zinc-600 text-center py-8">No activity yet</p>}
            {tasks.slice(0, 10).map(task => (
              <div key={task.id} className="flex gap-3 p-3 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
                <div className="mt-0.5">
                  {task.status === 'completed' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : task.status === 'pending' ? <Clock className="w-4 h-4 text-amber-500" /> : <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300">{task.type === 'discover_competitors' ? 'Discovered competitors' : task.type === 'analyze_competitor' ? 'Analyzed competitor' : task.type}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded", task.status === 'completed' ? "bg-emerald-500/20 text-emerald-400" : task.status === 'pending' ? "bg-amber-500/20 text-amber-400" : "bg-indigo-500/20 text-indigo-400")}>{task.status}</span>
                    <span className="text-xs text-zinc-600">{new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
