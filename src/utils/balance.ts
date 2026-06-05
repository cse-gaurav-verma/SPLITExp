import type { Profile, Expense, DebtSimplifyResult } from '../types';

/**
 * Calculates net balance for each member in a group, and derives the simplified debts.
 */
export const calculateGroupBalances = (
  members: Profile[],
  expenses: Expense[]
): {
  netBalances: Record<string, number>;
  simplifiedDebts: DebtSimplifyResult[];
} => {
  const netBalances: Record<string, number> = {};

  // Initialize all members with 0 balance
  members.forEach((m) => {
    netBalances[m.id] = 0;
  });

  // Calculate net balances based on expenses and splits
  expenses.forEach((expense) => {
    const paidBy = expense.paid_by;
    const amount = Number(expense.amount);
    
    // Add full paid amount to payer (they get credit)
    if (netBalances[paidBy] !== undefined) {
      netBalances[paidBy] += amount;
    }

    // Subtract split amount from each participant (they owe)
    if (expense.splits) {
      expense.splits.forEach((split) => {
        const userId = split.user_id;
        const splitAmount = Number(split.amount);
        if (netBalances[userId] !== undefined) {
          netBalances[userId] -= splitAmount;
        }
      });
    }
  });

  // Round balances to 2 decimal places to avoid floating point issues
  Object.keys(netBalances).forEach((id) => {
    netBalances[id] = Math.round(netBalances[id] * 100) / 100;
  });

  // Simplify Debts Algorithm (Greedy matching)
  const debtors: { id: string; name: string; amount: number }[] = [];
  const creditors: { id: string; name: string; amount: number }[] = [];

  members.forEach((member) => {
    const bal = netBalances[member.id] || 0;
    if (bal < -0.01) {
      debtors.push({ id: member.id, name: member.display_name, amount: -bal });
    } else if (bal > 0.01) {
      creditors.push({ id: member.id, name: member.display_name, amount: bal });
    }
  });

  // Sort debtors and creditors descending by amount
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const simplifiedDebts: DebtSimplifyResult[] = [];
  let dIdx = 0;
  let cIdx = 0;

  // Clone amounts so we can modify them
  const dList = debtors.map((d) => ({ ...d }));
  const cList = creditors.map((c) => ({ ...c }));

  while (dIdx < dList.length && cIdx < cList.length) {
    const debtor = dList[dIdx];
    const creditor = cList[cIdx];

    const amount = Math.min(debtor.amount, creditor.amount);
    if (amount > 0.01) {
      simplifiedDebts.push({
        from: debtor.id,
        fromName: debtor.name,
        to: creditor.id,
        toName: creditor.name,
        amount: Math.round(amount * 100) / 100,
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) dIdx++;
    if (creditor.amount < 0.01) cIdx++;
  }

  return {
    netBalances,
    simplifiedDebts,
  };
};
