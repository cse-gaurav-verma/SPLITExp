import React, { useState } from 'react';
import { saveSupabaseCredentials } from '../supabaseClient';

export const SetupWarning: React.FC = () => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !key) {
      setError('Please provide both the Supabase URL and the Anon Key.');
      return;
    }
    if (!url.startsWith('https://')) {
      setError('The Supabase URL must start with https://');
      return;
    }
    saveSupabaseCredentials(url.trim(), key.trim());
  };

  return (
    <div className="setup-overlay">
      <div className="setup-card">
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div className="auth-logo">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
              <rect width="512" height="512" rx="128" fill="#1cc29f" />
              <path d="M150 150 L362 362" stroke="white" stroke-width="48" stroke-linecap="round" />
              <path d="M362 150 L150 362" stroke="white" stroke-width="48" stroke-linecap="round" />
              <circle cx="256" cy="130" r="36" fill="#ffffff" />
              <circle cx="256" cy="382" r="36" fill="#ffffff" />
            </svg>
            <span>SplitX</span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '12px' }}>Supabase Connection Required</h2>
          <p className="text-secondary" style={{ fontSize: '0.875rem', marginTop: '8px' }}>
            To run this application, you must connect it to your Supabase project.
          </p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <div className="card" style={{ backgroundColor: 'var(--bg-base)', border: 'none', marginBottom: '24px' }}>
          <h3 className="text-sm font-bold mb-2">Option A: Configure Local Environment</h3>
          <p className="text-xs text-secondary" style={{ lineHeight: '1.5' }}>
            1. Copy the file <code style={{ background: 'var(--border)', padding: '2px 4px', borderRadius: '4px' }}>.env.example</code> to <code style={{ background: 'var(--border)', padding: '2px 4px', borderRadius: '4px' }}>.env</code> in your project folder.<br />
            2. Open <code style={{ background: 'var(--border)', padding: '2px 4px', borderRadius: '4px' }}>.env</code> and fill in your Supabase project credentials.<br />
            3. Restart the development server.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ background: 'var(--bg-surface)', padding: '0 8px', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
              OR OPTION B: PASTE CREDENTIALS BELOW
            </span>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'var(--border)', zIndex: -1 }}></div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="url">Supabase URL</label>
            <input
              id="url"
              type="text"
              className="input-control"
              placeholder="https://your-project.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="key">Supabase Anon Key</label>
            <input
              id="key"
              type="password"
              className="input-control"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full mt-4">
            Connect & Save
          </button>
        </form>
        
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <a
            href="https://supabase.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.75rem', fontWeight: '600' }}
          >
            Don't have a Supabase project? Create one for free
          </a>
        </div>
      </div>
    </div>
  );
};
