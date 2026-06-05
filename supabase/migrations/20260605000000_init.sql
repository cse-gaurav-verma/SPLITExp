-- Supabase Migration: Splitwise Clone (SplitX)

-- 1. Profiles Table (Synced with Auth.Users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null unique,
  display_name text,
  avatar_url text,
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Policies for profiles
create policy "Public profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Trigger to sync auth.users with public.profiles
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. Groups Table
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now()
);

alter table public.groups enable row level security;

-- 3. Group Members Table
create table public.group_members (
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamp with time zone default now(),
  primary key (group_id, user_id)
);

alter table public.group_members enable row level security;


-- Policies for Groups and Group Members
create policy "Users can view groups they are members of"
  on public.groups for select
  to authenticated
  using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = groups.id and group_members.user_id = auth.uid()
    )
  );

create policy "Users can create groups"
  on public.groups for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Users can update groups they created"
  on public.groups for update
  to authenticated
  using (auth.uid() = created_by);

create policy "Users can view group memberships they belong to"
  on public.group_members for select
  to authenticated
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id and gm.user_id = auth.uid()
    )
  );

create policy "Users can add members to groups they are in"
  on public.group_members for insert
  to authenticated
  with check (
    -- Creator can add during group creation, or existing members can add others
    exists (
      select 1 from public.groups g
      where g.id = group_members.group_id and g.created_by = auth.uid()
    ) or exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id and gm.user_id = auth.uid()
    )
  );

create policy "Users can remove members from groups they created"
  on public.group_members for delete
  to authenticated
  using (
    exists (
      select 1 from public.groups g
      where g.id = group_members.group_id and g.created_by = auth.uid()
    ) or auth.uid() = user_id
  );


-- 4. Expenses Table
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  paid_by uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  description text not null,
  category text not null default 'general',
  expense_date date not null default current_date,
  created_at timestamp with time zone default now()
);

alter table public.expenses enable row level security;

create policy "Users can view expenses of groups they belong to"
  on public.expenses for select
  to authenticated
  using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = expenses.group_id and group_members.user_id = auth.uid()
    )
  );

create policy "Users can insert expenses to groups they belong to"
  on public.expenses for insert
  to authenticated
  with check (
    exists (
      select 1 from public.group_members
      where group_members.group_id = expenses.group_id and group_members.user_id = auth.uid()
    )
  );

create policy "Users can delete expenses they created or paid for"
  on public.expenses for delete
  to authenticated
  using (
    auth.uid() = paid_by or exists (
      select 1 from public.groups g
      where g.id = expenses.group_id and g.created_by = auth.uid()
    )
  );


-- 5. Expense Splits Table
create table public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10, 2) not null,
  created_at timestamp with time zone default now(),
  constraint unique_expense_user_split unique (expense_id, user_id)
);

alter table public.expense_splits enable row level security;

create policy "Users can view expense splits for expenses in their groups"
  on public.expense_splits for select
  to authenticated
  using (
    exists (
      select 1 from public.expenses e
      join public.group_members gm on gm.group_id = e.group_id
      where e.id = expense_splits.expense_id and gm.user_id = auth.uid()
    )
  );

create policy "Users can insert expense splits for expenses in their groups"
  on public.expense_splits for insert
  to authenticated
  with check (
    exists (
      select 1 from public.expenses e
      join public.group_members gm on gm.group_id = e.group_id
      where e.id = expense_splits.expense_id and gm.user_id = auth.uid()
    )
  );

create policy "Users can delete expense splits for expenses in their groups"
  on public.expense_splits for delete
  to authenticated
  using (
    exists (
      select 1 from public.expenses e
      join public.group_members gm on gm.group_id = e.group_id
      where e.id = expense_splits.expense_id and gm.user_id = auth.uid()
    )
  );
