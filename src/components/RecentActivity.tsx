import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Profile, Expense } from '../types';
import { Activity, Calendar, User, Info, AlertCircle } from 'lucide-react';

interface RecentActivityProps {
  currentUser: Profile;
  onSelectGroup: (groupId: string) => void;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ currentUser, onSelectGroup }) => {
  const [expenses, setExpenses] = useState<(Expense & { group_name: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGlobalActivity();
  }, [currentUser.id]);

  const fetchGlobalActivity = async () => {
    try {
      setLoading(true);

      // 1. Fetch group IDs the user belongs to
      const { data: memberGroups, error: groupsError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', currentUser.id);

      if (groupsError) throw groupsError;

      if (!memberGroups || memberGroups.length === 0) {
        setExpenses([]);
        return;
      }

      const groupIds = memberGroups.map(mg => mg.group_id);

      // 2. Fetch expenses across all these groups
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          *,
          payer_profile:profiles!expenses_paid_by_fkey(*),
          groups(name)
        `)
        .in('group_id', groupIds)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (expensesError) throw expensesError;

      const mapped: (Expense & { group_name: string })[] = (expensesData || []).map((e: any) => ({
        id: e.id,
        group_id: e.group_id,
        paid_by: e.paid_by,
        amount: Number(e.amount),
        description: e.description,
        category: e.category,
        expense_date: e.expense_date,
        created_at: e.created_at,
        payer_profile: e.payer_profile,
        group_name: e.groups?.name || 'Unknown Group'
      }));

      setExpenses(mapped);
    } catch (err) {
      console.error('Error fetching global activity:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <p className="text-secondary">Loading activity feed...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
          <Activity className="text-primary" /> Recent Activity
        </h2>
        <p className="text-sm text-secondary">Keep track of updates across all your shared groups</p>
      </div>

      {expenses.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <AlertCircle size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', marginInline: 'auto' }} />
          <h4 className="font-bold mb-2">No activity yet</h4>
          <p className="text-sm text-secondary">Once you or your group members start adding expenses, they will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {expenses.map((expense) => {
            const isPayerCurrentUser = expense.paid_by === currentUser.id;
            const formattedDate = new Date(expense.expense_date).toLocaleDateString(undefined, {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });
            const isSettlement = expense.category === 'settlement';

            return (
              <div
                key={expense.id}
                className="list-item"
                onClick={() => onSelectGroup(expense.group_id)}
              >
                <div className="list-item-left">
                  {/* Category icon */}
                  <div className={`category-icon cat-${expense.category}`}>
                    <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>
                      {expense.description.substring(0, 1).toUpperCase()}
                    </span>
                  </div>

                  <div className="list-item-info">
                    <span className="list-item-name">{expense.description}</span>
                    <span className="list-item-desc" style={{ fontSize: '0.8125rem' }}>
                      {isPayerCurrentUser ? 'You' : expense.payer_profile?.display_name} paid{' '}
                      <strong>${expense.amount.toFixed(2)}</strong> in <strong>{expense.group_name}</strong>
                    </span>
                  </div>
                </div>

                <div className="list-item-right" style={{ justifyContent: 'center' }}>
                  <span className="text-xs text-muted flex items-center gap-1">
                    <Calendar size={12} /> {formattedDate}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
