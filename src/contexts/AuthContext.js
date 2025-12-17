import React, { createContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export const AuthContext = createContext({ user: null, authReady: false });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const init = useCallback(async () => {
    try {
      console.log('[AuthProvider] 초기 세션 확인 시작');
      const result = await supabase.auth.getSession();
      const session = result?.data?.session ?? null;
      setUser(session?.user ?? null);
      console.log('[AuthProvider] getSession 결과', { session });
    } catch (err) {
      console.warn('[AuthProvider] getSession 에러', err);
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      console.log('[AuthProvider] onAuthStateChange', { event, session });
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    return () => { mounted = false; try { subscription?.unsubscribe(); } catch (e) {} };
  }, [init]);

  return (
    <AuthContext.Provider value={{ user, authReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
