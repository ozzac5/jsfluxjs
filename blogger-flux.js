/* ============================================================
 * Blogger-Flux v3.0.0 — Safelink Engine (Simple 2-Step Flow)
 * ============================================================
 *
 *  FLOW PER PAGE:
 *    Step 1: Timer countdown — "Loading Link ... Wait X Seconds"
 *    Step 2: "Next" button — navigate to next page or back to Adlinkfly
 *
 *  MULTI-PAGE:
 *    - Visitor goes through N pages (configurable via max_pages)
 *    - Each page: Timer → Next button
 *    - On intermediate pages: button = "Next" → go to random article
 *    - On last page: button = "Get Link" → redirect to Adlinkfly
 *
 *  ACTIVATION:
 *    Script only runs when ?url= is in the URL.
 *    Normal blog visits are completely unaffected.
 *
 *  AUTO-INJECTION:
 *    Works on ANY Blogger template — no manual div placement needed.
 *    The safelink container is automatically inserted into the post body.
 * ============================================================ */
(function () {
  'use strict';

  /* ==========================================================
   * 1) DEFAULT CONFIGURATION
   *    Override via window.BFLUX_CONFIG (see install-head.html)
   * ========================================================== */
  var DEFAULTS = {

    /* --- URL --- */
    url_param:    'url',       // query param name for target URL
    url_encoding: 'base64',    // 'base64' or 'plain'

    /* --- Multi-page --- */
    max_pages:      3,         // pages to visit before redirecting to Adlinkfly
    safelink_posts: [],        // blog post URLs (empty = auto-detect via Feed API)
    feed_max_results: 50,

    /* --- Adlinkfly bridge --- */
    adlinkfly_enabled:           false,
    adlinkfly_domain:            '',
    adlinkfly_api_key:           '',
    adlinkfly_use_full_endpoint: true,
    pass_param:                 'bflux_pass',

    /* --- Timer --- */
    delay_seconds: 10,         // countdown duration in seconds

    /* --- Button text --- */
    timer_text:      'Loading Link ... Wait {s} Seconds',
    btn_next_text:   'Next',
    btn_final_text:  'Get Link',
    ad_label_text:   'advertisement',

    /* --- Colors (match the design in the screenshots) --- */
    timer_bg_color:    '#F0F0F0',   // light gray background during timer
    timer_text_color:  '#333333',   // dark text for timer
    btn_bg_color:      '#007BFF',   // blue button
    btn_text_color:    '#FFFFFF',   // white text on button
    btn_hover_color:   '#0056b3',   // darker blue on hover
    btn_radius:        '6px',       // button corner radius
    ad_label_color:    '#888888',   // gray "advertisement" text
    page_info_color:   '#007BFF',   // page indicator color

    /* --- Ad slots (3 positions) ---
     *   ads_top:    above the timer / button
     *   ads_middle: between timer and "advertisement" label
     *   ads_bottom: below "advertisement" label             */
    ads_top:    '',
    ads_middle: '',
    ads_bottom: '',

    /* --- Smart Link popup (optional) --- */
    smart_link_enabled:      false,
    smart_link_url:          '',
    smart_link_trigger:      'next',
    smart_link_cookie_hours: 24,

    /* --- Anti-Adblock (optional) --- */
    anti_adblock_enabled:  false,
    anti_adblock_title:    'Adblock Detected',
    anti_adblock_message:  'Please disable adblock to proceed.',

    /* --- Behavior --- */
    disable_right_click:        true,
    disable_devtools_shortcuts: true,

    /* --- Container (advanced) ---
     * If set, the safelink UI is injected into this element.
     * If empty, auto-detects the post body in the template.  */
    container_id: '',

    /* --- Debug --- */
    debug: false
  };

  /* ==========================================================
   * 2) CONFIG MERGE
   * ========================================================== */
  var C = {};
  for (var k in DEFAULTS) {
    if (DEFAULTS.hasOwnProperty(k)) {
      C[k] = (window.BFLUX_CONFIG && typeof window.BFLUX_CONFIG[k] !== 'undefined')
        ? window.BFLUX_CONFIG[k] : DEFAULTS[k];
    }
  }

  function log() {
    if (!C.debug) return;
    var a = ['[Blogger-Flux]'];
    for (var i = 0; i < arguments.length; i++) a.push(arguments[i]);
    try { console.log.apply(console, a); } catch (e) {}
  }

  /* ==========================================================
   * 3) STATE MANAGEMENT (sessionStorage)
   *
   *  Session state: target URL + page counter (persists across navigations)
   *  Page state:    flow step + timer remaining (persists across reloads)
   * ========================================================== */
  var SKEY = 'bflux_session';
  var PKEY = 'bflux_page_' + window.location.pathname;

  function saveSession(d) { try { sessionStorage.setItem(SKEY, JSON.stringify(d)); } catch (e) {} }
  function loadSession() { try { var r = sessionStorage.getItem(SKEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function clearSession() { try { sessionStorage.removeItem(SKEY); } catch (e) {} }

  function savePageState(d) {
    try { d.ts = Date.now(); sessionStorage.setItem(PKEY, JSON.stringify(d)); } catch (e) {}
  }
  function loadPageState() {
    try {
      var r = sessionStorage.getItem(PKEY);
      if (!r) return null;
      var s = JSON.parse(r);
      if (!s || !s.ts || Date.now() - s.ts > 30 * 60000) { sessionStorage.removeItem(PKEY); return null; }
      return s;
    } catch (e) { return null; }
  }
  function clearPageState() { try { sessionStorage.removeItem(PKEY); } catch (e) {} }

  /* ==========================================================
   * 4) URL HELPERS
   * ========================================================== */
  function getTargetUrl() {
    var s = window.location.search.substring(1);
    if (!s) return '';
    var pairs = s.split('&'), params = {};
    for (var i = 0; i < pairs.length; i++) {
      var eq = pairs[i].indexOf('=');
      var key = eq === -1 ? pairs[i] : pairs[i].substring(0, eq);
      var val = eq === -1 ? '' : pairs[i].substring(eq + 1);
      params[decodeURIComponent(key)] = decodeURIComponent(val.replace(/\+/g, ' '));
    }
    var raw = params[C.url_param] || '';
    if (!raw) return '';
    if (C.url_encoding === 'base64') {
      try { return decodeURIComponent(escape(atob(raw))); }
      catch (e) { try { return atob(raw); } catch (e2) { return raw; } }
    }
    return raw;
  }

  function encodeTargetUrl(url) {
    if (C.url_encoding === 'base64') {
      try { return btoa(unescape(encodeURIComponent(url))); }
      catch (e) { return encodeURIComponent(url); }
    }
    return encodeURIComponent(url);
  }

  /* ==========================================================
   * 5) RANDOM POST PICKER
   * ========================================================== */
  function pickRandomPost(cb) {
    if (C.safelink_posts && C.safelink_posts.length > 0) {
      cb(C.safelink_posts[Math.floor(Math.random() * C.safelink_posts.length)]);
      return;
    }
    var feed = window.location.origin + '/feeds/posts/default?alt=json&max-results=' + C.feed_max_results;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', feed, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status !== 200) { cb(window.location.href.split('?')[0]); return; }
      try {
        var d = JSON.parse(xhr.responseText);
        var entries = (d.feed && d.feed.entry) ? d.feed.entry : [];
        var urls = [];
        for (var i = 0; i < entries.length; i++) {
          var links = entries[i].link || [];
          for (var j = 0; j < links.length; j++) {
            if (links[j].rel === 'alternate' && links[j].type === 'text/html') { urls.push(links[j].href); break; }
          }
        }
        cb(urls.length > 0 ? urls[Math.floor(Math.random() * urls.length)] : window.location.href.split('?')[0]);
      } catch (e) { cb(window.location.href.split('?')[0]); }
    };
    xhr.send();
  }

  /* ==========================================================
   * 6) ADLINKFLY URL BUILDER
   * ========================================================== */
  function buildFinalUrl(url) {
    if (!C.adlinkfly_enabled || !C.adlinkfly_domain) return url;
    var base = C.adlinkfly_domain.replace(/\/+$/, '');
    if (C.adlinkfly_api_key && C.adlinkfly_use_full_endpoint)
      return base + '/full?api=' + encodeURIComponent(C.adlinkfly_api_key) + '&url=' + encodeURIComponent(url);
    if (C.adlinkfly_api_key)
      return base + '/st?api=' + encodeURIComponent(C.adlinkfly_api_key) + '&url=' + encodeURIComponent(url);
    return base + '/?url=' + encodeURIComponent(url);
  }

  function addPassParam(url) {
    return url + (url.indexOf('?') !== -1 ? '&' : '?') + C.pass_param + '=1';
  }

  /* ==========================================================
   * 7) SMART LINK POPUP
   * ========================================================== */
  function withSmartLink(fn) {
    if (typeof fn !== 'function') return;
    if (C.smart_link_enabled && C.smart_link_url && C.smart_link_trigger === 'next') {
      try {
        var ts = parseInt(localStorage.getItem('bflux_sl'), 10);
        var fire = !ts || isNaN(ts) || (Date.now() - ts) / 3600000 >= (C.smart_link_cookie_hours || 24);
        if (fire) {
          var w = window.open(C.smart_link_url, '_blank');
          if (w) localStorage.setItem('bflux_sl', String(Date.now()));
        }
      } catch (e) {}
    }
    fn();
  }

  /* ==========================================================
   * 8) DOM HELPERS
   * ========================================================== */
  function $(id) { return document.getElementById(id); }
  function hide(n) { if (n) n.style.display = 'none'; }
  function show(n) { if (n) n.style.display = 'block'; }

  /* Auto-detect the best container in the page */
  function findContainer() {
    // 1. User-specified container
    if (C.container_id) {
      var el = $(C.container_id);
      if (el) return el;
    }

    // 2. Common Blogger post body selectors (most templates)
    var selectors = [
      '.post-body', '.post-body.entry-content',
      '.entry-content', '.post-content',
      '.article-content', '.post-outer',
      '.post', 'article', '.blog-post',
      '#post-body', '.item-post-body'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) return el;
    }

    // 3. Fallback: create container and insert at top of main content
    var main = document.querySelector('.main') || document.querySelector('#main') || document.querySelector('main') || document.body;
    var container = document.createElement('div');
    container.id = 'bflux-container';
    main.insertBefore(container, main.firstChild);
    return container;
  }

  /* ==========================================================
   * 9) MAIN FLOW
   * ========================================================== */
  var timerInterval = null;
  var timerCount = C.delay_seconds;

  function isLastPage() {
    var s = loadSession();
    return s ? s.currentPage >= s.maxPages : true;
  }

  /* --- Timer completed → show Next/Get Link button --- */
  function onTimerDone() {
    var timerEl = $('bflux-timer');
    var btnEl = $('bflux-btn');
    hide(timerEl);
    show(btnEl);
    savePageState({ step: 'button' });

    // Scroll to button
    if (btnEl) btnEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function startTimer(from) {
    timerCount = from || C.delay_seconds;
    updateTimerText();

    timerInterval = setInterval(function () {
      timerCount--;
      updateTimerText();
      savePageState({ step: 'timer', remaining: timerCount });
      if (timerCount <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        onTimerDone();
      }
    }, 1000);
  }

  function updateTimerText() {
    var el = $('bflux-timer-text');
    if (el) el.textContent = C.timer_text.replace('{s}', timerCount);
  }

  /* --- Next button click → navigate to next article --- */
  function onNextClick() {
    withSmartLink(function () {
      clearPageState();
      var s = loadSession();
      if (!s) return;

      // If this is the last page → redirect to Adlinkfly
      if (s.currentPage >= s.maxPages) {
        clearSession();
        var target = getTargetUrl();
        if (!target) { alert('No target URL.'); return; }
        window.location.href = addPassParam(buildFinalUrl(target));
        return;
      }

      // Otherwise → go to next page
      s.currentPage++;
      saveSession(s);

      pickRandomPost(function (postUrl) {
        var target = getTargetUrl();
        var sep = postUrl.indexOf('?') !== -1 ? '&' : '?';
        var newUrl = postUrl + sep + C.url_param + '=' + encodeURIComponent(encodeTargetUrl(target));
        log('page', s.currentPage, '/', s.maxPages, '→', newUrl);
        window.location.href = newUrl;
      });
    });
  }

  /* ==========================================================
   * 10) RENDER
   * ========================================================== */
  function render(container) {
    var session = loadSession();
    var last = isLastPage();

    container.innerHTML = '';

    // Main wrapper
    var wrap = document.createElement('div');
    wrap.id = 'bflux-wrap';

    // Page indicator
    if (session && session.maxPages > 1) {
      var info = document.createElement('div');
      info.id = 'bflux-page-info';
      info.textContent = 'Step ' + session.currentPage + ' of ' + session.maxPages;
      wrap.appendChild(info);
    }

    // Ad slot: top
    if (C.ads_top) {
      var adT = document.createElement('div');
      adT.className = 'bflux-ad';
      adT.innerHTML = C.ads_top;
      wrap.appendChild(adT);
    }

    // --- Timer section (Step 1) ---
    var timerDiv = document.createElement('div');
    timerDiv.id = 'bflux-timer';
    timerDiv.style.display = 'none';

    var timerText = document.createElement('div');
    timerText.id = 'bflux-timer-text';
    timerText.className = 'bflux-timer-text';
    timerText.textContent = C.timer_text.replace('{s}', C.delay_seconds);
    timerDiv.appendChild(timerText);

    // Ad slot: middle (inside timer area)
    if (C.ads_middle) {
      var adM = document.createElement('div');
      adM.className = 'bflux-ad';
      adM.innerHTML = C.ads_middle;
      timerDiv.appendChild(adM);
    }

    var label1 = document.createElement('div');
    label1.className = 'bflux-ad-label';
    label1.textContent = C.ad_label_text;
    timerDiv.appendChild(label1);

    wrap.appendChild(timerDiv);

    // --- Button section (Step 2) ---
    var btnDiv = document.createElement('div');
    btnDiv.id = 'bflux-btn';
    btnDiv.style.display = 'none';

    var btn = document.createElement('button');
    btn.id = 'bflux-next-btn';
    btn.className = 'bflux-next-btn';
    btn.textContent = last ? C.btn_final_text : C.btn_next_text;
    btn.addEventListener('click', onNextClick);
    btnDiv.appendChild(btn);

    // Ad slot: middle (inside button area)
    if (C.ads_middle) {
      var adM2 = document.createElement('div');
      adM2.className = 'bflux-ad';
      adM2.innerHTML = C.ads_middle;
      btnDiv.appendChild(adM2);
    }

    var label2 = document.createElement('div');
    label2.className = 'bflux-ad-label';
    label2.textContent = C.ad_label_text;
    btnDiv.appendChild(label2);

    wrap.appendChild(btnDiv);

    // Ad slot: bottom
    if (C.ads_bottom) {
      var adB = document.createElement('div');
      adB.className = 'bflux-ad';
      adB.innerHTML = C.ads_bottom;
      wrap.appendChild(adB);
    }

    container.appendChild(wrap);

    // --- State restore ---
    var saved = loadPageState();
    if (!saved || saved.step === 'timer') {
      show(timerDiv);
      hide(btnDiv);
      startTimer(saved ? saved.remaining : C.delay_seconds);
    } else if (saved.step === 'button') {
      hide(timerDiv);
      show(btnDiv);
    }
  }

  /* ==========================================================
   * 11) CSS INJECTION
   * ========================================================== */
  function injectCSS() {
    if ($('bflux-css')) return;
    var s = document.createElement('style');
    s.id = 'bflux-css';
    s.textContent = [
      /* Main wrapper */
      '#bflux-wrap{max-width:600px;margin:20px auto;padding:20px;text-align:center;font-family:Arial,Helvetica,sans-serif;}',

      /* Page indicator */
      '#bflux-page-info{margin-bottom:15px;font-size:14px;font-weight:600;color:' + C.page_info_color + ';}',

      /* Timer area */
      '#bflux-timer{padding:40px 20px;background:' + C.timer_bg_color + ';border-radius:8px;}',

      /* Timer text — "Loading Link ... Wait X Seconds" */
      '.bflux-timer-text{font-size:20px;font-weight:600;color:' + C.timer_text_color + ';line-height:1.5;}',

      /* "advertisement" label */
      '.bflux-ad-label{margin-top:20px;font-size:13px;color:' + C.ad_label_color + ';text-transform:lowercase;}',

      /* Button area */
      '#bflux-btn{padding:40px 20px;border-radius:8px;}',

      /* Blue "Next" / "Get Link" button */
      '.bflux-next-btn{display:inline-block;padding:12px 40px;font-size:16px;font-weight:600;',
      '  color:' + C.btn_text_color + ';background:' + C.btn_bg_color + ';border:none;',
      '  border-radius:' + C.btn_radius + ';cursor:pointer;',
      '  transition:background .2s,transform .1s;}',
      '.bflux-next-btn:hover{background:' + C.btn_hover_color + ';transform:translateY(-1px);}',
      '.bflux-next-btn:active{transform:translateY(0);}',

      /* Ad slot */
      '.bflux-ad{margin:15px 0;}',

      /* Anti-adblock overlay */
      '.bflux-adb-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:10000;text-align:center;}',
      '.bflux-adb-box{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);',
      '  padding:30px 40px;background:#fff;border-radius:12px;min-width:300px;max-width:90%;}',
      '.bflux-adb-box h3{color:#dc3545;margin:0 0 10px 0;}',
      '.bflux-adb-box p{color:#555;margin:0;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ==========================================================
   * 12) ANTI-ADBLOCK
   * ========================================================== */
  function injectAdblockOverlay() {
    if (!C.anti_adblock_enabled) return;
    var ov = document.createElement('div');
    ov.className = 'bflux-adb-overlay';
    ov.innerHTML = '<div class="bflux-adb-box"><h3>' + C.anti_adblock_title + '</h3><p>' + C.anti_adblock_message + '</p></div>';
    document.body.appendChild(ov);
    var blocked = false;
    fetch(new Request('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'))
      .catch(function () { blocked = true; })
      .then(function () {
        if (blocked) {
          ov.style.display = 'block';
          timerCount = 99999;
        }
      });
  }

  /* ==========================================================
   * 13) BOOTSTRAP
   * ========================================================== */
  function boot() {
    // Only activate when ?url= parameter exists
    var target = getTargetUrl();
    if (!target) { log('no ?url= — normal visit'); return; }

    log('activating safelink — target:', target);

    // Initialize or resume session
    var session = loadSession();
    if (!session) {
      session = { targetUrl: target, currentPage: 1, maxPages: C.max_pages };
      saveSession(session);
    }
    log('page', session.currentPage, 'of', session.maxPages);

    // Find or create container
    var container = findContainer();
    if (!container) { log('no container found'); return; }

    // Render the safelink UI
    injectCSS();
    render(container);
    injectAdblockOverlay();

    // Disable right-click
    if (C.disable_right_click) {
      document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }
    // Disable DevTools shortcuts
    if (C.disable_devtools_shortcuts) {
      document.addEventListener('keydown', function (e) {
        if (e.keyCode === 123 || (e.ctrlKey && e.keyCode === 85) ||
          (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 67 || e.keyCode === 74))) {
          e.preventDefault();
        }
      });
    }
  }

  /* ==========================================================
   * 14) RUN
   * ========================================================== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* Public API */
  window.BloggerFlux = {
    buildUrl: function (targetUrl, postUrl) {
      var base = postUrl || window.location.pathname;
      return base + (base.indexOf('?') !== -1 ? '&' : '?') + C.url_param + '=' + encodeURIComponent(encodeTargetUrl(targetUrl));
    },
    encode: encodeTargetUrl,
    config: C
  };

})();
