import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { Profile } from './types';
import { SetupWarning } from './components/SetupWarning';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { GroupDetail } from './components/GroupDetail';
import { RecentActivity } from './components/RecentActivity';
import { UserProfile } from './components/UserProfile';
import { Users, Activity, User, LogOut } from 'lucide-react';
import './App.css';

function App() {
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'group-detail' | 'activity' | 'profile'>('dashboard');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [expensesTrigger, setExpensesTrigger] = useState(0);

  // 1. Listen to Auth State changes and setup user session
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Subscribe to auth shifts
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSessionUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setSessionUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setUserProfile(data);
      } else {
        // Profile doesn't exist - create one for manually created users
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User';
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              email: user.email || '',
              display_name: displayName,
            })
            .select()
            .single();

          if (createError) {
            // If creation fails, try fetching once more
            const { data: retryData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .maybeSingle();
            if (retryData) setUserProfile(retryData);
          } else {
            setUserProfile(newProfile);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setSessionUser(null);
    setUserProfile(null);
    setCurrentView('dashboard');
    setSelectedGroupId(null);
    setLoading(false);
  };

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    setCurrentView('group-detail');
  };

  const handleBackToDashboard = () => {
    setSelectedGroupId(null);
    setCurrentView('dashboard');
  };

  const refreshOverallStats = () => {
    setExpensesTrigger(prev => prev + 1);
  };

  // Case A: Supabase project is not configured yet
  if (!isSupabaseConfigured) {
    return <SetupWarning />;
  }

  // Case B: User not logged in
  if (!sessionUser) {
    return <Auth onAuthSuccess={() => {}} />;
  }

  // Case C: Loading user profile
  if (loading && !userProfile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-base)' }}>
        <div className="auth-logo" style={{ marginBottom: '16px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style={{ width: '48px', height: '48px' }}>
            <rect width="512" height="512" rx="128" fill="#1cc29f" />
            <path d="M150 150 L362 362" stroke="white" stroke-width="48" stroke-linecap="round" />
            <path d="M362 150 L150 362" stroke="white" stroke-width="48" stroke-linecap="round" />
            <circle cx="256" cy="130" r="36" fill="#ffffff" />
            <circle cx="256" cy="382" r="36" fill="#ffffff" />
          </svg>
          <span style={{ fontSize: '1.5rem', fontWeight: '800' }}>SplitX</span>
        </div>
        <p className="text-secondary" style={{ fontSize: '0.875rem' }}>Loading your session...</p>
      </div>
    );
  }

  // Safe check
  if (!userProfile) {
    return <Auth onAuthSuccess={() => {}} />;
  }

  return (
    <>
      {/* Top Header */}
      <header className="header">
        <div className="header-brand" style={{ cursor: 'pointer' }} onClick={handleBackToDashboard}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
            <rect width="512" height="512" rx="128" fill="#1cc29f" />
            <path d="M150 150 L362 362" stroke="white" stroke-width="48" stroke-linecap="round" />
            <path d="M362 150 L150 362" stroke="white" stroke-width="48" stroke-linecap="round" />
            <circle cx="256" cy="130" r="36" fill="#ffffff" />
            <circle cx="256" cy="382" r="36" fill="#ffffff" />
          </svg>
          <span>SplitX</span>
        </div>

        <div className="header-user">
          <button 
            type="button" 
            className="btn-text" 
            style={{ padding: '4px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            onClick={() => setCurrentView('profile')}
          >
            <div className="list-item-avatar" style={{ width: '32px', height: '32px', fontSize: '0.75rem', margin: 0 }}>
              {userProfile.display_name.substring(0, 2).toUpperCase()}
            </div>
            <span className="text-sm font-semibold hide-on-mobile">{userProfile.display_name}</span>
          </button>
        </div>
      </header>

      {/* Main Responsive Layout Wrapper */}
      <div className="app-container">
        
        {/* Sidebar (Visible on Desktop only) */}
        <aside className="sidebar">
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <button
              onClick={handleBackToDashboard}
              className={`btn ${currentView === 'dashboard' || currentView === 'group-detail' ? 'btn-primary' : 'btn-secondary'} btn-full`}
              style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
            >
              <Users size={18} /> Groups
            </button>
            <button
              onClick={() => setCurrentView('activity')}
              className={`btn ${currentView === 'activity' ? 'btn-primary' : 'btn-secondary'} btn-full`}
              style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
            >
              <Activity size={18} /> Activity
            </button>
            <button
              onClick={() => setCurrentView('profile')}
              className={`btn ${currentView === 'profile' ? 'btn-primary' : 'btn-secondary'} btn-full`}
              style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
            >
              <User size={18} /> Profile
            </button>
          </nav>

          <button
            onClick={handleLogout}
            className="btn btn-secondary btn-full"
            style={{ justifyContent: 'flex-start', padding: '12px 16px', border: '1px solid transparent', color: 'var(--debt)' }}
          >
            <LogOut size={18} /> Sign Out
          </button>
        </aside>

        {/* Dynamic Main Content Panel */}
        <main className="main-content">
          {currentView === 'dashboard' && (
            <Dashboard
              currentUser={userProfile}
              onSelectGroup={handleSelectGroup}
              expensesTrigger={expensesTrigger}
            />
          )}

          {currentView === 'group-detail' && selectedGroupId && (
            <GroupDetail
              groupId={selectedGroupId}
              currentUser={userProfile}
              onBack={handleBackToDashboard}
              onExpensesChanged={refreshOverallStats}
            />
          )}

          {currentView === 'activity' && (
            <RecentActivity
              currentUser={userProfile}
              onSelectGroup={handleSelectGroup}
            />
          )}

          {currentView === 'profile' && (
            <UserProfile
              currentUser={userProfile}
              onLogout={handleLogout}
              onProfileUpdated={() => fetchProfile(userProfile.id)}
            />
          )}
        </main>

        {/* Bottom Navigation (Visible on Mobile only) */}
        <nav className="mobile-nav">
          <div
            className={`nav-link ${currentView === 'dashboard' || currentView === 'group-detail' ? 'active' : ''}`}
            onClick={handleBackToDashboard}
          >
            <Users />
            <span>Groups</span>
          </div>
          <div
            className={`nav-link ${currentView === 'activity' ? 'active' : ''}`}
            onClick={() => setCurrentView('activity')}
          >
            <Activity />
            <span>Activity</span>
          </div>
          <div
            className={`nav-link ${currentView === 'profile' ? 'active' : ''}`}
            onClick={() => setCurrentView('profile')}
          >
            <User />
            <span>Profile</span>
          </div>
        </nav>

      </div>
    </>
  );
}

export default App;
