'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = '/auth';
      return;
    }
    setUser(user);

    // Get founder profile
    const { data: founderProfile } = await supabase
      .from('founder_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!founderProfile) {
      window.location.href = '/onboarding';
      return;
    }

    setProfile(founderProfile);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  if (!user || !profile) return <div style={{ padding: 40, color: 'white' }}>Loading...</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: 'white', padding: '20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px' }}>🎯 Foundry Dashboard</h1>
          <button
            onClick={handleSignOut}
            style={{ background: 'transparent', border: '1px solid #3f3f46', color: '#9ca3af', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
          >
            Sign Out
          </button>
        </div>

        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Welcome, {user.email}</h2>
          <p style={{ color: '#9ca3af' }}>Your AI co-founder is ready to help you build.</p>
        </div>

        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '16px', color: '#10b981' }}>Your Business Profile</h3>
          <p><strong>Stage:</strong> {profile.stage}</p>
          <p><strong>Product:</strong> {profile.product_description}</p>
          <p><strong>Customer:</strong> {profile.ideal_customer}</p>
          <p><strong>Revenue Model:</strong> {profile.revenue_model}</p>
        </div>

        <div style={{ marginTop: '32px', textAlign: 'center', color: '#6b7280' }}>
          <p>Full dashboard coming soon...</p>
        </div>
      </div>
    </div>
  );
}
