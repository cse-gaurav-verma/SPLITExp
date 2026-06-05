import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Group, Profile, Expense } from '../types';
import { calculateGroupBalances } from '../utils/balance';
import { Plus, Users, X, UserPlus, Info } from 'lucide-react';

interface DashboardProps {
  currentUser: Profile;
  onSelectGroup: (groupId: string) => void;
  expensesTrigger: number; // Used to trigger reload when things change
}

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, onSelectGroup, expensesTrigger }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBalances, setGroupBalances] = useState<Record<string, number>>({});
  const [totalOwed, setTotalOwed] = useState(0); // Owed to current user (positive balances)
  const [totalOwe, setTotalOwe] = useState(0);   // Current user owes (negative balances)
  const [recentExpenses, setRecentExpenses] = useState<(Expense & { group_name?: string })[]>([]);
  
  // Create Group Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [groupMembers, setGroupMembers] = useState<Profile[]>([currentUser]);
  const [memberError, setMemberError] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // Fetch groups and recent activity
  useEffect(() => {
    fetchDashboardData();
  }, [currentUser.id, expensesTrigger]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch groups where current user is a member
      const { data: memberGroups, error: groupsError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', currentUser.id);

      if (groupsError) throw groupsError;

      if (!memberGroups || memberGroups.length === 0) {
        setGroups([]);
        setGroupBalances({});
        setTotalOwed(0);
        setTotalOwe(0);
        setRecentExpenses([]);
        return;
      }

      const groupIds = memberGroups.map(mg => mg.group_id);

      // Fetch group details along with profiles of members
      const { data: groupsData, error: detailsError } = await supabase
        .from('groups')
        .select(`
          *,
          group_members(
            profiles(*)
          )
        `)
        .in('id', groupIds)
        .order('created_at', { ascending: false });

      if (detailsError) throw detailsError;

      // Map profiles into groups
      const mappedGroups: Group[] = (groupsData || []).map((g: any) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        created_by: g.created_by,
        created_at: g.created_at,
        members: g.group_members.map((gm: any) => gm.profiles)
      }));

      setGroups(mappedGroups);

      // 2. Fetch expenses and splits for all these groups to calculate balances
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          *,
          expense_splits(*)
        `)
        .in('group_id', groupIds);

      if (expensesError) throw expensesError;

      // Calculate balance in each group for current user
      const balances: Record<string, number> = {};
      let calculatedTotalOwed = 0;
      let calculatedTotalOwe = 0;

      mappedGroups.forEach(group => {
        const groupExpenses = (expensesData || []).filter(e => e.group_id === group.id);
        const { netBalances } = calculateGroupBalances(group.members || [], groupExpenses);
        
        const userBal = netBalances[currentUser.id] || 0;
        balances[group.id] = userBal;

        if (userBal > 0) {
          calculatedTotalOwed += userBal;
        } else if (userBal < 0) {
          calculatedTotalOwe += Math.abs(userBal);
        }
      });

      setGroupBalances(balances);
      setTotalOwed(calculatedTotalOwed);
      setTotalOwe(calculatedTotalOwe);

      // 3. Fetch recent expenses for activity log
      const { data: recentExp, error: recentExpError } = await supabase
        .from('expenses')
        .select(`
          *,
          payer_profile:profiles!expenses_paid_by_fkey(display_name),
          groups(name)
        `)
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentExpError) throw recentExpError;

      setRecentExpenses((recentExp || []).map((re: any) => ({
        id: re.id,
        group_id: re.group_id,
        paid_by: re.paid_by,
        amount: re.amount,
        description: re.description,
        category: re.category,
        expense_date: re.expense_date,
        created_at: re.created_at,
        payer_profile: re.payer_profile,
        group_name: re.groups?.name
      })));

    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Add a member by email to the group creation list
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError('');

    const email = memberEmail.trim().toLowerCase();
    if (!email) return;

    if (groupMembers.some(m => m.email.toLowerCase() === email)) {
      setMemberError('User is already added.');
      return;
    }

    try {
      // Find user profile by email in database
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setMemberError('User not found. They must sign up first before being added to a group.');
        return;
      }

      setGroupMembers([...groupMembers, data]);
      setMemberEmail('');
    } catch (err: any) {
      setMemberError('Error searching for user.');
    }
  };

  const handleRemoveMember = (userId: string) => {
    if (userId === currentUser.id) return; // Cannot remove yourself
    setGroupMembers(groupMembers.filter(m => m.id !== userId));
  };

  // Handle Create Group Submission
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!newGroupName.trim()) {
      setCreateError('Group name is required.');
      return;
    }

    try {
      setCreating(true);

      // 1. Create the Group
      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: newGroupName.trim(),
          description: newGroupDesc.trim(),
          created_by: currentUser.id
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // 2. Add members to group_members
      const memberInserts = groupMembers.map(member => ({
        group_id: newGroup.id,
        user_id: member.id
      }));

      const { error: membersError } = await supabase
        .from('group_members')
        .insert(memberInserts);

      if (membersError) throw membersError;

      // Reset Form & Close Modal
      setNewGroupName('');
      setNewGroupDesc('');
      setGroupMembers([currentUser]);
      setIsModalOpen(false);
      
      // Refresh dashboard
      fetchDashboardData();
    } catch (err: any) {
      setCreateError(err.message || 'Error creating group.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <p className="text-secondary">Loading dashboard...</p>
      </div>
    );
  }

  const netBalance = totalOwed - totalOwe;

  return (
    <div>
      {/* 1. Header with Stats Summary */}
      <div className="card" style={{ padding: '24px 20px', background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--primary-light) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 className="text-xl font-bold">Welcome, {currentUser.display_name}</h2>
            <p className="text-sm text-secondary">Here is your summary across all groups</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="btn btn-primary"
            style={{ borderRadius: 'var(--radius-full)' }}
          >
            <Plus size={18} /> New Group
          </button>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <span className="summary-card-title">Total Balance</span>
            <span className={`summary-card-value ${netBalance > 0 ? 'credit' : netBalance < 0 ? 'debt' : 'text-secondary'}`}>
              {netBalance > 0 ? `+` : ''}${Math.abs(netBalance).toFixed(2)}
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-card-title">You Owe</span>
            <span className="summary-card-value debt">
              ${totalOwe.toFixed(2)}
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-card-title">You Are Owed</span>
            <span className="summary-card-value credit">
              ${totalOwed.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Content Panels (Groups list & Recent activity) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', alignItems: 'start' }} className="mt-4">
        {/* Groups Column */}
        <div>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Users size={20} className="text-primary" /> Your Groups ({groups.length})
          </h3>
          {groups.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', marginInline: 'auto' }} />
              <h4 className="font-bold mb-2">No groups yet</h4>
              <p className="text-sm text-secondary mb-4">Create a group to start splitting bills with your friends, roommates, or family.</p>
              <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-sm">
                Create Group
              </button>
            </div>
          ) : (
            <div className="list-container">
              {groups.map((group) => {
                const bal = groupBalances[group.id] || 0;
                return (
                  <div
                    key={group.id}
                    className="list-item"
                    onClick={() => onSelectGroup(group.id)}
                  >
                    <div className="list-item-left">
                      <div className="list-item-avatar">
                        {group.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="list-item-info">
                        <span className="list-item-name">{group.name}</span>
                        <span className="list-item-desc">
                          {group.members?.length} {group.members?.length === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                    </div>
                    <div className="list-item-right">
                      {bal > 0 ? (
                        <>
                          <span className="text-xs text-muted">you are owed</span>
                          <span className="text-sm font-bold text-credit">${bal.toFixed(2)}</span>
                        </>
                      ) : bal < 0 ? (
                        <>
                          <span className="text-xs text-muted">you owe</span>
                          <span className="text-sm font-bold text-debt">${Math.abs(bal).toFixed(2)}</span>
                        </>
                      ) : (
                        <span className="text-sm font-semibold text-secondary">settled up</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity Column */}
        {recentExpenses.length > 0 && (
          <div className="card" style={{ marginTop: '16px' }}>
            <h3 className="text-md font-bold mb-4">Recent Activity</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentExpenses.map((exp) => {
                const date = new Date(exp.expense_date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric'
                });
                return (
                  <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }} className="py-2">
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div className={`category-icon cat-${exp.category}`} style={{ width: '36px', height: '36px' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
                          {exp.description.substring(0, 1).toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="text-sm font-semibold">{exp.description}</span>
                        <span className="text-xs text-secondary">
                          {exp.payer_profile?.display_name || 'Someone'} paid ${Number(exp.amount).toFixed(2)} in <strong>{exp.group_name}</strong>
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-muted font-medium">{date}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Create Group Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Create a New Group</span>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {createError && <div className="auth-error">{createError}</div>}

            <form onSubmit={handleCreateGroup}>
              <div className="form-group">
                <label className="form-label" htmlFor="groupName">Group Name</label>
                <input
                  id="groupName"
                  type="text"
                  className="input-control"
                  placeholder="e.g., Apartment 202, Road Trip 2026"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="groupDesc">Description (Optional)</label>
                <input
                  id="groupDesc"
                  type="text"
                  className="input-control"
                  placeholder="Short description"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                />
              </div>

              {/* Members input section */}
              <div className="card" style={{ borderStyle: 'dashed', padding: '16px', backgroundColor: 'var(--bg-base)', marginBottom: '16px' }}>
                <h4 className="text-sm font-bold mb-2">Group Members ({groupMembers.length})</h4>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                  {groupMembers.map((member) => (
                    <span
                      key={member.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'var(--bg-surface)',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        border: '1px solid var(--border)'
                      }}
                    >
                      {member.display_name} {member.id === currentUser.id && '(You)'}
                      {member.id !== currentUser.id && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="email"
                    className="input-control"
                    placeholder="friend@email.com"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddMember}
                    className="btn btn-secondary btn-sm"
                    style={{ borderRadius: 'var(--radius-sm)' }}
                  >
                    <UserPlus size={16} /> Add
                  </button>
                </div>
                {memberError && <p className="text-xs text-debt mt-2">{memberError}</p>}
                
                <p className="text-xs text-muted mt-2 flex items-center gap-1">
                  <Info size={12} /> Add members by entering the email they registered with.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
