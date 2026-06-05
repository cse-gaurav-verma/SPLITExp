import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Profile } from '../types';
import { X, DollarSign, Calendar, Tag, User } from 'lucide-react';

interface AddExpenseModalProps {
  groupId: string;
  members: Profile[];
  currentUser: Profile;
  onClose: () => void;
  onExpenseAdded: () => void;
}

const CATEGORIES = [
  { value: 'food', label: 'Food & Dining' },
  { value: 'rent', label: 'Rent & Living' },
  { value: 'utilities', label: 'Bills & Utilities' },
  { value: 'travel', label: 'Travel & Transport' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'general', label: 'General / Other' }
];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  groupId,
  members,
  currentUser,
  onClose,
  onExpenseAdded
}) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('general');
  const [paidBy, setPaidBy] = useState(currentUser.id);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().substring(0, 10));
  const [splitType, setSplitType] = useState<'equal' | 'unequal'>('equal');
  
  // Track equal split checkbox states
  const [checkedMembers, setCheckedMembers] = useState<Record<string, boolean>>({});
  
  // Track unequal split inputs
  const [unequalAmounts, setUnequalAmounts] = useState<Record<string, string>>({});
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize checkboxes and inputs
  useEffect(() => {
    const initialChecked: Record<string, boolean> = {};
    const initialUnequal: Record<string, string> = {};
    members.forEach(member => {
      initialChecked[member.id] = true;
      initialUnequal[member.id] = '';
    });
    setCheckedMembers(initialChecked);
    setUnequalAmounts(initialUnequal);
  }, [members]);

  const handleCheckboxChange = (memberId: string) => {
    setCheckedMembers(prev => ({
      ...prev,
      [memberId]: !prev[memberId]
    }));
  };

  const handleUnequalAmountChange = (memberId: string, value: string) => {
    // Only allow numbers and decimal
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setUnequalAmounts(prev => ({
        ...prev,
        [memberId]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    if (!description.trim()) {
      setError('Please enter a description.');
      return;
    }

    let splits: { user_id: string; amount: number }[] = [];

    if (splitType === 'equal') {
      const activeMembers = Object.keys(checkedMembers).filter(id => checkedMembers[id]);
      if (activeMembers.length === 0) {
        setError('Please select at least one member to split with.');
        return;
      }
      
      // Calculate equal share
      const share = parsedAmount / activeMembers.length;
      const roundedShare = Math.round(share * 100) / 100;
      
      // Handle rounding discrepancy by adjusting the last participant's share slightly
      const difference = parsedAmount - (roundedShare * activeMembers.length);
      
      splits = activeMembers.map((id, index) => {
        let memberShare = roundedShare;
        if (index === activeMembers.length - 1) {
          memberShare = Math.round((roundedShare + difference) * 100) / 100;
        }
        return {
          user_id: id,
          amount: memberShare
        };
      });
    } else {
      // Unequal splits validation
      let sum = 0;
      const parsedSplits: { user_id: string; amount: number }[] = [];
      
      for (const member of members) {
        const val = parseFloat(unequalAmounts[member.id] || '0');
        if (isNaN(val) || val < 0) {
          setError(`Invalid amount for ${member.display_name}.`);
          return;
        }
        if (val > 0) {
          sum += val;
          parsedSplits.push({
            user_id: member.id,
            amount: Math.round(val * 100) / 100
          });
        }
      }

      // Allow small rounding tolerance (e.g. 0.02)
      if (Math.abs(sum - parsedAmount) > 0.02) {
        setError(`The sum of split amounts ($${sum.toFixed(2)}) must equal the total amount ($${parsedAmount.toFixed(2)}).`);
        return;
      }

      if (parsedSplits.length === 0) {
        setError('Please allocate positive amounts to at least one member.');
        return;
      }

      splits = parsedSplits;
    }

    try {
      setLoading(true);

      // 1. Insert Expense row
      const { data: expenseData, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          group_id: groupId,
          paid_by: paidBy,
          amount: parsedAmount,
          description: description.trim(),
          category,
          expense_date: expenseDate
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      // 2. Insert Expense Splits
      const splitInserts = splits.map(s => ({
        expense_id: expenseData.id,
        user_id: s.user_id,
        amount: s.amount
      }));

      const { error: splitsError } = await supabase
        .from('expense_splits')
        .insert(splitInserts);

      if (splitsError) throw splitsError;

      onExpenseAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save expense.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <span className="modal-title">Add an Expense</span>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="description">Description</label>
            <div style={{ position: 'relative' }}>
              <input
                id="description"
                type="text"
                className="input-control"
                placeholder="e.g., Dinner, Groceries, Rent"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="amount">Amount ($)</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <DollarSign size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  id="amount"
                  type="text"
                  className="input-control"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) setAmount(val);
                  }}
                  style={{ paddingLeft: '32px' }}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="paidBy">Paid By</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <select
                  id="paidBy"
                  className="select-control"
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  style={{ paddingLeft: '32px' }}
                >
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.id === currentUser.id ? 'You' : m.display_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="category">Category</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Tag size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <select
                  id="category"
                  className="select-control"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ paddingLeft: '32px' }}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="date">Date</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Calendar size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  id="date"
                  type="date"
                  className="input-control"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  style={{ paddingLeft: '32px' }}
                  required
                />
              </div>
            </div>
          </div>

          {/* Splitting Tabs */}
          <div className="form-label mb-2">Split Options</div>
          <div className="split-tabs" style={{ marginBottom: '12px' }}>
            <button
              type="button"
              className={`split-tab ${splitType === 'equal' ? 'active' : ''}`}
              onClick={() => setSplitType('equal')}
            >
              Split Equally
            </button>
            <button
              type="button"
              className={`split-tab ${splitType === 'unequal' ? 'active' : ''}`}
              onClick={() => setSplitType('unequal')}
            >
              Split Unequally
            </button>
          </div>

          {/* Members selectors based on split type */}
          <div className="member-select-list">
            {members.map(member => (
              <div key={member.id} className="member-select-item">
                <label className="member-select-label" htmlFor={`member-${member.id}`}>
                  {splitType === 'equal' && (
                    <input
                      id={`member-${member.id}`}
                      type="checkbox"
                      className="member-select-input"
                      checked={!!checkedMembers[member.id]}
                      onChange={() => handleCheckboxChange(member.id)}
                    />
                  )}
                  <span>{member.display_name} {member.id === currentUser.id && '(You)'}</span>
                </label>

                {splitType === 'unequal' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>$</span>
                    <input
                      type="text"
                      className="unequal-amount-input"
                      placeholder="0.00"
                      value={unequalAmounts[member.id] || ''}
                      onChange={(e) => handleUnequalAmountChange(member.id, e.target.value)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
