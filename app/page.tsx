'use client';

import React, { useState, useEffect } from 'react';

const API_URL = 'https://foundry-production-7b5f.up.railway.app';

export default function Dashboard() {
  const [inputValue, setInputValue] = useState('');
  const [tasks, setTasks] = useState([]);
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

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
        setMessage('Task created! Click Approve below.');
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
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0f', color: 'white', padding: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>🎯 Foundry - Competitor Intelligence</h1>
      
      {message && (
        <div style={{ backgroundColor: '#064e3b', border: '1px solid #10b981', padding: '12px', borderRadius: '8px', marginBottom: '16px', color: '#10b981' }}>
          {message}
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Describe your product (e.g., 'A CRM for dentists')..."
          style={{ flex: 1, backgroundColor: '#18181b', border: '1px solid #3f3f46', padding: '12px', borderRadius: '8px', color: 'white' }}
        />
        <button
          onClick={discoverCompetitors}
          disabled={!inputValue.trim() || loading}
          style={{ backgroundColor: '#4f46e5', color: 'white', padding: '12px 24px', borderRadius: '8px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}
        >
          {loading ? '...' : 'Discover'}
        </button>
      </div>

      {/* Pending Approvals */}
      {pendingTasks.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '12px', color: '#f59e0b' }}>Pending Approval</h2>
          {pendingTasks.map(task => (
            <div key={task.id} style={{ backgroundColor: '#1c1917', border: '1px solid #f59e0b', padding: '16px', borderRadius: '8px', marginBottom: '8px' }}>
              <p style={{ marginBottom: '12px' }}>{task.approvalPrompt}</p>
              <button
                onClick={() => approveTask(task.id)}
                disabled={loading}
                style={{ backgroundColor: '#059669', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
              >
                {loading ? 'Running...' : 'Approve & Run'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Competitors */}
      {competitors.length > 0 && (
        <div>
          <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Discovered Competitors ({competitors.length})</h2>
          {competitors.map(comp => (
            <div key={comp.id} style={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', padding: '16px', borderRadius: '8px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 'bold' }}>{comp.name}</p>
                  <a href={comp.website} target="_blank" style={{ color: '#6b7280', fontSize: '14px' }}>{comp.website}</a>
                </div>
                <span style={{ backgroundColor: comp.threatLevel === 'high' ? '#7f1d1d' : comp.threatLevel === 'medium' ? '#78350f' : '#064e3b', color: comp.threatLevel === 'high' ? '#fca5a5' : comp.threatLevel === 'medium' ? '#fcd34d' : '#6ee7b7', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}>
                  {comp.threatLevel} threat
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
