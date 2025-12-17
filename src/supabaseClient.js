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

// Pass the platform fetch explicitly to ensure the SDK uses the instrumented fetch
// Provide a logging fetch so we can see SDK network calls in DevTools
const makeLoggedFetch = () => {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return undefined;
  const orig = window.fetch.bind(window);
  return async function loggedFetch(...args) {
    try {
      const url = args[0];
      const opts = args[1] || {};
      const method = (opts.method) || 'GET';
      
      // Storage API 요청인 경우 Content-Type 헤더 제거 및 상세 로깅
      if (url && typeof url === 'string' && url.includes('/storage/v1/object/')) {
        // Headers 객체를 일반 객체로 변환
        let headers = opts.headers;
        if (headers instanceof Headers) {
          headers = Object.fromEntries(headers.entries());
          opts.headers = headers;
        } else if (!headers) {
          headers = {};
          opts.headers = headers;
        }
        
 j       // Storage API 요청에서는 Content-Type: application/son 제거
        // Supabase SDK가 자동으로 multipart/form-data를 설정함
        if (headers['Content-Type'] === 'application/json' || headers['content-type'] === 'application/json') {
          delete headers['Content-Type'];
          delete headers['content-type'];
          console.log('[DBG][supabase-storage-fetch] ⚠️ Content-Type: application/json 제거됨 (Storage API는 multipart/form-data 자동 설정)');
        }
        
        console.log('[DBG][supabase-storage-fetch] ', method, url);
        console.log('[DBG][supabase-storage-fetch] 최종 헤더:', JSON.stringify(headers, null, 2));
        console.log('[DBG][supabase-storage-fetch] Content-Type:', headers['Content-Type'] || headers['content-type'] || '없음 (자동 설정됨)');
        console.log('[DBG][supabase-storage-fetch] 요청 body:', opts.body ? (opts.body instanceof File ? `File(${opts.body.name}, type: ${opts.body.type}, size: ${opts.body.size}bytes)` : typeof opts.body) : '없음');
      }
      // Supabase PostgREST API 요청인 경우 Accept 헤더 보장
      else if (url && typeof url === 'string' && url.includes('/rest/v1/')) {
        // 헤더가 없으면 생성, 있으면 기존 헤더 사용
        if (!opts.headers) {
          opts.headers = {};
        }
        
        // Headers 객체인 경우 일반 객체로 변환
        let headers = opts.headers;
        if (headers instanceof Headers) {
          headers = Object.fromEntries(headers.entries());
          opts.headers = headers;
        }
        
        // Accept 헤더가 없거나 잘못된 경우 설정
        if (!headers['Accept'] && !headers['accept']) {
          // single() 사용 시에는 application/vnd.pgjson.object+json 필요
          // 일반 select는 application/json
          headers['Accept'] = 'application/json';
        }
        
        // Prefer 헤더도 추가 (PostgREST에서 권장)
        if (method === 'GET' && !headers['Prefer'] && !headers['prefer']) {
          // single() 사용 시에는 return=representation 필요
          headers['Prefer'] = 'return=representation';
        }
        
        console.log('[DBG][supabase-fetch] ', method, url, 'headers:', JSON.stringify(headers));
      } else {
        console.log('[DBG][supabase-fetch] ', method, url, opts && opts.headers ? '(with headers)' : '');
      }
    } catch (e) {
      console.log('[DBG][supabase-fetch] logging failed', e);
    }
    return orig(...args);
  };
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: makeLoggedFetch(),
    // Storage API 요청에는 Content-Type을 설정하지 않음 (multipart/form-data 자동 설정)
    // PostgREST API 요청에만 적용되도록 fetch 함수에서 처리
    headers: {
      'Accept': 'application/json',
      // 'Content-Type': 'application/json', // Storage API와 충돌하므로 제거
    },
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public',
  }
});

/**
 * 세션 확인 및 갱신 헬퍼 함수
 * 모든 Supabase 요청 전에 호출하여 유효한 세션을 보장합니다.
 * 
 * @returns {Promise<Session>} 유효한 세션 객체
 * @throws {Error} 세션이 없거나 갱신에 실패한 경우
 */
export const ensureValidSession = async () => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[세션 확인 실패]', sessionError);
      throw new Error('세션 확인 실패: ' + sessionError.message);
    }
    
    if (!session) {
      console.error('[세션 없음] 로그인이 필요합니다.');
      throw new Error('세션이 없습니다. 다시 로그인해주세요.');
    }
    
    // 세션이 곧 만료될 경우 갱신 시도
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = expiresAt - now;
    
    // 5분 이내로 만료되면 갱신 시도
    if (timeUntilExpiry < 300) {
      console.log('[세션 갱신] 세션이 곧 만료되어 갱신 시도 (만료까지 ' + timeUntilExpiry + '초)');
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('[세션 갱신 실패]', refreshError);
        // 갱신 실패해도 기존 세션이 아직 유효하면 계속 진행
        if (timeUntilExpiry > 0) {
          console.warn('[세션 갱신 실패] 기존 세션이 아직 유효하여 계속 진행');
          return session;
        }
        throw new Error('세션 갱신 실패: ' + refreshError.message);
      }
      
      if (refreshedSession) {
        console.log('[세션 갱신 성공]');
        return refreshedSession;
      }
    }
    
    return session;
  } catch (error) {
    console.error('[세션 확인 오류]', error);
    throw error;
  }
};

// 개발 편의를 위해 개발 환경에서는 전역에 supabase를 노출해 디버깅을 쉽게 합니다.
if (process.env.NODE_ENV === 'development') {
  try {
    // 주의: 프로덕션에서는 전역 노출을 피하세요.
    window.supabase = supabase;
    window.ensureValidSession = ensureValidSession;
  } catch (e) {}
}