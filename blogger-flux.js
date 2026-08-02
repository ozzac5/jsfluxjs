/* ============================================================
 * Blogger-Flux v2.0.0 — Template Tag Edition
 * ============================================================
 *  Safelink skip-flow engine for Blogger blogs (pure JS).
 *  Designed to work with Adlinkfly via the bundled PHP snippet.
 *
 *  INSTALLATION (3 pieces only):
 *
 *  1) Blog theme <head>  → paste install-head.html
 *  2) Blog post template → paste install-post.html
 *       (adds two placeholders: #bflux-top and #bflux-bottom)
 *  3) Adlinkfly site     → paste adlinkfly-snippet.php
 *       (in templates/redirect.php or view_banner.ctp)
 *
 *  HOW IT WORKS:
 *
 *  • A visitor clicks an Adlinkfly short link (e.g. /MrMJN)
 *  • The PHP snippet detects the request is not from your Blogger
 *    safelink, picks a random safelink post URL, and redirects:
 *       https://blog.com/2024/01/post.html?url=BASE64(adlinkfly/MrMJN)
 *  • Blogger-Flux detects ?url=, finds #bflux-top / #bflux-bottom,
 *    and renders the 5-step skip flow:
 *       IM NOT ROBOT → 10s timer → CLICK 2X → PLEASE WAIT (3s) → DOWNLOAD LINK
 *  • On DOWNLOAD LINK click, the visitor is sent back to the
 *    original Adlinkfly short link (referer = your blog).
 *  • The PHP snippet now sees the referer is your blog → allows
 *    pass-through → Adlinkfly shows "Get Link" → real download.
 *
 *  The script does NOTHING on regular blog visits (no ?url=),
 *  so it's safe to load on every page of your blog.
 * ============================================================ */
(function () {
  'use strict';

  // ============================================================
  // 1) DEFAULTS  —  كل الإعدادات الافتراضية هنا
  // المستخدم يتجاوز أي منها عبر window.BLOGGER_FLUX_CONFIG
  // (انظر install-head.html لقائمة الإعدادات القابلة للتعديل)
  // ============================================================
  var DEFAULTS = {

    /* ---- استخراج الرابط المستهدف ---- */
    url_param:     'url',      // ?url=BASE64(target)
    url_encoding:  'base64',   // 'base64' | 'plain'

    /* ---- جسر Adlinkfly ----
     * مهم: في وضع الجسر مع Adlinkfly، اتركها false.
     * الرابط المستهدف (?url=) هو بالفعل رابط Adlinkfly مختصر —
     * لا نريد تقصيره مرة أخرى (سيُسبّب خطأ "URL is invalid").
     *
     * فعّلها فقط إذا أردت استخدام Blogger-Flux بدون جسر Adlinkfly،
     * ووضع رابط تحميل مباشر في ?url= — عندها سيُقصَّر الرابط
     * عبر Adlinkfly API قبل إرسال الزائر.
     */
    adlinkfly_enabled:           false,
    adlinkfly_domain:            '',   // مثال: 'https://short2links.ct.ws'
    adlinkfly_api_key:           '',   // مفتاح API من /admin/api
    adlinkfly_use_full_endpoint: true, // true = /full?api=KEY&url=URL

    /* ---- المؤقتات ---- */
    delay_seconds:   10,    // مدة العدّاد المخفي (ثواني)
    please_wait_ms:  3000,  // مدة "PLEASE WAIT" (ميلي ثانية)

    /* ---- الأزرار ----
     * btn_type: 'button' (زر CSS مصمّم) أو 'image' (صور PNG)
     * إذا اخترت 'image' ضع روابط الصور الأربع في btn_img_1..4
     */
    btn_type:   'button',
    btn_text_1: 'IM NOT ROBOT',
    btn_text_2: 'CLICK 2X FOR GENERATE LINK',
    btn_text_3: 'PLEASE WAIT ...',
    btn_text_4: 'DOWNLOAD LINK',
    btn_img_1:  '',  // صورة زر IM NOT ROBOT
    btn_img_2:  '',  // صورة زر CLICK 2X
    btn_img_3:  '',  // صورة PLEASE WAIT
    btn_img_4:  '',  // صورة زر DOWNLOAD LINK

    /* ---- مساحات الإعلانات (6 مواقع) ----
     * الصق كود HTML/JS لأي إعلان (AdSense, PropellerAds, إلخ).
     * الموقع الفارغ لا يُظهر شيئاً.
     *
     *   ads1: أعلى #bflux-top (فوق IM NOT ROBOT)
     *   ads2: أسفل العدّاد (قبل نهاية #bflux-top)
     *   ads3: أعلى #bflux-bottom (فوق CLICK 2X)
     *   ads4: بين CLICK 2X و DOWNLOAD LINK
     *   ads5: أسفل DOWNLOAD LINK
     *   ads6: أسفل #bflux-bottom (نهاية الصفحة)
     */
    ads1: '',
    ads2: '',
    ads3: '',
    ads4: '',
    ads5: '',
    ads6: '',

    /* ---- نص التعليمات (يظهر بجانب CLICK 2X بعد العدّاد) ---- */
    instruction_text: '𝗖𝗹𝗶𝗰𝗸 𝗢𝗻 𝗔𝗻𝘆 ☝ 𝗜𝗺𝗮𝗴𝗲𝘀 👇 𝘁𝗵𝗲𝗻 𝗯𝗮𝗰𝗸 𝗮𝗻𝗱 𝗪𝗮𝗶𝘁 𝗙𝗼𝗿 𝗧𝗵𝗲 𝗟𝗶𝗻𝗸 (𝗜𝗳 𝗣𝗮𝗴𝗲 𝗡𝗼𝘁 𝗪𝗼𝗿𝗸𝗶𝗻𝗴 𝗥𝗲𝗳𝗿𝗲𝘀𝗵 𝗧𝗵𝗲 𝗣𝗮𝗴𝗲)',

    /* ---- Smart Link popup (اختياري — نافذة منبثقة للربح) ----
     * تُفتح مرة واحدة كل X ساعة على أول ضغطة زر
     */
    smart_link_enabled:      false,
    smart_link_url:          '',          // رابط الكفيل/الإعلان
    smart_link_trigger:      'generate',  // 'robot' | 'generate' | 'download'
    smart_link_cookie_hours: 24,

    /* ---- Anti-Adblock (اختياري) ---- */
    anti_adblock_enabled:  false,
    anti_adblock_title:    'Adblock Detected',
    anti_adblock_message:  'Please disable adblock to proceed to the destination page.',

    /* ---- السلوك ---- */
    scroll_to_instruction_on_load:  true,   // تمرير سلس للتعليمات بعد التحديث
    disable_right_click:            true,
    disable_devtools_shortcuts:     true,

    /* ---- أماكن التثبيت (placeholders) ----
     * عناصر الـ div التي ستُملأ بأزرار التخطّي.
     * بدّلها فقط إذا غيّرت أسماء الـ IDs في install-post.html
     */
    top_placeholder_id:    'bflux-top',
    bottom_placeholder_id: 'bflux-bottom',

    /* ---- وضع التصحيح ---- */
    debug: false
  };

  // ============================================================
  // 2) CONFIG MERGE  —  دمج إعدادات المستخدم مع الافتراضية
  // ============================================================
  var CFG = {};
  for (var k in DEFAULTS) {
    if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) {
      var userVal = (typeof window.BLOGGER_FLUX_CONFIG !== 'undefined'
                     && window.BLOGGER_FLUX_CONFIG
                     && typeof window.BLOGGER_FLUX_CONFIG[k] !== 'undefined')
        ? window.BLOGGER_FLUX_CONFIG[k]
        : DEFAULTS[k];
      CFG[k] = userVal;
    }
  }

  function log() {
    if (!CFG.debug) return;
    try { console.log.apply(console, ['[Blogger-Flux]'].concat([].slice.call(arguments))); } catch (e) {}
  }

  // ============================================================
  // 3) STATE PERSISTENCE  (localStorage, TTL 30 دقيقة)
  // ============================================================
  var STATE_KEY = 'bflux_state_' + window.location.pathname + window.location.search;
  var STATE_TTL_MS = 1000 * 60 * 30;

  function saveState(state) {
    try {
      state.savedAt = Date.now();
      state.href = window.location.href;
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STATE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.savedAt) return null;
      if (Date.now() - s.savedAt > STATE_TTL_MS) {
        localStorage.removeItem(STATE_KEY);
        return null;
      }
      return s;
    } catch (e) { return null; }
  }

  function clearState() {
    try { localStorage.removeItem(STATE_KEY); } catch (e) {}
  }

  // ============================================================
  // 4) URL HELPERS
  // ============================================================
  function getQueryParams() {
    var params = {};
    var search = window.location.search.substring(1);
    if (!search) return params;
    var pairs = search.split('&');
    for (var i = 0; i < pairs.length; i++) {
      var eq = pairs[i].indexOf('=');
      var key = eq === -1 ? pairs[i] : pairs[i].substring(0, eq);
      var val = eq === -1 ? '' : pairs[i].substring(eq + 1);
      params[decodeURIComponent(key)] = decodeURIComponent(val.replace(/\+/g, ' '));
    }
    return params;
  }

  function getTargetUrl() {
    var params = getQueryParams();
    var raw = params[CFG.url_param] || '';
    if (!raw) return '';
    if (CFG.url_encoding === 'base64') {
      try { return decodeURIComponent(escape(atob(raw))); }
      catch (e) {
        try { return atob(raw); } catch (e2) { return raw; }
      }
    }
    return raw;
  }

  function encodeTargetUrl(url) {
    if (CFG.url_encoding === 'base64') {
      try { return btoa(unescape(encodeURIComponent(url))); }
      catch (e) { return encodeURIComponent(url); }
    }
    return encodeURIComponent(url);
  }

  // أداة لتوليد روابط safelink (للاستخدام في لوحة بلوجر)
  window.BloggerFlux = {
    buildEntryUrl: function (targetUrl) {
      var base = window.location.pathname;
      return base + '?' + CFG.url_param + '=' + encodeURIComponent(encodeTargetUrl(targetUrl));
    },
    encodeTargetUrl: encodeTargetUrl,
    config: CFG
  };

  // ============================================================
  // 5) ADLINKFLY (اختياري — لتقصير الروابط غير المختصرة)
  // ============================================================
  function buildFinalUrl(targetUrl) {
    if (!CFG.adlinkfly_enabled || !CFG.adlinkfly_domain) return targetUrl;
    var base = CFG.adlinkfly_domain.replace(/\/+$/, '');
    if (CFG.adlinkfly_api_key && CFG.adlinkfly_use_full_endpoint) {
      return base + '/full?api=' + encodeURIComponent(CFG.adlinkfly_api_key)
                   + '&url=' + encodeURIComponent(targetUrl);
    }
    if (CFG.adlinkfly_api_key) {
      return base + '/st?api=' + encodeURIComponent(CFG.adlinkfly_api_key)
                   + '&url=' + encodeURIComponent(targetUrl);
    }
    return base + '/?url=' + encodeURIComponent(targetUrl);
  }

  // ============================================================
  // 6) SMART LINK POPUP
  // ============================================================
  var SMART_LINK_KEY = 'bflux_smartlink_seen';

  function smartLinkShouldFire() {
    if (!CFG.smart_link_enabled || !CFG.smart_link_url) return false;
    if (!CFG.smart_link_cookie_hours || CFG.smart_link_cookie_hours <= 0) return true;
    try {
      var ts = parseInt(localStorage.getItem(SMART_LINK_KEY), 10);
      if (!ts || isNaN(ts)) return true;
      var ageHrs = (Date.now() - ts) / (1000 * 60 * 60);
      return ageHrs >= CFG.smart_link_cookie_hours;
    } catch (e) { return true; }
  }

  function smartLinkMarkFired() {
    try { localStorage.setItem(SMART_LINK_KEY, String(Date.now())); } catch (e) {}
  }

  function smartLinkGate(whichButton, origFn) {
    if (typeof origFn !== 'function') return;
    if (whichButton === CFG.smart_link_trigger && smartLinkShouldFire()) {
      try {
        var w = window.open(CFG.smart_link_url, '_blank', 'noopener,noreferrer');
        if (w) smartLinkMarkFired();
      } catch (e) {}
    }
    origFn();
  }

  // ============================================================
  // 7) DOM HELPERS
  // ============================================================
  function el(id) { return document.getElementById(id); }

  function makeAdSlot(html) {
    if (!html || !String(html).trim()) {
      return document.createComment('ad slot empty');
    }
    var div = document.createElement('div');
    div.className = 'bflux-ad';
    div.innerHTML = '<center>' + html + '</center>';
    return div;
  }

  function makeButton(id, type, text, img, onClick, whichButton) {
    var wrap = document.createElement('div');
    wrap.id = id;
    wrap.className = 'bflux-btn-wrap';
    var a = document.createElement('a');
    a.href = 'javascript:void(0)';
    a.className = 'bflux-btn-link';
    if (type === 'image' && img) {
      var im = document.createElement('img');
      im.src = img;
      im.alt = text;
      im.className = 'bflux-btn-img';
      a.appendChild(im);
    } else {
      a.className += ' bflux-btn bflux-btn-blue';
      a.textContent = text;
    }
    a.addEventListener('click', function () {
      smartLinkGate(whichButton, onClick);
    });
    wrap.appendChild(a);
    return wrap;
  }

  function hide(n) { if (n) n.style.display = 'none'; }
  function show(n) { if (n) n.style.display = 'block'; }

  function smoothScroll(n) {
    if (n && n.scrollIntoView) {
      try { n.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    }
  }

  // ============================================================
  // 8) MAIN FLOW  (5 steps)
  // ============================================================
  var timerCount = CFG.delay_seconds;
  var timerInterval = null;

  // STEP 1: IM NOT ROBOT → save state + reload
  function onRobotClick() {
    saveState({ step: 'timer', countRemaining: timerCount });
    window.location.reload();
  }

  // STEP 2 → 3: timer completes → show CLICK 2X
  function onTimerCompleted() {
    var wait1 = el('bflux-wait1');
    var timerCt = el('bflux-timer-container');
    var generateEl = el('bflux-generate');
    hide(wait1);      // ← إصلاح: إخفاء نص التعليمات بعد انتهاء العدّاد
    hide(timerCt);
    show(generateEl);
    saveState({ step: 'generate' });
    if (CFG.scroll_to_instruction_on_load) smoothScroll(generateEl);
  }

  function startTimer() {
    var timerEl = el('bflux-timer-count');
    timerInterval = setInterval(function () {
      timerCount--;
      if (timerEl) timerEl.textContent = timerCount;
      var tEl = el('bflux-time');
      if (tEl) tEl.textContent = timerCount;
      saveState({ step: 'timer', countRemaining: timerCount });
      if (timerCount <= 0) {
        clearInterval(timerInterval);
        onTimerCompleted();
      }
    }, 1000);
  }

  // STEP 3 → 4: CLICK 2X → show PLEASE WAIT 3s
  function onGenerateClick() {
    var generateEl = el('bflux-generate');
    var glc = el('bflux-get-link-container');
    if (glc) glc.style.display = 'none';

    // ← إصلاح: إخفاء زر CLICK 2X بعد الضغط عليه
    hide(generateEl);

    var wait2 = el('bflux-wait2');
    show(wait2);
    smoothScroll(wait2);
    saveState({ step: 'wait' });

    setTimeout(function () { hide(el('bflux-wait2')); }, CFG.please_wait_ms);
    setTimeout(function () {
      show(el('bflux-get-link-container'));
      // ← إصلاح: تفعيل زر DOWNLOAD LINK بعد انتهاء PLEASE WAIT
      var dlBtn = el('bflux-get-link-btn');
      if (dlBtn) dlBtn.disabled = false;
      saveState({ step: 'link' });
      smoothScroll(el('bflux-get-link-container'));
    }, CFG.please_wait_ms);
  }

  // STEP 5: DOWNLOAD LINK → redirect to target (Adlinkfly)
  function onDownloadClick() {
    clearState();
    var target = getTargetUrl();
    if (!target) {
      alert('No target URL provided.');
      return;
    }
    log('redirecting to:', target);
    window.location.href = buildFinalUrl(target);
  }

  // ============================================================
  // 9) RENDER  —  يرسم التخطّي داخل #bflux-top و #bflux-bottom
  // ============================================================
  function renderTop(topEl) {
    topEl.innerHTML = '';
    topEl.className = 'bflux-zone';

    // ads1: أعلى المنطقة
    topEl.appendChild(makeAdSlot(CFG.ads1));

    // STEP 1: IM NOT ROBOT
    topEl.appendChild(makeButton(
      'bflux-robot', CFG.btn_type, CFG.btn_text_1, CFG.btn_img_1,
      onRobotClick, 'robot'
    ));

    // نص التعليمات (مخفي)
    var wait1 = document.createElement('div');
    wait1.id = 'bflux-wait1';
    wait1.className = 'bflux-instruction';
    wait1.innerHTML = CFG.instruction_text +
      '<span id="bflux-time" style="display:none;">' + CFG.delay_seconds + '</span>';
    topEl.appendChild(wait1);

    // زر العدّاد (مخفي)
    var timerCt = document.createElement('div');
    timerCt.id = 'bflux-timer-container';
    timerCt.className = 'bflux-timer-wrap';
    timerCt.innerHTML = '<button class="bflux-btn bflux-btn-blue" disabled>Please Wait <span id="bflux-timer-count">' + CFG.delay_seconds + '</span> Seconds...</button>';
    topEl.appendChild(timerCt);

    // ads2: أسفل العدّاد
    topEl.appendChild(makeAdSlot(CFG.ads2));
  }

  function renderBottom(bottomEl) {
    bottomEl.innerHTML = '';
    bottomEl.className = 'bflux-zone';

    // ads3: أعلى المنطقة السفلى
    bottomEl.appendChild(makeAdSlot(CFG.ads3));

    // STEP 3: CLICK 2X FOR GENERATE LINK (مخفي)
    var genWrap = makeButton(
      'bflux-generate', CFG.btn_type, CFG.btn_text_2, CFG.btn_img_2,
      onGenerateClick, 'generate'
    );
    genWrap.style.display = 'none';
    bottomEl.appendChild(genWrap);

    // ads4: بين CLICK 2X و DOWNLOAD LINK
    bottomEl.appendChild(makeAdSlot(CFG.ads4));

    // STEP 4: PLEASE WAIT (مخفي)
    var wait2 = document.createElement('div');
    wait2.id = 'bflux-wait2';
    wait2.className = 'bflux-btn-wrap';
    wait2.style.display = 'none';
    if (CFG.btn_type === 'image' && CFG.btn_img_3) {
      wait2.innerHTML = '<img src="' + CFG.btn_img_3 + '" alt="' + CFG.btn_text_3 + '" class="bflux-btn-img"/>';
    } else {
      wait2.innerHTML = '<button class="bflux-btn bflux-btn-blue" disabled>' + CFG.btn_text_3 + '</button>';
    }
    bottomEl.appendChild(wait2);

    // STEP 5: DOWNLOAD LINK (مخفي)
    var glc = document.createElement('div');
    glc.id = 'bflux-get-link-container';
    glc.className = 'bflux-btn-wrap';
    glc.style.display = 'none';
    if (CFG.btn_type === 'image' && CFG.btn_img_4) {
      glc.innerHTML = '<a id="bflux-get-link-btn" href="javascript:void(0)" class="bflux-btn-link">' +
                      '<img src="' + CFG.btn_img_4 + '" alt="' + CFG.btn_text_4 + '" class="bflux-btn-img"/>' +
                      '</a>';
    } else {
      glc.innerHTML = '<button id="bflux-get-link-btn" class="bflux-btn bflux-btn-green" disabled>' + CFG.btn_text_4 + '</button>';
    }
    bottomEl.appendChild(glc);

    // ربط زر DOWNLOAD LINK
    var glb = el('bflux-get-link-btn');
    if (glb) {
      glb.addEventListener('click', function () {
        smartLinkGate('download', onDownloadClick);
      });
    }

    // ads5: أسفل DOWNLOAD LINK
    bottomEl.appendChild(makeAdSlot(CFG.ads5));
    // ads6: أسفل المنطقة السفلى
    bottomEl.appendChild(makeAdSlot(CFG.ads6));
  }

  // ============================================================
  // 10) ANTI-ADBLOCK
  // ============================================================
  function detectAdblock() {
    if (!el('bflux-adb-overlay')) return;
    var blocked = false;
    var url = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
    fetch(new Request(url)).catch(function () { blocked = true; })
      .then(function () {
        if (blocked) {
          var ov = el('bflux-adb-overlay');
          if (ov) ov.style.display = 'block';
          timerCount = 100000;
        }
      });
  }

  function injectAdblockOverlay() {
    if (!CFG.anti_adblock_enabled) return;
    var ov = document.createElement('div');
    ov.id = 'bflux-adb-overlay';
    ov.className = 'bflux-adb-overlay';
    ov.innerHTML = '<div class="bflux-adb-box">' +
                   '<h3>' + CFG.anti_adblock_title + '</h3>' +
                   '<p>' + CFG.anti_adblock_message + '</p>' +
                   '</div>';
    document.body.appendChild(ov);
    detectAdblock();
  }

  // ============================================================
  // 11) STATE RESTORE  —  استعادة الخطوة بعد التحديث
  // ============================================================
  function restoreState() {
    var saved = loadState();
    var robotEl    = el('bflux-robot');
    var wait1El    = el('bflux-wait1');
    var timerCtEl  = el('bflux-timer-container');
    var generateEl = el('bflux-generate');
    var glc        = el('bflux-get-link-container');

    if (!saved) {
      show(robotEl);
      hide(wait1El); hide(timerCtEl); hide(generateEl); hide(glc);
      return;
    }

    if (saved.step !== 'robot') hide(robotEl);

    if (saved.step === 'timer' && saved.countRemaining && saved.countRemaining > 0) {
      timerCount = saved.countRemaining;
      var tEl = el('bflux-timer-count');
      if (tEl) tEl.textContent = timerCount;
      var tEl2 = el('bflux-time');
      if (tEl2) tEl2.textContent = timerCount;
      // ← إصلاح: إظهار العدّاد + التعليمات أثناء العدّ (كان timerCtEl مخفياً)
      show(wait1El); show(timerCtEl); hide(generateEl); hide(glc);
      startTimer();
      if (CFG.scroll_to_instruction_on_load) smoothScroll(wait1El);
    } else if (saved.step === 'generate') {
      hide(wait1El); hide(timerCtEl); show(generateEl); hide(glc);
      smoothScroll(generateEl);
    } else if (saved.step === 'wait') {
      hide(wait1El); hide(timerCtEl); hide(generateEl); hide(glc);
      onGenerateClick();
    } else if (saved.step === 'link') {
      hide(wait1El); hide(timerCtEl); hide(generateEl);
      show(glc);
      // ← إصلاح: تفعيل زر DOWNLOAD LINK عند استعادة الحالة
      var dlBtn = el('bflux-get-link-btn');
      if (dlBtn) dlBtn.disabled = false;
      smoothScroll(glc);
    } else {
      show(robotEl);
    }
  }

  // ============================================================
  // 12) BOOTSTRAP
  // ============================================================
  function boot() {
    // تجاهل الصفحات بدون ?url= (مشاركات عادية)
    var target = getTargetUrl();
    if (!target) {
      log('no ?url= param, skipping (normal blog visit)');
      return;
    }

    var topEl = el(CFG.top_placeholder_id);
    var bottomEl = el(CFG.bottom_placeholder_id);

    if (!topEl && !bottomEl) {
      log('placeholders not found on this page');
      return;
    }

    log('initializing flow with target:', target);

    if (topEl)    renderTop(topEl);
    if (bottomEl) renderBottom(bottomEl);

    // حقن نمط CSS مرة واحدة
    injectStyles();

    // Anti-Adblock
    injectAdblockOverlay();

    // تعطيل النقر باليمين واختصارات DevTools
    if (CFG.disable_right_click) {
      document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }
    if (CFG.disable_devtools_shortcuts) {
      document.addEventListener('keydown', function (e) {
        if (e.keyCode === 123 ||
            (e.ctrlKey && e.keyCode === 85) ||
            (e.ctrlKey && e.shiftKey && e.keyCode === 73) ||
            (e.ctrlKey && e.shiftKey && e.keyCode === 67) ||
            (e.ctrlKey && e.shiftKey && e.keyCode === 74)) {
          e.preventDefault();
        }
      });
    }

    // استعادة الحالة
    restoreState();
  }

  // ============================================================
  // CSS (يُحقن مرة واحدة عند بدء التخطّي فقط — لا يُحمّل على المشاركات العادية)
  // ============================================================
  function injectStyles() {
    if (el('bflux-styles')) return;
    var s = document.createElement('style');
    s.id = 'bflux-styles';
    s.textContent = [
      '.bflux-zone{margin:24px 0;padding:16px;background:#fafafa;border:1px solid #eee;border-radius:8px;}',
      '.bflux-btn-wrap{margin:20px 0;text-align:center;}',
      '.bflux-btn-link{display:inline-block;text-decoration:none;cursor:pointer;}',
      '.bflux-btn-img{max-width:100%;height:auto;border:0;}',
      '.bflux-btn{display:inline-block;padding:14px 32px;font-size:16px;font-weight:700;',
      '  font-family:Arial,sans-serif;border:0;border-radius:8px;cursor:pointer;color:#fff;',
      '  transition:transform .15s,box-shadow .15s;letter-spacing:.5px;}',
      '.bflux-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.15);}',
      '.bflux-btn:active{transform:translateY(0);}',
      '.bflux-btn:disabled{cursor:not-allowed;opacity:.7;}',
      '.bflux-btn-blue{background:linear-gradient(135deg,#4a90e2 0%,#357abd 50%,#2c5f9e 100%);',
      '  background-size:200% 200%;animation:bfluxGrad 3s ease infinite;}',
      '.bflux-btn-green{background:linear-gradient(135deg,#5cb85c 0%,#4cae4c 50%,#3d8b3d 100%);',
      '  background-size:200% 200%;animation:bfluxGrad 3s ease infinite;}',
      '@keyframes bfluxGrad{0%{background-position:0 50%}50%{background-position:100% 50%}100%{background-position:0 50%}}',
      '.bflux-instruction{margin:20px 0;text-align:center;font-size:15px;line-height:1.7;color:#444;padding:12px;',
      '  background:#fff;border:1px dashed #ccc;border-radius:6px;}',
      '.bflux-timer-wrap{text-align:center;margin:20px 0;}',
      '.bflux-ad{margin:16px 0;text-align:center;}',
      '.bflux-adb-overlay{display:none;position:fixed;inset:0;background:rgba(51,51,51,.95);z-index:10000;text-align:center;}',
      '.bflux-adb-box{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);',
      '  padding:30px 40px;background:#fff;border-radius:12px;min-width:320px;max-width:90%;}',
      '.bflux-adb-box h3{color:#dc3545;margin-top:0;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ============================================================
  // RUN
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
