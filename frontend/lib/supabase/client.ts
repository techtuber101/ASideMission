import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key_for_development'

// Provide a clear console warning during development if Supabase is not configured
if (
  (typeof window !== 'undefined') &&
  (supabaseUrl === 'https://dummy.supabase.co' || !supabaseUrl || !supabaseAnonKey)
) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Auth] Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env.local.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

