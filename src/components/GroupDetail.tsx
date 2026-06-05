import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Group, Profile, Expense, DebtSimplifyResult } from '../types';
import { calculateGroupBalances } from '../utils/balance';
import { AddExpenseModal } from './AddExpenseModal';
import { SettleUpModal } from './SettleUpModal';
import { ArrowLeft, Plus, ChevronDown, ChevronUp, Trash2, HelpCircle, Check } from 'lucide-react';

interface GroupDetailProps {
  groupId: string;
  currentUser: Profile;
  onBack: () => void;
  onExpensesChanged: () => void; // Notify parent to refresh overall stats
}

export const GroupDetail: React.FC<GroupDetailProps> = ({
  groupId,
  currentUser,
  onBack,
  onExpensesChanged
}) => {
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Balances calculations
  const [netBalances, setNetBalances] = useState<Record<string, number>>({});
  const [simplifiedDebts, setSimplifiedDebts] = useState<DebtSimplifyResult[]>([]);

  // Navigation tabs inside group
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances'>('expenses');
  
  // Expanded expense items
  const [expandedExpenses, setExpandedExpenses] = useState<Record<string, boolean>>({});

  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);

  // Triggers for re-fetching
  const [triggerFetch, setTriggerFetch] = useState(0);

  useEffect(() => {
    fetchGroupAndExpenses();
  }, [groupId, triggerFetch]);

  const fetchGroupAndExpenses = async () => {
    try {
      setLoading(true);

      // 1. Fetch Group Details with Members
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select(`
          *,
          group_members(
            profiles(*)
          )
        `)
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;

      const mappedGroup: Group = {
        id: groupData.id,
        name: groupData.name,
        description: groupData.description,
        created_by: groupData.created_by,
        created_at: groupData.created_at,
        members: groupData.group_members.map((gm: any) => gm.profiles)
      };

      setGroup(mappedGroup);

      // 2. Fetch Expenses with Payer Profile and Splits
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          *,
          payer_profile:profiles!expenses_paid_by_fkey(*),
          expense_splits(
            *,
            profile:profiles(*)
          )
        `)
        .eq('group_id', groupId)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (expensesError) throw expensesError;

      const mappedExpenses: Expense[] = (expensesData || []).map((e: any) => ({
        id: e.id,
        group_id: e.group_id,
        paid_by: e.paid_by,
        amount: Number(e.amount),
        description: e.description,
        category: e.category,
        expense_date: e.expense_date,
        created_at: e.created_at,
        payer_profile: e.payer_profile,
        splits: e.expense_splits.map((s: any) => ({
          id: s.id,
          expense_id: s.expense_id,
          user_id: s.user_id,
          amount: Number(s.amount),
          profile: s.profile
        }))
      }));

      setExpenses(mappedExpenses);

      // 3. Compute balances
      const { netBalances: calculatedBalances, simplifiedDebts: debts } = calculateGroupBalances(
        mappedGroup.members || [],
        mappedExpenses
      );

      setNetBalances(calculatedBalances);
      setSimplifiedDebts(debts);

    } catch (err) {
      console.error('Error loading group details:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpenseExpand = (expenseId: string) => {
    setExpandedExpenses(prev => ({
      ...prev,
      [expenseId]: !prev[expenseId]
    }));
  };

  const handleExpenseAdded = () => {
    setTriggerFetch(prev => prev + 1);
    onExpensesChanged();
  };

  const handleDeleteExpense = async (expenseId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggling expand when clicking delete
    
    if (!window.confirm('Are you sure you want to delete this expense?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;
      
      handleExpenseAdded();
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense.');
    }
  };

  if (loading && !group) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <p className="text-secondary">Loading group...</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
        <p className="text-debt">Group not found.</p>
        <button onClick={onBack} className="btn btn-secondary btn-sm mt-4">
          Go Back
        </button>
      </div>
    );
  }

  const userBalance = netBalances[currentUser.id] || 0;

  return (
    <div>
      {/* 1. Header Navigation */}
      <button onClick={onBack} className="btn btn-secondary btn-sm mb-4" style={{ display: 'inline-flex', padding: '6px 12px' }}>
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      {/* 2. Group Info Card */}
      <div className="card" style={{ borderBottom: '4px solid var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 className="text-2xl font-bold">{group.name}</h2>
            {group.description && <p className="text-sm text-secondary mt-1">{group.description}</p>}
            
            {/* Balance banner */}
            <div className="mt-4">
              {userBalance > 0 ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--credit-light)', color: 'var(--credit)', fontWeight: '700', fontSize: '0.875rem' }}>
                  You are owed ${userBalance.toFixed(2)} in this group
                </div>
              ) : userBalance < 0 ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--debt-light)', color: 'var(--debt)', fontWeight: '700', fontSize: '0.875rem' }}>
                  You owe ${Math.abs(userBalance).toFixed(2)} in this group
                </div>
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--bg-base)', color: 'var(--text-secondary)', fontWeight: '700', fontSize: '0.875rem' }}>
                  You are settled up in this group
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setIsSettleModalOpen(true)} className="btn btn-secondary btn-sm">
              Settle Up
            </button>
            <button onClick={() => setIsExpenseModalOpen(true)} className="btn btn-primary btn-sm">
              <Plus size={16} /> Add Expense
            </button>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="split-tabs" style={{ marginBottom: '16px' }}>
        <button
          type="button"
          className={`split-tab ${activeTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setActiveTab('expenses')}
        >
          Expenses
        </button>
        <button
          type="button"
          className={`split-tab ${activeTab === 'balances' ? 'active' : ''}`}
          onClick={() => setActiveTab('balances')}
        >
          Balances & Debts
        </button>
      </div>

      {/* 4. Tab Content */}
      {activeTab === 'expenses' ? (
        <div>
          {expenses.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
              <HelpCircle size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', marginInline: 'auto' }} />
              <h4 className="font-bold mb-2">No expenses yet</h4>
              <p className="text-sm text-secondary mb-4">Keep track of shared costs by adding bills, groceries, rent, etc.</p>
              <button onClick={() => setIsExpenseModalOpen(true)} className="btn btn-primary btn-sm">
                Add First Expense
              </button>
            </div>
          ) : (
            <div className="list-container">
              {expenses.map((expense) => {
                const isExpanded = !!expandedExpenses[expense.id];
                const isPayerCurrentUser = expense.paid_by === currentUser.id;
                
                // Find current user's split for this expense
                const userSplit = expense.splits?.find(s => s.user_id === currentUser.id);
                const userOwesAmount = userSplit ? userSplit.amount : 0;

                // Format date
                const expDate = new Date(expense.expense_date);
                const month = expDate.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
                const day = expDate.getDate();

                const isSettlement = expense.category === 'settlement';

                return (
                  <div key={expense.id} className="card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', marginBottom: '10px' }} onClick={() => toggleExpenseExpand(expense.id)}>
                    {/* Collapsed view row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {/* Calendar Icon display */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.625rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{month}</span>
                          <span style={{ fontSize: '1.125rem', fontWeight: '800', lineHeight: 1 }}>{day}</span>
                        </div>

                        {/* Category Symbol / Text */}
                        <div className={`category-icon cat-${expense.category}`} style={{ width: '40px', height: '40px', borderRadius: '50%' }}>
                          {isSettlement ? <Check size={18} /> : expense.description.substring(0, 1).toUpperCase()}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="font-semibold text-primary">{expense.description}</span>
                          <span className="text-xs text-secondary">
                            {isPayerCurrentUser ? 'You' : expense.payer_profile?.display_name || 'Someone'} paid <strong>${expense.amount.toFixed(2)}</strong>
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ textAlign: 'right' }}>
                          {isSettlement ? (
                            <span className="text-xs font-semibold text-credit" style={{ backgroundColor: 'var(--credit-light)', padding: '2px 8px', borderRadius: '4px' }}>
                              settlement
                            </span>
                          ) : isPayerCurrentUser ? (
                            <>
                              <span className="text-xs text-muted">you lent</span>
                              <span className="text-sm font-bold text-credit" style={{ display: 'block' }}>
                                ${(expense.amount - userOwesAmount).toFixed(2)}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-xs text-muted">you borrowed</span>
                              <span className="text-sm font-bold text-debt" style={{ display: 'block' }}>
                                ${userOwesAmount.toFixed(2)}
                              </span>
                            </>
                          )}
                        </div>
                        {isExpanded ? <ChevronUp size={18} className="text-secondary" /> : <ChevronDown size={18} className="text-secondary" />}
                      </div>
                    </div>

                    {/* Expanded view details */}
                    {isExpanded && (
                      <div style={{ backgroundColor: 'var(--bg-base)', padding: '16px', borderTop: '1px solid var(--border)' }}>
                        <h5 className="text-xs font-bold text-secondary uppercase mb-2">Split Details</h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {expense.splits?.map(split => (
                            <div key={split.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                              <span className="font-medium">
                                {split.user_id === currentUser.id ? 'You (Logged In)' : split.profile?.display_name}
                              </span>
                              <span className="font-semibold">
                                owes ${split.amount.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', marginTop: '12px', paddingTop: '12px' }}>
                          <span className="text-xs text-secondary">
                            Added on {new Date(expense.created_at).toLocaleDateString()}
                          </span>
                          
                          {/* Allow deletion by Payer or Group Creator */}
                          {(isPayerCurrentUser || group.created_by === currentUser.id) && (
                            <button
                              onClick={(e) => handleDeleteExpense(expense.id, e)}
                              className="btn btn-danger btn-sm"
                              style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: 'var(--radius-sm)' }}
                            >
                              <Trash2 size={14} /> Delete Expense
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Balances & Debts Tab */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
          
          {/* Debts Simplification Summary */}
          <div className="card">
            <h3 className="text-md font-bold mb-4 flex items-center gap-2 text-primary">
              <Check size={18} /> Simplified Debt Summary
            </h3>
            
            {simplifiedDebts.length === 0 ? (
              <p className="text-sm text-secondary" style={{ textAlign: 'center', padding: '16px 0' }}>
                Everyone is completely settled up! No payments required.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {simplifiedDebts.map((debt, index) => {
                  const isUserSender = debt.from === currentUser.id;
                  const isUserReceiver = debt.to === currentUser.id;

                  return (
                    <div key={index} className="list-item" style={{ cursor: 'default', borderLeft: isUserSender ? '4px solid var(--debt)' : isUserReceiver ? '4px solid var(--credit)' : '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="list-item-avatar" style={{ width: '36px', height: '36px', fontSize: '0.875rem' }}>
                          {debt.fromName.substring(0, 2).toUpperCase()}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', fontSize: '0.875rem' }}>
                          <strong>{isUserSender ? 'You' : debt.fromName}</strong> 
                          <span className="text-secondary">owes</span> 
                          <strong>{isUserReceiver ? 'You' : debt.toName}</strong>
                        </div>
                      </div>
                      <span className={`font-bold ${isUserSender ? 'text-debt' : isUserReceiver ? 'text-credit' : 'text-primary'}`}>
                        ${debt.amount.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Individual Net Balances */}
          <div className="card">
            <h3 className="text-md font-bold mb-4 flex items-center gap-2">
              Group Members Details
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {group.members?.map(member => {
                const bal = netBalances[member.id] || 0;
                return (
                  <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }} className="py-2">
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div className="list-item-avatar" style={{ width: '36px', height: '36px', fontSize: '0.875rem' }}>
                        {member.display_name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="font-semibold text-sm">
                        {member.display_name} {member.id === currentUser.id && '(You)'}
                      </span>
                    </div>
                    
                    <span className={`text-sm font-bold ${bal > 0 ? 'text-credit' : bal < 0 ? 'text-debt' : 'text-secondary'}`}>
                      {bal > 0 ? `+` : ''}${bal.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {isExpenseModalOpen && (
        <AddExpenseModal
          groupId={groupId}
          members={group.members || []}
          currentUser={currentUser}
          onClose={() => setIsExpenseModalOpen(false)}
          onExpenseAdded={handleExpenseAdded}
        />
      )}

      {isSettleModalOpen && (
        <SettleUpModal
          groupId={groupId}
          members={group.members || []}
          currentUser={currentUser}
          simplifiedDebts={simplifiedDebts}
          onClose={() => setIsSettleModalOpen(false)}
          onSettleAdded={handleExpenseAdded}
        />
      )}
    </div>
  );
};
