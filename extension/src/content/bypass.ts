// Minimal, early capture-phase event blockers (document_start)
(() => {
  const stop = (e: Event) => { try { (e as any).stopImmediatePropagation?.(); } catch { void 0 } };

  // Visibility and lifecycle events on document
  const docEvents = [
    'visibilitychange', 'webkitvisibilitychange', 'mozvisibilitychange', 'msvisibilitychange',
    'pageshow', 'pagehide'
  ];
  for (const type of docEvents) {
    document.addEventListener(type, stop, true);
  }

  // Focus/blur on both document and window (capture)
  document.addEventListener('focus', stop, true);
  document.addEventListener('blur', stop, true);
  window.addEventListener('focus', stop, true);
  window.addEventListener('blur', stop, true);

  try {
    console.log('[Bypass] capture listeners attached at', document.readyState);
  } catch { void 0 }
})();
