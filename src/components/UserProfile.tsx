import React, { useState, useEffect } from 'react';
import { supabase, clearSupabaseCredentials } from '../supabaseClient';
import type { Profile } from '../types';
import { User, Mail, ShieldAlert, LogOut, Database, Check } from 'lucide-react';

interface UserProfileProps {
  currentUser: Profile;
  onLogout: () => void;
  onProfileUpdated: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  currentUser,
  onLogout,
  onProfileUpdated
}) => {
  const [displayName, setDisplayName] = useState(currentUser.display_name);
  const [updating, setUpdating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [groupCount, setGroupCount] = useState(0);

  const isLocalStored = !!localStorage.getItem('SPLITX_SUPABASE_URL');

  useEffect(() => {
    fetchUserStats();
  }, [currentUser.id]);

  const fetchUserStats = async () => {
    try {
      const { count, error } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id);
      
      if (error) throw error;
      setGroupCount(count || 0);
    } catch (err) {
      console.error('Error fetching user stats:', err);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!displayName.trim()) {
      setError('Name cannot be empty.');
      return;
    }

    try {
      setUpdating(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);

      if (error) throw error;
      
      setSuccess(true);
      onProfileUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setUpdating(false);
    }
  };

  const handleClearCredentials = () => {
    if (window.confirm('Are you sure you want to disconnect from this Supabase project? This will reset the app connection settings.')) {
      clearSupabaseCredentials();
    }
  };

  return (
    <div style={{ maxWidth: '500px', marginInline: 'auto' }}>
      {/* 1. Profile card */}
      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '12px 0' }}>
          <div className="list-item-avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', fontSize: '2rem', background: 'var(--primary-light)', color: 'var(--primary)' }}>
            {currentUser.display_name.substring(0, 2).toUpperCase()}
          </div>
          <h2 className="text-xl font-bold">{currentUser.display_name}</h2>
          <span style={{ fontSize: '0.8125rem', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', padding: '4px 12px', borderRadius: 'var(--radius-full)', fontWeight: '600' }}>
            Active in {groupCount} {groupCount === 1 ? 'Group' : 'Groups'}
          </span>
        </div>
      </div>

      {/* 2. Edit Profile Info */}
      <div className="card">
        <h3 className="text-md font-bold mb-4">Edit Profile details</h3>

        {error && <div className="auth-error">{error}</div>}
        {success && (
          <div style={{ backgroundColor: 'var(--credit-light)', color: 'var(--credit)', border: '1px solid rgba(45, 159, 125, 0.2)', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <Check size={16} /> Profile updated successfully!
          </div>
        )}

        <form onSubmit={handleUpdateProfile}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">Full Name</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
              <input
                id="name"
                type="text"
                className="input-control"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{ paddingLeft: '36px' }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address (Read-only)</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
              <input
                type="email"
                className="input-control"
                value={currentUser.email}
                disabled
                style={{ paddingLeft: '36px', opacity: 0.6, cursor: 'not-allowed', backgroundColor: 'var(--bg-base)' }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full mt-2"
            disabled={updating}
          >
            {updating ? 'Saving...' : 'Update Name'}
          </button>
        </form>
      </div>

      {/* 3. Connection and Actions */}
      <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
        <h3 className="text-md font-bold mb-2 flex items-center gap-2">
          <Database size={18} className="text-muted" /> Connection Settings
        </h3>
        <p className="text-xs text-secondary mb-4">
          This client is currently communicating with your Supabase database instance.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {isLocalStored && (
            <button
              onClick={handleClearCredentials}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignSelf: 'start', borderColor: '#f59e0b', color: '#b45309' }}
            >
              Disconnect Supabase Project
            </button>
          )}

          <button
            onClick={onLogout}
            className="btn btn-danger btn-full"
            style={{ display: 'inline-flex', gap: '8px', marginTop: '10px' }}
          >
            <LogOut size={16} /> Sign Out of Account
          </button>
        </div>
      </div>
    </div>
  );
};
