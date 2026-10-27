export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
// When keys are missing the site runs in demo mode with sample data.
export const isConfigured = Boolean(supabaseUrl && supabaseKey);
