import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

interface AuthProps {
  onAuthSuccess: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (isSignUp && !displayName.trim()) {
      setError('Please enter your name.');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              display_name: displayName.trim(),
            },
          },
        });

        if (signUpError) throw signUpError;
        
        if (data.session) {
          // Instantly logged in
          onAuthSuccess();
        } else {
          // Confirmation email might be enabled
          setMessage('Registration successful! Please check your email for confirmation link.');
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) throw signInError;
        onAuthSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
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
          <p className="auth-subtitle">
            {isSignUp ? 'Create an account to start splitting' : 'Log in to manage your balances'}
          </p>
        </div>

        <div className="split-tabs">
          <button
            type="button"
            className={`split-tab ${!isSignUp ? 'active' : ''}`}
            onClick={() => {
              setIsSignUp(false);
              setError('');
              setMessage('');
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`split-tab ${isSignUp ? 'active' : ''}`}
            onClick={() => {
              setIsSignUp(true);
              setError('');
              setMessage('');
            }}
          >
            Sign Up
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {message && <div style={{ backgroundColor: 'var(--credit-light)', color: 'var(--credit)', border: '1px solid rgba(45, 159, 125, 0.2)', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', marginBottom: '20px', textAlign: 'center' }}>{message}</div>}

        <form onSubmit={handleAuth}>
          {isSignUp && (
            <div className="form-group">
              <label className="form-label" htmlFor="displayName">Full Name</label>
              <input
                id="displayName"
                type="text"
                className="input-control"
                placeholder="John Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="input-control"
              placeholder="john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full mt-4"
            disabled={loading}
          >
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          {isSignUp ? (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                className="btn-text"
                style={{ padding: 0, fontSize: 'inherit', fontWeight: 'bold' }}
                onClick={() => setIsSignUp(false)}
              >
                Sign In here
              </button>
            </p>
          ) : (
            <p>
              New to SplitX?{' '}
              <button
                type="button"
                className="btn-text"
                style={{ padding: 0, fontSize: 'inherit', fontWeight: 'bold' }}
                onClick={() => setIsSignUp(true)}
              >
                Create an account
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
