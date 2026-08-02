/**
 * ============================================================
 *  Safelink Blogger Script v1.0
 *  سكربت Safelink لمنصات بلوجر مع ربط adlinkfly
 * ============================================================
 *
 *  هذا الملف يُرفع على GitHub ويُربط عبر jsDelivr CDN
 *  الإعدادات تُمرَّر من قالب بلوجر عبر window.SAFELINK_CONFIG
 *  لا تعدل هذا الملف — الإعدادات كلها في قالب بلوجر
 *
 * ============================================================
 */

(function () {
    'use strict';

    /* ════════════════════════════════════════════════════════════
     *  الإعدادات الافتراضية (يتم تجاوزها بـ SAFELINK_CONFIG
     *  الموجود في قالب بلوجر)
     * ════════════════════════════════════════════════════════════ */
    var DEFAULTS = {
        blogDomain        : '',
        adlinkflyUrl      : '',
        adlinkflyPath     : '/',
        goParamName       : 'go',
        totalPages        : 2,
        randomSequence    : true,
        timerEnabled      : true,
        timerDuration     : 10,
        timerText         : 'يرجى الانتظار {seconds} ثوانٍ...',
        scrollRequired    : true,
        scrollPercentage  : 75,
        scrollReveal      : true,
        buttonPosition    : 'footer',
        headerButtonImage : '',
        footerButtonImage : '',
        buttonText        : 'اضغط هنا للمتابعة',
        buttonWidth       : '200px',
        customPosts       : [],
        autoRedirect      : true,
        debugMode         : false,
        postBodySelector  : '.post-body, .entry-content, .post-content',
        mainContentSelector: '.blog-posts, #Blog1, .main-content, main, #content'
    };

    /* دمج الإعدادات من قالب بلوجر مع الافتراضية */
    var C = {};
    var userConfig = window.SAFELINK_CONFIG || {};
    for (var k in DEFAULTS) {
        C[k] = (userConfig[k] !== undefined) ? userConfig[k] : DEFAULTS[k];
    }

    /* ════════════════════════════════════════════════════════════
     *  مفاتيح sessionStorage
     * ════════════════════════════════════════════════════════════ */
    var K = {
        alias  : 'sl_alias',
        active : 'sl_active',
        page   : 'sl_page',
        total  : 'sl_total',
        queue  : 'sl_queue',
        qidx   : 'sl_qidx'
    };

    /* ════════════════════════════════════════════════════════════
     *  دوال مساعدة
     * ════════════════════════════════════════════════════════════ */

    function log() {
        if (!C.debugMode) return;
        var args = ['[Safelink]'];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.log.apply(console, args);
    }

    function qs(name) {
        return new URLSearchParams(window.location.search).get(name);
    }

    function shuffle(a) {
        var s = a.slice();
        for (var i = s.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = s[i]; s[i] = s[j]; s[j] = t;
        }
        return s;
    }

    function get(k) { try { return sessionStorage.getItem(k); } catch(e) { return null; } }
    function set(k, v) { try { sessionStorage.setItem(k, typeof v === 'object' ? JSON.stringify(v) : String(v)); } catch(e) {} }
    function clearAll() { for (var k in K) try { sessionStorage.removeItem(K[k]); } catch(e) {} }

    function findEl(selector) {
        var parts = selector.split(',').map(function(s){ return s.trim(); });
        for (var i = 0; i < parts.length; i++) {
            var el = document.querySelector(parts[i]);
            if (el) return el;
        }
        return null;
    }

    /* ════════════════════════════════════════════════════════════
     *  CSS
     * ════════════════════════════════════════════════════════════ */

    function injectCSS() {
        if (document.getElementById('sl-css')) return;
        var s = document.createElement('style');
        s.id = 'sl-css';
        s.textContent = '\
.sl-wrap{background:linear-gradient(135deg,#f8f9fa,#e9ecef);border:1px solid #dee2e6;border-radius:12px;padding:24px 20px;margin:20px 0;text-align:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans SC",sans-serif;direction:rtl;box-shadow:0 2px 8px rgba(0,0,0,.06)}\
.sl-steps{display:flex;justify-content:center;gap:8px;margin-bottom:16px}\
.sl-step{width:28px;height:28px;border-radius:50%;background:#e9ecef;color:#6c757d;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;transition:all .3s}\
.sl-step.on{background:#0d6efd;color:#fff;box-shadow:0 0 0 3px rgba(13,110,253,.25)}\
.sl-step.ok{background:#198754;color:#fff}\
.sl-line{width:20px;height:2px;background:#dee2e6;align-self:center}\
.sl-line.ok{background:#198754}\
.sl-timer{font-size:15px;color:#495057;margin-bottom:10px;min-height:22px}\
.sl-bar{width:100%;max-width:320px;height:6px;background:#e9ecef;border-radius:3px;overflow:hidden;margin:0 auto 14px}\
.sl-prog{height:100%;background:linear-gradient(90deg,#0d6efd,#6610f2);border-radius:3px;width:0%;transition:width 1s linear}\
.sl-hint{font-size:13px;color:#6c757d;margin-top:10px;animation:sl-b 2s infinite}\
@keyframes sl-b{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}\
.sl-btn{display:inline-block;cursor:pointer;border:none;outline:none;background:none;padding:0;transition:all .3s;text-decoration:none}\
.sl-btn:disabled{opacity:.4;cursor:not-allowed;filter:grayscale(100%);transform:none!important}\
.sl-btn:hover:not(:disabled){transform:scale(1.05);filter:brightness(1.05)}\
.sl-btn:active:not(:disabled){transform:scale(.97)}\
.sl-btn img{max-width:' + C.buttonWidth + ';height:auto;display:block;margin:0 auto}\
.sl-btn-txt{display:inline-block;padding:12px 36px;background:linear-gradient(135deg,#0d6efd,#6610f2);color:#fff;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:.3px;box-shadow:0 4px 12px rgba(13,110,253,.3)}\
.sl-btn-txt:hover:not(:disabled){box-shadow:0 6px 18px rgba(13,110,253,.4)}\
.sl-gen{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;color:#fff;font-size:18px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;direction:rtl}\
.sl-spin{width:48px;height:48px;border:5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:sl-r .8s linear infinite;margin-bottom:16px}\
@keyframes sl-r{to{transform:rotate(360deg)}}\
.sl-hide{display:none!important}\
@media(max-width:480px){.sl-wrap{padding:16px 12px}.sl-btn-txt{padding:10px 24px;font-size:14px}.sl-btn img{max-width:160px}}\
';
        document.head.appendChild(s);
    }

    /* ════════════════════════════════════════════════════════════
     *  جلب المقالات العشوائية
     * ════════════════════════════════════════════════════════════ */

    function fetchPosts(cb) {
        if (C.customPosts && C.customPosts.length > 0) {
            cb(C.randomSequence ? shuffle(C.customPosts) : C.customPosts.slice());
            return;
        }
        var url = window.location.origin + '/feeds/posts/default?alt=json&max-results=500';
        log('Fetch:', url);
        var x = new XMLHttpRequest();
        x.open('GET', url, true);
        x.timeout = 10000;
        x.onload = function () {
            if (x.status !== 200) { cb([]); return; }
            try {
                var d = JSON.parse(x.responseText);
                var entries = (d.feed && d.feed.entry) ? d.feed.entry : [];
                var posts = [];
                entries.forEach(function (e) {
                    if (!e.link) return;
                    for (var i = 0; i < e.link.length; i++) {
                        if (e.link[i].rel === 'alternate') { posts.push(e.link[i].href); break; }
                    }
                });
                var cur = window.location.href.split('?')[0].split('#')[0];
                posts = posts.filter(function (u) { return u.split('?')[0].split('#')[0] !== cur; });
                if (C.randomSequence) posts = shuffle(posts);
                log('Posts:', posts.length);
                cb(posts);
            } catch (e) { log('Parse err:', e); cb([]); }
        };
        x.onerror = function () { cb([]); };
        x.ontimeout = function () { cb([]); };
        x.send();
    }

    /* ════════════════════════════════════════════════════════════
     *  مؤشر الخطوات
     * ════════════════════════════════════════════════════════════ */

    function stepsUI(cur, tot) {
        var d = document.createElement('div');
        d.className = 'sl-steps';
        for (var i = 1; i <= tot; i++) {
            if (i > 1) {
                var ln = document.createElement('div');
                ln.className = 'sl-line' + (i <= cur ? ' ok' : '');
                d.appendChild(ln);
            }
            var s = document.createElement('div');
            s.className = 'sl-step';
            if (i < cur) { s.classList.add('ok'); s.innerHTML = '&#10003;'; }
            else if (i === cur) { s.classList.add('on'); s.textContent = i; }
            else { s.textContent = i; }
            d.appendChild(s);
        }
        return d;
    }

    /* ════════════════════════════════════════════════════════════
     *  بناء زر
     * ════════════════════════════════════════════════════════════ */

    function mkBtn(img, dis) {
        var b = document.createElement('button');
        b.className = 'sl-btn';
        b.disabled = dis;
        if (img) {
            var im = document.createElement('img');
            im.src = img; im.alt = C.buttonText;
            b.appendChild(im);
        } else {
            var sp = document.createElement('span');
            sp.className = 'sl-btn-txt';
            sp.textContent = C.buttonText;
            b.appendChild(sp);
        }
        return b;
    }

    /* ════════════════════════════════════════════════════════════
     *  إنشاء واجهة كاملة
     * ════════════════════════════════════════════════════════════ */

    function buildUI() {
        var cur = parseInt(get(K.page)) || 1;
        var tot = parseInt(get(K.total)) || C.totalPages;
        log('Build UI — page', cur, '/', tot);

        var target = findEl(C.postBodySelector) || findEl(C.mainContentSelector);
        if (!target) { log('No target element'); return; }

        /* حالات التايمر والسكرول */
        var timerOk  = !C.timerEnabled;
        var scrollOk = !C.scrollRequired;
        var btnReady = timerOk && scrollOk;

        /* دالة تفعيل الأزرار */
        function enableBtns() {
            document.querySelectorAll('.sl-btn').forEach(function (b) { b.disabled = false; });
            document.querySelectorAll('.sl-hint').forEach(function (h) { h.classList.add('sl-hide'); });
        }

        /* دالة النقر */
        function onClick(e) { e.preventDefault(); goNext(); }

        /* تحديد الأماكن */
        var places = [];
        if (C.buttonPosition === 'header' || C.buttonPosition === 'both')
            places.push({ pos: 'header', img: C.headerButtonImage || C.footerButtonImage });
        if (C.buttonPosition === 'footer' || C.buttonPosition === 'both')
            places.push({ pos: 'footer', img: C.footerButtonImage || C.headerButtonImage });

        /* إنشاء حاوية لكل مكان */
        places.forEach(function (p) {
            var w = document.createElement('div');
            w.className = 'sl-wrap';

            /* مؤشر الخطوات */
            w.appendChild(stepsUI(cur, tot));

            /* التايمر */
            if (C.timerEnabled) {
                var tt = document.createElement('div');
                tt.className = 'sl-timer';
                tt.textContent = C.timerText.replace('{seconds}', C.timerDuration);
                w.appendChild(tt);

                var bar = document.createElement('div');
                bar.className = 'sl-bar';
                var prog = document.createElement('div');
                prog.className = 'sl-prog';
                bar.appendChild(prog);
                w.appendChild(bar);
            }

            /* الزر */
            var btn = mkBtn(p.img, !btnReady);
            btn.addEventListener('click', onClick);
            w.appendChild(btn);

            /* إخفاء الزر إذا scrollReveal مفعّل */
            if (C.scrollReveal && C.scrollRequired && !scrollOk) {
                btn.classList.add('sl-hide');
            }

            /* تلميح السكرول */
            if (C.scrollRequired && !scrollOk) {
                var hint = document.createElement('div');
                hint.className = 'sl-hint';
                hint.textContent = '\u2B07 \u0627\u0633\u0643\u0631\u0644 \u0644\u0644\u0623\u0633\u0641\u0644 \u0644\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u2B07';
                w.appendChild(hint);
            }

            /* إدراج */
            if (p.pos === 'header') {
                target.parentNode.insertBefore(w, target);
            } else {
                if (target.nextSibling) target.parentNode.insertBefore(w, target.nextSibling);
                else target.parentNode.appendChild(w);
            }
        });

        /* ── تشغيل التايمر ── */
        if (C.timerEnabled && !timerOk) {
            var rem = C.timerDuration;
            var tTexts = document.querySelectorAll('.sl-timer');
            var pBars  = document.querySelectorAll('.sl-prog');

            var iv = setInterval(function () {
                rem--;
                if (rem <= 0) {
                    rem = 0; clearInterval(iv); timerOk = true;
                    tTexts.forEach(function (t) {
                        t.textContent = '\u2713 \u0627\u0646\u062A\u0647\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 — \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0622\u0646';
                        t.style.color = '#198754';
                    });
                    pBars.forEach(function (p) { p.style.width = '100%'; });
                    if (scrollOk) enableBtns();
                } else {
                    tTexts.forEach(function (t) {
                        t.textContent = C.timerText.replace('{seconds}', rem);
                    });
                    var pct = ((C.timerDuration - rem) / C.timerDuration) * 100;
                    pBars.forEach(function (p) { p.style.width = pct + '%'; });
                }
            }, 1000);
        }

        /* ── كشف السكرول ── */
        if (C.scrollRequired && !scrollOk) {
            var onScroll = function () {
                var st = window.pageYOffset || document.documentElement.scrollTop;
                var sh = document.documentElement.scrollHeight - window.innerHeight;
                if (sh <= 0) { scrollOk = true; if (timerOk) enableBtns(); window.removeEventListener('scroll', onScroll); return; }
                if ((st / sh) * 100 >= C.scrollPercentage) {
                    scrollOk = true;
                    window.removeEventListener('scroll', onScroll);
                    if (C.scrollReveal) {
                        document.querySelectorAll('.sl-btn.sl-hide').forEach(function (b) { b.classList.remove('sl-hide'); });
                    }
                    if (timerOk) enableBtns();
                }
            };
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();
        }
    }

    /* ════════════════════════════════════════════════════════════
     *  التنقل
     * ════════════════════════════════════════════════════════════ */

    function goNext() {
        var cur = parseInt(get(K.page)) || 1;
        var tot = parseInt(get(K.total)) || C.totalPages;
        log('Next — page', cur, '/', tot);

        if (cur >= tot) { toAdlinkfly(); return; }

        set(K.page, cur + 1);
        var qi = parseInt(get(K.qidx)) || 0;
        var q = []; try { q = JSON.parse(get(K.queue) || '[]'); } catch(e) {}
        var ni = qi + 1;
        set(K.qidx, ni);

        if (q[ni]) {
            showGen(function () { window.location.href = q[ni]; });
        } else {
            toAdlinkfly();
        }
    }

    function toAdlinkfly() {
        var alias = get(K.alias);
        if (!alias) { log('No alias'); clearAll(); return; }
        var url = C.adlinkflyUrl + C.adlinkflyPath + alias;
        log('Redirect:', url);
        clearAll();
        window.location.href = url;
    }

    function showGen(cb) {
        var o = document.createElement('div');
        o.className = 'sl-gen';
        var sp = document.createElement('div');
        sp.className = 'sl-spin';
        o.appendChild(sp);
        var t = document.createElement('p');
        t.textContent = '\u062C\u0627\u0631\u064A \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0631\u0627\u0628\u0637...';
        o.appendChild(t);
        document.body.appendChild(o);
        setTimeout(function () { o.remove(); cb(); }, 1500);
    }

    /* ════════════════════════════════════════════════════════════
     *  بدء / استمرار
     * ════════════════════════════════════════════════════════════ */

    function startFlow(alias) {
        log('Start flow — alias:', alias);
        set(K.alias, alias);
        set(K.active, '1');
        set(K.page, '1');
        set(K.total, String(C.totalPages));

        fetchPosts(function (posts) {
            var needed = Math.max(0, C.totalPages - 1);
            var q = posts.slice(0, needed);
            set(K.queue, q);
            set(K.qidx, '0');
            log('Queue:', q.length, 'posts');
            injectCSS();
            buildUI();
        });
    }

    function continueFlow() {
        var cur = parseInt(get(K.page)) || 1;
        var tot = parseInt(get(K.total)) || C.totalPages;
        log('Continue — page', cur, '/', tot);
        if (cur > tot) { toAdlinkfly(); return; }
        injectCSS();
        buildUI();
    }

    /* ════════════════════════════════════════════════════════════
     *  التهيئة
     * ════════════════════════════════════════════════════════════ */

    function init() {
        log('Loaded');
        var alias = qs(C.goParamName);
        if (alias) { startFlow(alias); return; }
        if (get(K.active) === '1') { continueFlow(); return; }
        log('No flow — normal browsing');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
