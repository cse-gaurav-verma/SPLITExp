import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Profile, DebtSimplifyResult } from '../types';
import { X, DollarSign, Calendar, ArrowRight } from 'lucide-react';

interface SettleUpModalProps {
  groupId: string;
  members: Profile[];
  currentUser: Profile;
  simplifiedDebts: DebtSimplifyResult[];
  onClose: () => void;
  onSettleAdded: () => void;
}

export const SettleUpModal: React.FC<SettleUpModalProps> = ({
  groupId,
  members,
  currentUser,
  simplifiedDebts,
  onClose,
  onSettleAdded
}) => {
  const [payerId, setPayerId] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Pre-fill fields based on simplified debts
  useEffect(() => {
    // 1. Find if current user owes someone
    const userOwes = simplifiedDebts.find(d => d.from === currentUser.id);
    if (userOwes) {
      setPayerId(currentUser.id);
      setRecipientId(userOwes.to);
      setAmount(userOwes.amount.toFixed(2));
      return;
    }

    // 2. Find if someone owes current user
    const owesUser = simplifiedDebts.find(d => d.to === currentUser.id);
    if (owesUser) {
      setPayerId(owesUser.from);
      setRecipientId(currentUser.id);
      setAmount(owesUser.amount.toFixed(2));
      return;
    }

    // 3. Fallback to first debt in the list, or random members
    if (simplifiedDebts.length > 0) {
      const firstDebt = simplifiedDebts[0];
      setPayerId(firstDebt.from);
      setRecipientId(firstDebt.to);
      setAmount(firstDebt.amount.toFixed(2));
    } else {
      setPayerId(currentUser.id);
      // Select first member who is not current user
      const other = members.find(m => m.id !== currentUser.id);
      setRecipientId(other ? other.id : currentUser.id);
      setAmount('');
    }
  }, [simplifiedDebts, members, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (payerId === recipientId) {
      setError('Payer and Recipient cannot be the same person.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    const payer = members.find(m => m.id === payerId);
    const recipient = members.find(m => m.id === recipientId);
    if (!payer || !recipient) {
      setError('Invalid members selected.');
      return;
    }

    try {
      setLoading(true);

      const description = `Settled Up: ${payer.display_name} paid ${recipient.display_name}`;

      // 1. Insert Expense (of category 'settlement')
      const { data: expenseData, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          group_id: groupId,
          paid_by: payerId,
          amount: parsedAmount,
          description,
          category: 'settlement',
          expense_date: date
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      // 2. Insert Split (recipient owes this amount back, which offsets payer's credit)
      const { error: splitError } = await supabase
        .from('expense_splits')
        .insert({
          expense_id: expenseData.id,
          user_id: recipientId,
          amount: parsedAmount
        });

      if (splitError) throw splitError;

      onSettleAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record settlement.');
    } finally {
      setLoading(false);
    }
  };

  const payerName = members.find(m => m.id === payerId)?.display_name || '';
  const recipientName = members.find(m => m.id === recipientId)?.display_name || '';

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <span className="modal-title">Settle Up Balances</span>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Visual indicator of flow */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', margin: '12px 0 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <span className="text-xs text-muted mb-1">Payer</span>
              <div className="list-item-avatar" style={{ fontSize: '1.25rem', width: '50px', height: '50px' }}>
                {payerName.substring(0, 2).toUpperCase() || '?'}
              </div>
              <span className="text-sm font-semibold mt-1" style={{ textAlign: 'center' }}>
                {payerId === currentUser.id ? 'You' : payerName || 'Loading...'}
              </span>
            </div>

            <ArrowRight size={24} className="text-primary" />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <span className="text-xs text-muted mb-1">Recipient</span>
              <div className="list-item-avatar" style={{ fontSize: '1.25rem', width: '50px', height: '50px' }}>
                {recipientName.substring(0, 2).toUpperCase() || '?'}
              </div>
              <span className="text-sm font-semibold mt-1" style={{ textAlign: 'center' }}>
                {recipientId === currentUser.id ? 'You' : recipientName || 'Loading...'}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="payer">Who Paid?</label>
            <select
              id="payer"
              className="select-control"
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
            >
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.id === currentUser.id ? 'You' : m.display_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="recipient">Who Received?</label>
            <select
              id="recipient"
              className="select-control"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
            >
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.id === currentUser.id ? 'You' : m.display_name}
                </option>
              ))}
            </select>
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
              <label className="form-label" htmlFor="date">Date</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Calendar size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  id="date"
                  type="date"
                  className="input-control"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{ paddingLeft: '32px' }}
                  required
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
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
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
