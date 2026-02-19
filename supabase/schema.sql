-- Supabase Schema for Foundry
-- Run this in Supabase SQL Editor

-- Enable Row Level Security
alter table if exists public.profiles enable row level security;

-- Create profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  company_name text,
  avatar_url text,
  onboarding_complete boolean default false,
  onboarding_step text default 'start',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create founder_profiles table (business data)
create table if not exists public.founder_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  
  -- Business info
  stage text,
  product_description text,
  problem_solved text,
  ideal_customer text,
  revenue_model text,
  competitors jsonb,
  budget_situation text,
  runway_months integer,
  goal_90_day text,
  biggest_concern text,
  
  -- Structured data
  extracted_data jsonb default '{}',
  confirmed_summary jsonb default '{}',
  
  -- Status
  status text default 'incomplete',
  confirmed_at timestamp with time zone,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  unique(user_id)
);

-- Create onboarding_answers table (tracks Q&A)
create table if not exists public.onboarding_answers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  question_id text not null,
  question_text text not null,
  answer_text text not null,
  follow_up_count integer default 0,
  extracted_info jsonb default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create uploaded_files table
create table if not exists public.uploaded_files (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  file_name text not null,
  file_type text not null,
  file_size integer not null,
  category text,
  storage_path text,
  processed boolean default false,
  extracted_text text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security Policies

-- Profiles: Users can only see their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Founder profiles: Users can only see their own
create policy "Users can view own founder profile"
  on public.founder_profiles for select
  using (auth.uid() = user_id);

create policy "Users can update own founder profile"
  on public.founder_profiles for update
  using (auth.uid() = user_id);

create policy "Users can insert own founder profile"
  on public.founder_profiles for insert
  with check (auth.uid() = user_id);

-- Onboarding answers: Users can only see their own
create policy "Users can view own answers"
  on public.onboarding_answers for select
  using (auth.uid() = user_id);

create policy "Users can insert own answers"
  on public.onboarding_answers for insert
  with check (auth.uid() = user_id);

-- Files: Users can only see their own
create policy "Users can view own files"
  on public.uploaded_files for select
  using (auth.uid() = user_id);

create policy "Users can insert own files"
  on public.uploaded_files for insert
  with check (auth.uid() = user_id);

-- Create function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable realtime for relevant tables
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.founder_profiles;
