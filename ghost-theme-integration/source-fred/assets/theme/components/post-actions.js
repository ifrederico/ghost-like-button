// post-actions.js
(function () {
  if (window.ghActionsInit) return;
  window.ghActionsInit = true;

  let shareMenuEl = null;
  let shareMenuOpenFor = null;

  document.addEventListener('click', function (e) {
    // SHARE
    const shareBtn = e.target.closest('.gh-post-share, .gh-card-share');
    if (shareBtn) {
      e.preventDefault(); e.stopPropagation();
      const url = shareBtn.dataset.url || location.href;
      const title = shareBtn.dataset.title || document.title;

      if (isMobileDevice() && navigator.share) {
        navigator.share({ title, url }).catch((err) => {
          const cancelled = err && (err.name === 'AbortError' || err.message === 'AbortError');
          if (!cancelled) copyToClipboard(url);
        });
      } else {
        // Desktop: toggle popover
        if (shareMenuEl && shareMenuEl.classList.contains('is-open') && shareMenuOpenFor === shareBtn) {
          closeShareMenu();
        } else {
          openShareMenu(shareBtn, { url, title });
        }
      }
      return;
    }

    // COMMENTS
    const commentsBtn = e.target.closest('.gh-post-comments, .gh-card-comments');
    if (!commentsBtn) return;
    e.preventDefault(); e.stopPropagation();

    if (commentsBtn.classList.contains('gh-post-comments')) {
      const el = document.querySelector('#ghost-comments-root');
      if (el) { el.scrollIntoView({ behavior:'smooth', block:'start' }); el.setAttribute('tabindex','-1'); el.focus(); }
      else { location.hash = 'ghost-comments-root'; }
    } else if (commentsBtn.dataset.postUrl) {
      location.href = commentsBtn.dataset.postUrl + '#ghost-comments-root';
    }
  });

  // ---------- Desktop popover ----------

  function openShareMenu(anchorBtn, payload) {
    if (!shareMenuEl) {
      shareMenuEl = buildShareMenuEl();
      document.body.appendChild(shareMenuEl);
    }

    // Set support for native share
    const nativeItem = shareMenuEl.querySelector('[data-action="native-share"]');
    if (navigator.share) {
      nativeItem.disabled = false;
      nativeItem.setAttribute('aria-disabled', 'false');
    } else {
      nativeItem.disabled = true;
      nativeItem.setAttribute('aria-disabled', 'true');
    }

    // Wire actions with current payload
    const copyItem = shareMenuEl.querySelector('[data-action="copy-link"]');
    copyItem.onclick = (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      copyToClipboard(payload.url);
      closeShareMenu();
    };
    nativeItem.onclick = (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      if (navigator.share) {
        navigator.share({ title: payload.title, url: payload.url })
          .then(closeShareMenu)
          .catch((err) => {
            const cancelled = err && (err.name === 'AbortError' || err.message === 'AbortError');
            if (!cancelled) copyToClipboard(payload.url);
            closeShareMenu();
          });
      } else {
        copyToClipboard(payload.url);
        closeShareMenu();
      }
    };

    positionMenu(shareMenuEl, anchorBtn);

    // Open & announce BEFORE any focus moves inside
    shareMenuEl.classList.add('is-open');
    shareMenuEl.setAttribute('aria-hidden', 'false');
    shareMenuOpenFor = anchorBtn;
    anchorBtn.setAttribute('aria-expanded', 'true');

    // Optional: focus first enabled item
    const firstItem = shareMenuEl.querySelector('.gh-share-item:not([disabled])');
    firstItem && firstItem.focus();

    // Close on outside/esc/scroll/resize
    setTimeout(() => {
      document.addEventListener('click', onDocClickOnce, { once: true });
      window.addEventListener('keydown', onEsc);
      window.addEventListener('scroll', closeShareMenu, { once: true, passive: true });
      window.addEventListener('resize', closeShareMenu, { once: true });
    }, 0);
  }

  function closeShareMenu() {
    if (!shareMenuEl) return;

    // Move focus back to trigger before hiding (avoids ARIA warning)
    if (shareMenuEl.contains(document.activeElement) && shareMenuOpenFor) {
      try { shareMenuOpenFor.focus(); } catch {}
    }

    shareMenuEl.classList.remove('is-open');
    shareMenuEl.setAttribute('aria-hidden', 'true');

    if (shareMenuOpenFor) shareMenuOpenFor.setAttribute('aria-expanded', 'false');
    shareMenuOpenFor = null;

    window.removeEventListener('keydown', onEsc);
  }

  function onDocClickOnce(ev) {
    if (!shareMenuEl) return;
    if (!shareMenuEl.contains(ev.target) &&
        !(shareMenuOpenFor && (ev.target === shareMenuOpenFor || shareMenuOpenFor.contains(ev.target)))) {
      closeShareMenu();
    }
  }

  function onEsc(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); closeShareMenu(); }
  }

  function buildShareMenuEl() {
    const wrap = document.createElement('div');
    wrap.className = 'gh-share-menu';
    wrap.setAttribute('role', 'menu');
    wrap.setAttribute('aria-hidden', 'true');

    // New icons (stroke-width="1.5", 16x16 render size)
    const linkSvg = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
           stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
           aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
      </svg>`;

    const planeSvg = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
           stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
           aria-hidden="true">
        <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path>
        <path d="m21.854 2.147-10.94 10.939"></path>
      </svg>`;

    wrap.innerHTML = `
      <button type="button" class="gh-share-item" role="menuitem" data-action="copy-link">
        <span class="gh-share-item-icon">${linkSvg}</span>
        <span class="gh-share-item-text">Copy link</span>
      </button>
      <button type="button" class="gh-share-item" role="menuitem"
              data-action="native-share" aria-disabled="true" disabled>
        <span class="gh-share-item-icon">${planeSvg}</span>
        <span class="gh-share-item-text">Send as message</span>
      </button>
    `;
    return wrap;
  }

  function positionMenu(menu, anchorBtn) {
    const r = anchorBtn.getBoundingClientRect();
    const gap = 8;

    // Mount offscreen to measure
    menu.style.visibility = 'hidden';
    menu.style.left = '-9999px';
    menu.style.top = '0px';
    document.body.appendChild(menu);
    const width = menu.offsetWidth || 220;
    const height = menu.offsetHeight || 90;

    let left = r.left + window.scrollX;
    let top = r.bottom + gap + window.scrollY;

    const maxLeft = window.scrollX + window.innerWidth - width - 8;
    left = Math.max(8 + window.scrollX, Math.min(left, maxLeft));

    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    if (spaceBelow < height + gap && spaceAbove > spaceBelow) {
      top = r.top - height - gap + window.scrollY;
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = 'visible';
  }

  // ---------- device + utils ----------

  function isMobileDevice() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isAndroid = /Android/i.test(ua);
    const isiOS = /iPhone|iPad|iPod/i.test(ua);
    const isIPadOS13Plus = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return isAndroid || isiOS || isIPadOS13Plus;
  }

  function copyToClipboard(text){
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(()=>toast('Link copied')).catch(()=>legacyCopy(text));
    } else {
      legacyCopy(text);
    }
  }

  function legacyCopy(text){
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('Link copied'); }
    catch { toast('Could not copy link','error'); }
    ta.remove();
  }

  function getToastContainer(){
    let el = document.querySelector('.gh-notifications');
    if (!el) {
      el = document.createElement('aside');
      el.className = 'gh-notifications';
      document.body.appendChild(el);
    }
    return el;
  }

  function toast(message, type = 'success'){
    const wrap = getToastContainer();
    const article = document.createElement('article');
    const err = (type === 'error' || type === 'warn') ? ' gh-notification-error' : '';
    article.className = 'gh-notification gh-notification-passive' + err;
    article.setAttribute('role', 'status');
    article.setAttribute('aria-live', 'polite');

    const icon = (type === 'error' || type === 'warn')
      ? '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 2a10 10 0 110 20 10 10 0 010-20zm1 13h-2v-2h2v2zm0-4h-2V7h2v4z" fill="currentColor"></path></svg>'
      : '<svg viewBox="0 0 14 15" width="16" height="16" aria-hidden="true"><path d="M7 .5a7 7 0 100 14 7 7 0 000-14zm4.043 4.783l-3.996 5.42a.582.582 0 01-.834.11L3.36 8.533a.583.583 0 01-.087-.823.583.583 0 01.81-.088l2.38 1.902 3.64-4.94a.583.583 0 01.968.045.583.583 0 01-.028.654z" fill="currentColor"></path></svg>';

    article.innerHTML = `
      <div class="gh-notification-content">
        <div class="gh-notification-header">
          <div class="gh-notification-icon">${icon}</div>
          <div><span class="gh-notification-title">${message}</span></div>
        </div>
      </div>
      <button class="gh-notification-close" type="button" aria-label="Close">
        <svg viewBox="0 0 24 24" width="8" height="8" aria-hidden="true">
          <path d="M12.707 12L23.854.854a.5.5 0 00-.707-.707L12 11.293.854.146a.5.5 0 00-.707.707L11.293 12 .146 23.146a.5.5 0 00.708.708L12 12.707l11.146 11.146a.5.5 0 10.708-.706L12.707 12z" stroke-width="2"></path>
        </svg>
        <span class="hidden">Close</span>
      </button>
    `;
    wrap.appendChild(article);
    article.querySelector('.gh-notification-close')?.addEventListener('click',()=>article.remove(),{once:true});
    setTimeout(()=>{ if(article.parentNode) article.remove(); },5600);
  }
})();