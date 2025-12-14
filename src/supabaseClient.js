import { createClient } from '@supabase/supabase-js'

// IMPORTANT: Replace with your actual Supabase URL and Anon key
// It's recommended to store these in an environment file (.env)
const supabaseUrlRaw = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKeyRaw = process.env.REACT_APP_SUPABASE_ANON_KEY;

// 안전하게 앞뒤 공백 제거
const supabaseUrl = typeof supabaseUrlRaw === 'string' ? supabaseUrlRaw.trim() : supabaseUrlRaw;
const supabaseAnonKey = typeof supabaseAnonKeyRaw === 'string' ? supabaseAnonKeyRaw.trim() : supabaseAnonKeyRaw;

console.log('Supabase Client Init: URL =', supabaseUrl || 'NOT LOADED', ', Anon Key =', supabaseAnonKey ? 'Loaded' : 'NOT LOADED');
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase Client Init Error: Supabase URL or Anon Key is missing or empty!');
}

// expose for quick debugging in browser console (optional)
try {
  window.supabaseClientInfo = { url: supabaseUrl };
} catch (e) {}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
// 개발 편의를 위해 개발 환경에서는 전역에 supabase를 노출해 디버깅을 쉽게 합니다.
if (process.env.NODE_ENV === 'development') {
  try {
    // 주의: 프로덕션에서는 전역 노출을 피하세요.
    window.supabase = supabase;
  } catch (e) {}
}