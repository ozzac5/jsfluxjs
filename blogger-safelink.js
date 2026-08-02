/*!
 * ============================================================
 * Blogger Safelink v1.0.0 — بديل WP-Flux لمنصة بلوجر
 * ============================================================
 * ميزات: سلسلة صفحات متعددة، تكامل AdLinkFly، أزرار صور/نصية،
 * تايمر، حماية Anti-Adblock، كابتشا، Smart Link، تحويل تلقائي
 * ============================================================
 */
(function () {
  'use strict';

  /* ==========================================================
     إعدادات افتراضية — يتحكم المستخدم عبر window.BLOGGER_SAFELINK_CONFIG
     ========================================================== */
  var DEFAULTS = {
    blogUrl:              '',
    adlinkflyDomain:      '',
    adlinkflyEnabled:     false,
    permalinkParam:       'go',
    pageCount:            2,
    randomPostOrder:      true,
    delaySeconds:         10,
    pleaseWaitMs:         3000,
    buttonType:           'image',
    buttonPosition:       'both',
    imageRobot:           '',
    imageGenerate:        '',
    imageWait:            '',
    imageDownload:        '',
    textRobot:            'IM NOT ROBOT',
    textGenerate:         'CLICK 2X FOR GENERATE LINK',
    textWait:             'PLEASE WAIT ...',
    textDownload:         'DOWNLOAD LINK',
    delayText:            'Click On Any Images Then Back And Wait For The Link (If Page Not Working Refresh The Page)',
    antiAdblock:          false,
    antiAdblockTitle:     'Adblock Detected',
    antiAdblockMessage:   'Please disable adblock to proceed to the destination page',
    captchaEnabled:       false,
    captchaProvider:      'recaptcha',
    recaptchaSiteKey:     '',
    hcaptchaSiteKey:      '',
    captchaText:          'Please complete the captcha verification first',
    smartLinkEnabled:     false,
    smartLinkUrl:         '',
    smartLinkTriggerButton:'generate',
    smartLinkCookieHours: 24,
    autoConvert:          false,
    autoConvertMethod:    'include',
    autoConvertDomains:   [],
    secondSafelinkUrl:    '',
    ads1: '', ads2: '', ads3: '', ads4: '', ads5: '', ads6: '', ads7: '',
    logoUrl:              '',
    bottomAdFullScreen:   true,
    newTab:               false,
    debug:                false
  };

  var CFG = {};
  for (var k in DEFAULTS) { if (DEFAULTS.hasOwnProperty(k)) CFG[k] = DEFAULTS[k]; }
  if (window.BLOGGER_SAFELINK_CONFIG) {
    for (var k2 in window.BLOGGER_SAFELINK_CONFIG) {
      if (window.BLOGGER_SAFELINK_CONFIG.hasOwnProperty(k2)) CFG[k2] = window.BLOGGER_SAFELINK_CONFIG[k2];
    }
  }

  function log() { if (CFG.debug && window.console) console.log.apply(console, ['[BloggerSafelink]'].concat([].slice.call(arguments))); }

  /* ==========================================================
     إدارة الحالة — localStorage
     ========================================================== */
  var STATE_PREFIX = 'bsaf_';
  var STATE_TTL   = 30 * 60 * 1000;

  var State = {
    _key: function () { return STATE_PREFIX + 'skip_' + window.location.pathname + window.location.search; },
    save: function (obj) {
      try { obj.savedAt = Date.now(); localStorage.setItem(this._key(), JSON.stringify(obj)); } catch (e) {}
    },
    load: function () {
      try {
        var r = localStorage.getItem(this._key());
        if (!r) return null;
        var s = JSON.parse(r);
        if (!s || !s.savedAt || Date.now() - s.savedAt > STATE_TTL) { localStorage.removeItem(this._key()); return null; }
        return s;
      } catch (e) { return null; }
    },
    clear: function () { try { localStorage.removeItem(this._key()); } catch (e) {} }
  };

  /* ==========================================================
     أدوات URL
     ========================================================== */
  function getParam(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return m ? decodeURIComponent(m[1]) : '';
  }
  function getSafeId()   { return getParam(CFG.permalinkParam); }
  function getStep()     { var s = getParam('step'); return s ? Math.max(1, parseInt(s, 10) || 1) : 1; }
  function isSafelink()  { return getSafeId() !== ''; }

  function buildStepUrl(safeId, step, postUrl) {
    var base = postUrl || window.location.href.split('?')[0];
    var sep = base.indexOf('?') !== -1 ? '&' : '?';
    return base + sep + CFG.permalinkParam + '=' + encodeURIComponent(safeId) + '&step=' + step;
  }

  /* ==========================================================
     جلب مقالات عشوائية — JSONP مع Blogger Feed API
     ========================================================== */
  var PostFetcher = {
    _posts: [],
    _loading: false,
    _queue: [],

    fetch: function (cb) {
      var self = this;
      if (self._posts.length > 0) { cb(self._posts); return; }
      self._queue.push(cb);
      if (self._loading) return;
      self._loading = true;

      var cbName = 'bsaf_jsonp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      window[cbName] = function (data) {
        var entries = data.feed && data.feed.entry ? data.feed.entry : [];
        var posts = [];
        for (var i = 0; i < entries.length; i++) {
          var links = entries[i].link || [];
          for (var j = 0; j < links.length; j++) {
            if (links[j].rel === 'alternate') { posts.push(links[j].href); break; }
          }
        }
        self._posts = posts;
        self._loading = false;
        for (var k = 0; k < self._queue.length; k++) self._queue[k](posts);
        self._queue = [];
        try { delete window[cbName]; } catch (e) {}
        var el = document.getElementById(cbName);
        if (el && el.parentNode) el.parentNode.removeChild(el);
      };

      var url = CFG.blogUrl.replace(/\/+$/, '') + '/feeds/posts/default?alt=json-in-script&max-results=500&callback=' + cbName;
      var s = document.createElement('script');
      s.id = cbName;
      s.src = url;
      s.onerror = function () {
        self._loading = false;
        for (var k = 0; k < self._queue.length; k++) self._queue[k]([]);
        self._queue = [];
        try { delete window[cbName]; } catch (e) {}
        if (s.parentNode) s.parentNode.removeChild(s);
      };
      document.head.appendChild(s);
    },

    getRandom: function (exclude, cb) {
      this.fetch(function (posts) {
        if (posts.length === 0) { cb(''); return; }
        var filtered = posts.filter(function (p) { return exclude.indexOf(p) === -1; });
        if (filtered.length === 0) filtered = posts;
        cb(filtered[Math.floor(Math.random() * filtered.length)]);
      });
    }
  };

  /* ==========================================================
     فك تشفير الرابط الهدف
     ========================================================== */
  function decodeTarget(safeId) {
    // محاولة base64
    try {
      var d = atob(safeId);
      if (d.indexOf('http') === 0) return d;
    } catch (e) {}
    // إذا كان AdLinkFly مفعّل، الـ alias يُحوّل عبر نطاق AdLinkFly
    if (CFG.adlinkflyEnabled && CFG.adlinkflyDomain) {
      return CFG.adlinkflyDomain.replace(/\/+$/, '') + '/' + safeId;
    }
    return safeId;
  }

  /* ==========================================================
     صور أزرار SVG افتراضية
     ========================================================== */
  function svgBtn(text, color) {
    return 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="68" viewBox="0 0 320 68">' +
      '<rect width="320" height="68" rx="34" fill="' + color + '"/>' +
      '<text x="160" y="43" text-anchor="middle" fill="white" font-size="15" font-weight="bold" font-family="sans-serif">' + text + '</text></svg>'
    );
  }

  var IMAGES = {
    robot:    CFG.imageRobot    || svgBtn('IM NOT ROBOT', '#673AB7'),
    generate: CFG.imageGenerate || svgBtn('CLICK 2X FOR GENERATE LINK', '#2196F3'),
    wait:     CFG.imageWait     || svgBtn('PLEASE WAIT ...', '#FF9800'),
    download: CFG.imageDownload || svgBtn('DOWNLOAD LINK', '#4CAF50')
  };

  /* ==========================================================
     بناء HTML للأزرار
     ========================================================== */
  function actionBtn(type, onclick, isLink) {
    if (CFG.buttonType === 'image') {
      var tag = isLink ? 'a' : 'span';
      return '<' + tag + ' class="bsaf-action" href="javascript:void(0)" onclick="' + onclick + '">' +
        '<img src="' + IMAGES[type] + '" alt="' + type + '"/></' + tag + '>';
    }
    var texts = { robot: CFG.textRobot, generate: CFG.textGenerate, wait: CFG.textWait, download: CFG.textDownload };
    return '<button class="bsaf-btn" onclick="' + onclick + '">' + (texts[type] || type) + '</button>';
  }

  /* ==========================================================
     واجهة المستخدم — CSS + HTML
     ========================================================== */
  function injectCSS() {
    if (document.getElementById('bsaf-css')) return;
    var s = document.createElement('style');
    s.id = 'bsaf-css';
    s.textContent = [
      '.bsaf-container{max-width:700px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.1);overflow:hidden}',
      '.bsaf-header{background:linear-gradient(135deg,#673AB7 0,#2196F3 50%,#00BCD4 100%);color:#fff;padding:18px;text-align:center;font-size:17px;font-weight:700;letter-spacing:.5px}',
      '.bsaf-body{padding:22px 18px;text-align:center}',
      '.bsaf-ad-slot{margin:10px 0;min-height:8px;text-align:center;overflow:hidden}',
      '.bsaf-step{margin:18px 0;text-align:center}',
      '.bsaf-action{display:inline-block;background:transparent!important;border:none;padding:0;cursor:pointer;text-decoration:none;-webkit-tap-highlight-color:transparent}',
      '.bsaf-action img{display:block;max-width:100%;height:auto;margin:0 auto;border-radius:8px;transition:transform .15s}',
      '.bsaf-action:active img{transform:scale(.97)}',
      '.bsaf-btn{display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#fff!important;background:linear-gradient(135deg,#673AB7 0,#2196F3 50%,#00BCD4 100%);border:none;border-radius:100px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.2);transition:all .2s}',
      '.bsaf-btn:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.3)}',
      '.bsaf-timer-msg{font-size:15px;line-height:1.6;color:#555;margin:16px 0}',
      '#bsaf-time{display:none}',
      '.bsaf-captcha-box{display:inline-block;margin:16px 0}',
      '.bsaf-adb-overlay{display:none;position:fixed;width:100%;height:100%;left:0;top:0;background:rgba(51,51,51,.95);z-index:10000;text-align:center}',
      '.bsaf-adb-box{position:fixed;z-index:99999;left:50%;top:50%;transform:translate(-50%,-50%);padding:28px 36px;background:#fff;border-radius:12px;min-width:300px;max-width:90%}',
      '.bsaf-adb-box h3{color:#dc3545;margin-top:0}',
      '.bsaf-logo{max-height:34px;margin:0 auto 8px;display:block}',
      '.bsaf-footer-note{text-align:center;color:#999;padding:12px;font-size:11px}',
      '@media(max-width:600px){.bsaf-body{padding:14px 10px}.bsaf-container{border-radius:0}.bsaf-btn{padding:12px 24px;font-size:13px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function buildTopHTML(delay) {
    var h = '';
    if (CFG.logoUrl) h += '<img src="' + CFG.logoUrl + '" alt="Logo" class="bsaf-logo"/>';
    h += '<div class="bsaf-container"><div class="bsaf-header">Secure Download Page</div><div class="bsaf-body">';
    h += '<div class="bsaf-ad-slot">' + CFG.ads1 + '</div>';

    // الخطوة 1: أنا لست روبوت
    h += '<div id="bsaf-robot" class="bsaf-step">' + actionBtn('robot', 'bsafRobotClick()', true) + '</div>';

    // الخطوة 2: رسالة الانتظار + العد التنازلي المخفي
    h += '<div id="bsaf-wait1" class="bsaf-step" style="display:none">';
    h += '<p class="bsaf-timer-msg">' + CFG.delayText.replace('{time}', '<span id="bsaf-time">' + delay + '</span>') + '</p>';
    h += '</div>';

    // كابتشا
    if (CFG.captchaEnabled) {
      h += '<div id="bsaf-captcha" class="bsaf-step" style="display:none"><div class="bsaf-captcha-box">';
      if (CFG.captchaProvider === 'hcaptcha' && CFG.hcaptchaSiteKey) {
        h += '<div class="h-captcha" data-sitekey="' + CFG.hcaptchaSiteKey + '" data-callback="bsafCaptchaVerified"></div>';
      } else if (CFG.recaptchaSiteKey) {
        h += '<div class="g-recaptcha" data-sitekey="' + CFG.recaptchaSiteKey + '" data-callback="bsafCaptchaVerified"></div>';
      }
      h += '</div></div>';
    }

    // الخطوة 3: انقر مرتين
    h += '<div id="bsaf-generate" class="bsaf-step" style="display:none">' + actionBtn('generate', 'bsafGenerate()', true) + '</div>';

    h += '<div class="bsaf-ad-slot">' + CFG.ads2 + '</div>';
    h += '<div class="bsaf-ad-slot">' + CFG.ads3 + '</div>';
    h += '</div></div>';
    return h;
  }

  function buildBottomHTML() {
    var h = '<div class="bsaf-container"><div class="bsaf-body">';
    h += '<div class="bsaf-ad-slot">' + CFG.ads4 + '</div>';

    // الخطوة 4: يرجى الانتظار
    h += '<div id="bsaf-wait2" class="bsaf-step" style="display:none">' + actionBtn('wait', 'void(0)', false) + '</div>';

    // الخطوة 5: رابط التحميل
    h += '<div id="bsaf-link" class="bsaf-step" style="display:none">' + actionBtn('download', 'bsafOpenLink()', true) + '</div>';

    h += '<div class="bsaf-ad-slot">' + CFG.ads5 + '</div>';
    h += '<div class="bsaf-ad-slot">' + CFG.ads6 + '</div>';
    h += '<div class="bsaf-ad-slot">' + CFG.ads7 + '</div>';
    h += '</div></div>';
    return h;
  }

  function buildAdblockOverlay() {
    if (!CFG.antiAdblock) return '';
    return '<div id="bsaf-adb" class="bsaf-adb-overlay"><div class="bsaf-adb-box">' +
      '<h3>' + CFG.antiAdblockTitle + '</h3><p>' + CFG.antiAdblockMessage + '</p></div></div>';
  }

  /* ==========================================================
     متغيرات التحكم
     ========================================================== */
  var _safeId = '';
  var _step   = 1;
  var _count  = 0;
  var _counter = null;
  var _captchaVerified = false;
  var _targetUrl = '';
  var _generateClickCount = 0;

  /* ==========================================================
     تحكم سلسلة التخطي
     ========================================================== */
  function restoreState() {
    var saved = State.load();
    var ids = ['bsaf-robot', 'bsaf-wait1', 'bsaf-generate', 'bsaf-wait2', 'bsaf-link', 'bsaf-captcha'];
    var els = {};
    for (var i = 0; i < ids.length; i++) els[ids[i]] = document.getElementById(ids[i]);

    if (!saved) {
      // زيارة جديدة
      show('bsaf-robot'); hide('bsaf-wait1'); hide('bsaf-generate'); hide('bsaf-wait2'); hide('bsaf-link'); hide('bsaf-captcha');
      return;
    }

    if (saved.skipStep !== 'robot') hide('bsaf-robot');

    switch (saved.skipStep) {
      case 'timer':
        if (saved.countRemaining > 0) {
          _count = saved.countRemaining;
          var el = document.getElementById('bsaf-time');
          if (el) el.innerHTML = _count;
          show('bsaf-wait1');
          startTimer();
        }
        break;
      case 'captcha':
        hide('bsaf-wait1');
        show('bsaf-captcha');
        break;
      case 'generate':
        hide('bsaf-wait1'); hide('bsaf-captcha');
        show('bsaf-generate');
        break;
      case 'wait':
        hide('bsaf-wait1'); hide('bsaf-captcha');
        show('bsaf-generate'); show('bsaf-wait2'); hide('bsaf-link');
        triggerWaitToLink();
        break;
      case 'link':
        hide('bsaf-wait1'); hide('bsaf-captcha'); hide('bsaf-wait2');
        show('bsaf-generate'); show('bsaf-link');
        break;
      default:
        show('bsaf-robot');
    }
  }

  function show(id) { var e = document.getElementById(id); if (e) e.style.display = 'block'; }
  function hide(id) { var e = document.getElementById(id); if (e) e.style.display = 'none'; }

  function startTimer() {
    if (_counter) clearInterval(_counter);
    _counter = setInterval(function () {
      _count--;
      var el = document.getElementById('bsaf-time');
      if (el) el.innerHTML = _count;
      State.save({ skipStep: 'timer', countRemaining: _count });
      if (_count <= 0) {
        clearInterval(_counter);
        _counter = null;
        timerCompleted();
      }
    }, 1000);
  }

  function timerCompleted() {
    hide('bsaf-wait1');
    if (CFG.captchaEnabled) {
      show('bsaf-captcha');
      State.save({ skipStep: 'captcha' });
    } else {
      show('bsaf-generate');
      State.save({ skipStep: 'generate' });
    }
  }

  function triggerWaitToLink() {
    setTimeout(function () {
      hide('bsaf-wait2');
      show('bsaf-link');
      State.save({ skipStep: 'link' });
    }, CFG.pleaseWaitMs);
  }

  /* ==========================================================
     دوال عامة — يصل إليها onclick
     ========================================================== */

  // الخطوة 1: أنا لست روبوت
  window.bsafRobotClick = function () {
    smartLinkGate('robot');
    State.save({ skipStep: 'timer', countRemaining: _count > 0 ? _count : CFG.delaySeconds });
    window.location.reload();
  };

  // كابتشا
  window.bsafCaptchaVerified = function () {
    _captchaVerified = true;
    hide('bsaf-captcha');
    show('bsaf-generate');
    State.save({ skipStep: 'generate' });
  };

  // الخطوة 3: انقر مرتين — يتطلب نقرتين فعلياً
  window.bsafGenerate = function () {
    if (CFG.captchaEnabled && !_captchaVerified) { alert(CFG.captchaText); return; }

    _generateClickCount++;
    if (_generateClickCount < 2) {
      // النقرة الأولى — سكرول إلى الأسفل
      var genEl = document.getElementById('bsaf-generate');
      if (genEl && genEl.scrollIntoView) genEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    smartLinkGate('generate');

    if (CFG.bottomAdFullScreen) {
      var g = document.getElementById('bsaf-generate');
      if (g) g.style.height = '1500px';
    }

    var genEl2 = document.getElementById('bsaf-generate');
    if (genEl2 && genEl2.scrollIntoView) genEl2.scrollIntoView({ behavior: 'smooth', block: 'center' });

    hide('bsaf-link');
    show('bsaf-wait2');
    State.save({ skipStep: 'wait' });
    triggerWaitToLink();
  };

  // الخطوة 5: رابط التحميل
  window.bsafOpenLink = function () {
    smartLinkGate('download');
    State.clear();

    var pageCount = Math.max(1, CFG.pageCount);

    // سلسلة الصفحات المتعددة
    if (pageCount > 1 && _step > 1) {
      var nextStep = _step - 1;
      if (CFG.randomPostOrder) {
        var visited = getParam('visited');
        var excludeList = visited ? visited.split(',') : [];
        excludeList.push(window.location.href.split('?')[0]);
        PostFetcher.getRandom(excludeList, function (postUrl) {
          if (postUrl) {
            nextUrl = buildStepUrl(_safeId, nextStep, postUrl);
          } else {
            nextUrl = buildStepUrl(_safeId, nextStep);
          }
          window.location.href = nextUrl;
        });
      } else {
        window.location.href = buildStepUrl(_safeId, nextStep);
      }
      return;
    }

    // الصفحة الأخيرة — توجيه نهائي
    var target = _targetUrl;
    if (CFG.secondSafelinkUrl) {
      target = CFG.secondSafelinkUrl + '?' + CFG.permalinkParam + '=' + encodeURIComponent(target);
      if (CFG.pageCount > 1) target += '&step=' + CFG.pageCount;
    }
    if (CFG.newTab) {
      window.open(target, '_blank');
    } else {
      window.location.href = target;
    }
  };

  /* ==========================================================
     Smart Link — نافذة منبثقة
     ========================================================== */
  var SL_KEY = 'bsaf_sl_seen';

  function smartLinkGate(whichButton) {
    if (!CFG.smartLinkEnabled || !CFG.smartLinkUrl) return;
    if (CFG.smartLinkTriggerButton !== whichButton) return;

    // هل تم فتح النافذة مؤخراً؟
    if (CFG.smartLinkCookieHours > 0) {
      try {
        var ts = parseInt(localStorage.getItem(SL_KEY), 10);
        if (ts && !isNaN(ts) && (Date.now() - ts) / (1000 * 60 * 60) < CFG.smartLinkCookieHours) return;
      } catch (e) {}
    }

    try {
      var win = window.open(CFG.smartLinkUrl, '_blank', 'noopener,noreferrer');
      if (win) try { localStorage.setItem(SL_KEY, String(Date.now())); } catch (e) {}
    } catch (e) {}
  }

  /* ==========================================================
     Anti-Adblock
     ========================================================== */
  function detectAdblock() {
    if (!CFG.antiAdblock) return;
    (async function () {
      var blocked = false;
      try {
        await fetch(new Request('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js')).catch(function () { blocked = true; });
      } catch (e) { blocked = true; }
      finally {
        if (blocked) {
          var o = document.getElementById('bsaf-adb');
          if (o) o.style.display = 'block';
          _count = 100000;
        }
      }
    })();
  }

  /* ==========================================================
     تحويل تلقائي للروابط
     ========================================================== */
  function autoConvertLinks() {
    if (!CFG.autoConvert) return;
    var links = document.querySelectorAll('a[href]');
    var domains = CFG.autoConvertDomains;
    var blogHost = CFG.blogUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');

    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (!href || href.indexOf('http') !== 0) continue;

      var shouldConvert = false;
      if (CFG.autoConvertMethod === 'include') {
        for (var d = 0; d < domains.length; d++) {
          if (href.indexOf(domains[d]) !== -1) { shouldConvert = true; break; }
        }
      } else {
        shouldConvert = true;
        if (href.indexOf(blogHost) !== -1) continue;
        for (var d2 = 0; d2 < domains.length; d2++) {
          if (href.indexOf(domains[d2]) !== -1) { shouldConvert = false; break; }
        }
      }

      if (shouldConvert) {
        var encoded;
        try { encoded = btoa(href); } catch (e) { continue; }
        var newUrl = CFG.blogUrl.replace(/\/+$/, '') + '?' + CFG.permalinkParam + '=' + encodeURIComponent(encoded);
        if (CFG.pageCount > 1) newUrl += '&step=' + CFG.pageCount;
        links[i].setAttribute('href', newUrl);
        links[i].setAttribute('rel', 'nofollow');
      }
    }
  }

  /* ==========================================================
     العرض الرئيسي
     ========================================================== */
  function render() {
    var safeId = getSafeId();
    if (!safeId) return;

    _safeId    = safeId;
    _step      = getStep();
    _count     = CFG.delaySeconds;
    _captchaVerified = !CFG.captchaEnabled;
    _targetUrl = decodeTarget(safeId);

    log('safelink page detected', { safeId: safeId, step: _step, target: _targetUrl });

    injectCSS();

    // البحث عن حاويات أو إنشاؤها
    var topEl = document.getElementById('bsaf-top');
    var botEl = document.getElementById('bsaf-bottom');

    if (!topEl) {
      topEl = document.createElement('div');
      topEl.id = 'bsaf-top';
      var postBody = document.querySelector('.post-body') || document.querySelector('article') || document.querySelector('.entry-content') || document.body;
      postBody.insertBefore(topEl, postBody.firstChild);
    }
    if (!botEl) {
      botEl = document.createElement('div');
      botEl.id = 'bsaf-bottom';
      var postBody2 = document.querySelector('.post-body') || document.querySelector('article') || document.querySelector('.entry-content') || document.body;
      postBody2.appendChild(botEl);
    }

    var topHTML = buildTopHTML(CFG.delaySeconds);
    var botHTML = buildBottomHTML();

    // إدراج حسب الموضع
    if (CFG.buttonPosition === 'top') {
      topEl.innerHTML = topHTML + botHTML;
      botEl.innerHTML = '';
    } else if (CFG.buttonPosition === 'bottom') {
      topEl.innerHTML = '';
      botEl.innerHTML = topHTML + botHTML;
    } else {
      topEl.innerHTML = topHTML;
      botEl.innerHTML = botHTML;
    }

    // كابتشا سكربت
    if (CFG.captchaEnabled) {
      var cs = document.createElement('script');
      cs.src = CFG.captchaProvider === 'hcaptcha' ? 'https://hcaptcha.com/1/api.js' : 'https://www.google.com/recaptcha/api.js';
      cs.async = true;
      document.head.appendChild(cs);
    }

    // Anti-adblock overlay
    var adbWrap = document.createElement('div');
    adbWrap.innerHTML = buildAdblockOverlay();
    while (adbWrap.firstChild) document.body.appendChild(adbWrap.firstChild);

    // استعادة الحالة
    restoreState();

    // كشف مانع الإعلانات
    detectAdblock();
  }

  /* ==========================================================
     التهيئة
     ========================================================== */
  function init() {
    log('initializing, isSafelink=', isSafelink());

    if (!isSafelink()) {
      autoConvertLinks();
      return;
    }

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
