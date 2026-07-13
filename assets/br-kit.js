/* ================================================================
   br-kit.js ｜ web-design-master 表現技法キット v0.2（依存ゼロ・vanilla）
   2026-07-10 [うぇぶこ] ｜ 発注: handoff/KICKOFF_technique_catalog_20260710.md
   v0.2: chars（文字分割）/ tilt（ポインタ微チルト）/ ondark（章ダーク反転検知）追加
   - 共用IntersectionObserver 1インスタンス（threshold 0 / rootMargin下-8%）
   - 対象: data-br="reveal|unmask|ink-fill|stagger|counter|chars"
   - modifier: data-br-delay="0.2s"（発火遅延）/ data-br-step（stagger間隔）
               data-br-to・data-br-duration（counter）
   - prefers-reduced-motion: 即座に最終状態（アニメなし）
   - デバッグ: URLに ?br-fire を付けると全技を即発火（スクショ検証用）
   ================================================================ */
(function () {
  'use strict';
  document.documentElement.classList.add('br-js'); /* no-JS安全弁の鍵 */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var forceAll = /[?&]br-fire/.test(location.search);

  var targets = document.querySelectorAll(
    '[data-br="reveal"],[data-br="unmask"],[data-br="ink-fill"],[data-br="stagger"],[data-br="counter"],[data-br="chars"]'
  );

  /* ---- br-chars: テキストを1字ずつspan化（空白はテキストノードのまま） ---- */
  function splitChars(el) {
    var step = parseFloat(el.getAttribute('data-br-step') || '0.035');
    var text = el.textContent;
    el.textContent = '';
    var i = 0;
    Array.from(text).forEach(function (ch) {
      if (/\s/.test(ch)) { el.appendChild(document.createTextNode(ch)); return; }
      var s = document.createElement('span');
      s.className = 'br-char';
      s.textContent = ch;
      s.style.transitionDelay = (i * step) + 's';
      el.appendChild(s);
      i++;
    });
  }

  /* ---- 発火（is-in付与＋counterは数値駆動） ---- */
  function fire(el) {
    el.classList.add('is-in');
    if (el.getAttribute('data-br') === 'counter') count(el);
  }

  /* ---- br-counter: data-br-to必須・data-br-duration(ms)任意 ---- */
  function count(el) {
    var to = parseFloat(el.getAttribute('data-br-to') || '0');
    var dur = parseFloat(el.getAttribute('data-br-duration') || '1200');
    if (reduced || forceAll || !window.requestAnimationFrame) {
      el.textContent = to.toLocaleString();
      return;
    }
    var t0 = null;
    function tick(t) {
      if (t0 === null) t0 = t;
      var p = Math.min((t - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3); /* easeOutCubic */
      el.textContent = Math.round(to * eased).toLocaleString();
      if (p < 1) window.requestAnimationFrame(tick);
    }
    window.requestAnimationFrame(tick);
  }

  /* ---- 共用IO（1インスタンス・一度だけ発火） ---- */
  var io = null;
  if ('IntersectionObserver' in window && !reduced && !forceAll) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        fire(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
    /* threshold:0が正解。0.05等にするとclip-pathで全面クリップ中の要素（br-unmask）は
       intersectionRatioが常に0のため永遠に発火しない（Chromium実測 2026-07-10） */
  }

  Array.prototype.forEach.call(targets, function (el) {
    if (el.getAttribute('data-br-delay')) {
      el.style.transitionDelay = el.getAttribute('data-br-delay');
    }
    if (el.getAttribute('data-br') === 'stagger') {
      var step = parseFloat(el.getAttribute('data-br-step') || '0.09');
      Array.prototype.forEach.call(el.children, function (child, i) {
        child.style.transitionDelay = (i * step) + 's';
      });
    }
    if (el.getAttribute('data-br') === 'chars' && !reduced) { splitChars(el); }
    if (io) { io.observe(el); } else { fire(el); }
  });

  /* ---- br-tilt: ポインタ追従の微チルト（pointer:fineのみ・rAF指数追従） ---- */
  if (window.matchMedia('(pointer: fine)').matches && !reduced) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-br="tilt"]'), function (el) {
      var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
      function loop() {
        cx += (tx - cx) * .12;
        cy += (ty - cy) * .12;
        el.style.transform = 'perspective(700px) rotateX(' + cy.toFixed(2) + 'deg) rotateY(' + cx.toFixed(2) + 'deg)';
        if (Math.abs(tx - cx) > .02 || Math.abs(ty - cy) > .02) { raf = window.requestAnimationFrame(loop); }
        else { raf = null; }
      }
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - .5) * 7;   /* rotY ±3.5° */
        ty = -((e.clientY - r.top) / r.height - .5) * 6;  /* rotX ±3°  */
        if (!raf) raf = window.requestAnimationFrame(loop);
      });
      el.addEventListener('pointerleave', function () {
        tx = 0; ty = 0;
        if (!raf) raf = window.requestAnimationFrame(loop);
      });
    });
  }

  /* ---- br-ondark: data-br-dark章が画面中央帯にある間 body.br-on-dark を立てる
         （色の反転そのものはページ側のCSS変数設計＝kitは検知と上げ下げのみ。
          reduced-motionでも動作＝これは動きでなく配色の契約） ---- */
  var darks = document.querySelectorAll('[data-br-dark]');
  if (darks.length && 'IntersectionObserver' in window) {
    var dio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.__brDarkIn = e.isIntersecting; });
      var on = Array.prototype.some.call(darks, function (d) { return d.__brDarkIn; });
      document.body.classList.toggle('br-on-dark', on);
    }, { threshold: 0, rootMargin: '-40% 0px -40% 0px' });
    Array.prototype.forEach.call(darks, function (d) { dio.observe(d); });
  }
})();
