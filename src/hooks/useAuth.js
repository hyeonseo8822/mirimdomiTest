import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    let fallbackTimer = null;

    const checkSession = async () => {
      try {
        console.log('[useAuth] 초기 세션 확인 시작');
        const result = await supabase.auth.getSession();
        const session = result?.data?.session ?? null;
        if (!mounted) return;
        setUser(session?.user ?? null);
        console.log('[useAuth] getSession 결과', { session });
        setAuthReady(true);
      } catch (err) {
        console.warn('[useAuth] getSession 에러', err);
        if (mounted) setAuthReady(true);
      }
    };

    checkSession();

    // 이후 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      console.log('[useAuth] onAuthStateChange', { event, session });
      setUser(session?.user ?? null);
      // 인증 상태가 바뀌면 authReady는 확실히 true
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      try { subscription?.unsubscribe(); } catch (e) {}
    };
  }, []);

  return { user, authReady };
}
