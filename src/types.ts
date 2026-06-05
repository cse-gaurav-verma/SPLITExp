export interface Profile {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  members?: Profile[];
}

export interface Expense {
  id: string;
  group_id: string;
  paid_by: string;
  amount: number;
  description: string;
  category: string;
  expense_date: string;
  created_at: string;
  payer_profile?: Profile;
  splits?: ExpenseSplit[];
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  profile?: Profile;
}

export interface DebtSimplifyResult {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
}
