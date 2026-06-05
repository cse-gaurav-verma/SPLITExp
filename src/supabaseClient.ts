import { createClient } from '@supabase/supabase-js';

// Read from env or fallback to localStorage (useful for instant browser-based setups)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('SPLITX_SUPABASE_URL') || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('SPLITX_SUPABASE_ANON_KEY') || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

export const saveSupabaseCredentials = (url: string, key: string) => {
  localStorage.setItem('SPLITX_SUPABASE_URL', url);
  localStorage.setItem('SPLITX_SUPABASE_ANON_KEY', key);
  window.location.reload();
};

export const clearSupabaseCredentials = () => {
  localStorage.removeItem('SPLITX_SUPABASE_URL');
  localStorage.removeItem('SPLITX_SUPABASE_ANON_KEY');
  window.location.reload();
};
