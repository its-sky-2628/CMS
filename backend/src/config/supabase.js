import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
);

const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

// Keep database operations isolated from sign-up/sign-in sessions.
export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, options)
  : null;

// Authentication gets its own client so user sessions cannot affect
// the database client's authorization headers.
export const authClient = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, options)
  : null;

export function db() {
  if (!supabase) {
    const err = new Error(
      'Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
    err.statusCode = 503;
    throw err;
  }
  return supabase;
}
console.log('[Supabase startup check]', {
  urlConfigured: Boolean(SUPABASE_URL),
  keyConfigured: Boolean(SUPABASE_SERVICE_ROLE_KEY),
  keyLooksLikeServiceRole: Boolean(
    SUPABASE_SERVICE_ROLE_KEY &&
    (SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ') ||
     SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_secret_'))
  ),
});
