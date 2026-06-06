import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Safely initialize Supabase to prevent crash if env variables are missing
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      storage: {
        from: () => ({
          upload: async () => ({ error: new Error("Supabase não configurado no servidor") }),
          getPublicUrl: () => ({ data: { publicUrl: "" } }),
        })
      }
    } as any;

export default supabase;
