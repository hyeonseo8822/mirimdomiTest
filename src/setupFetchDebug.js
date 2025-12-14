// Dev-only global fetch wrapper for debugging network calls (supabase-js, etc.)
// Usage: open DevTools Console and reproduce the hung SDK calls.
// To remove wrapper at runtime call: `window._restoreFetchDebug()`

if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (function() {
    if (window.__fetchDebugInstalled) return;
    window.__fetchDebugInstalled = true;
    // keep original bound fetch
    window.__origFetch = window.fetch && window.fetch.bind(window);

    window.fetch = function(...args) {
      try {
        const url = args[0];
        const opts = args[1];
        const method = (opts && opts.method) || 'GET';
        console.log('[DBG] global fetch called with:', url, method, opts && opts.headers ? '(with headers)' : '');
      } catch (e) {
        // swallow logging errors
        console.log('[DBG] global fetch log failed', e);
      }
      return window.__origFetch.apply(this, args);
    };

    window._restoreFetchDebug = function() {
      if (window.__origFetch) {
        window.fetch = window.__origFetch;
        delete window.__origFetch;
        window.__fetchDebugInstalled = false;
        console.log('[DBG] fetch wrapper removed.');
      } else {
        console.log('[DBG] no original fetch to restore.');
      }
    };

    console.log('[DBG] fetch debug wrapper installed (development only).');
  })();
}
