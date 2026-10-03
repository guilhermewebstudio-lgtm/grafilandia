/* Interface geral: menu, animações (GSAP), portefólio. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined';
  window.__gfReady = true;

  /* ---------- Interface básica (não depende de GSAP) ---------- */
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('siteNav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  function onScroll() {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Confirmações em formulários do admin (sem JS inline por causa da CSP).
  document.addEventListener('submit', function (e) {
    var msg = e.target && e.target.getAttribute && e.target.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) e.preventDefault();
  });

  // Portefólio: filtro por categoria e lightbox.
  var chips = document.querySelectorAll('[data-filter]');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.getAttribute('data-filter');
      chips.forEach(function (c) { c.classList.toggle('is-on', c === chip); });
      document.querySelectorAll('.pf-item').forEach(function (it) {
        it.classList.toggle('is-hidden', f !== '*' && it.getAttribute('data-cat') !== f);
      });
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });
  });

  var box = document.getElementById('lightbox');
  if (box && typeof box.showModal === 'function') {
    var boxImg = box.querySelector('img');
    var boxTitle = box.querySelector('.lb-title');
    document.querySelectorAll('.pf-open').forEach(function (btn) {
      btn.addEventListener('click', function () {
        boxImg.src = btn.getAttribute('data-src');
        boxImg.alt = btn.getAttribute('data-title') || '';
        boxTitle.textContent = btn.getAttribute('data-title') || '';
        box.showModal();
      });
    });
    box.addEventListener('click', function (e) { if (e.target === box || e.target.closest('.lb-close')) box.close(); });
  }

  /* ---------- Sem GSAP ou movimento reduzido: mostra tudo já ---------- */
  if (!hasGsap || reduce) {
    root.classList.remove('has-intro', 'is-nav', 'js');
    return;
  }
  if (window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);
  var gsap = window.gsap;

  var curtain = document.getElementById('curtain');
  var leaving = false;

  /* ---------- Entrada na página ---------- */
  function startPage() {
    var hero = document.querySelector('.hero');
    if (hero) {
      gsap.fromTo(hero,
        { '--dx1': '-22px', '--dy1': '-12px', '--dx2': '20px', '--dy2': '13px' },
        { '--dx1': '-2px', '--dy1': '-1px', '--dx2': '2px', '--dy2': '1.5px', duration: 1.5, ease: 'power4.out' });
      gsap.from('.hero .lead, .hero .actions, .hero-note', { autoAlpha: 0, y: 18, duration: .7, stagger: .12, delay: .45, clearProps: 'all' });
      gsap.from('.proof-sheet', { yPercent: 6, autoAlpha: 0, duration: .9, delay: .2, ease: 'power3.out', clearProps: 'all' });
      gsap.from('.proof-bar i', { scaleY: 0, transformOrigin: 'bottom', stagger: .06, duration: .4, delay: .8, clearProps: 'all' });

      // Ao mexer o rato, as chapas desalinham um pouco, como numa prova a ser ajustada.
      if (window.matchMedia('(hover: hover)').matches) {
        hero.addEventListener('pointermove', function (e) {
          var r = hero.getBoundingClientRect();
          var x = (e.clientX - r.left) / r.width - 0.5;
          var y = (e.clientY - r.top) / r.height - 0.5;
          gsap.to(hero, { '--dx1': (-2 - x * 12) + 'px', '--dy1': (-1 - y * 8) + 'px', '--dx2': (2 + x * 12) + 'px', '--dy2': (1.5 + y * 8) + 'px', duration: .6, overwrite: 'auto' });
        });
        hero.addEventListener('pointerleave', function () {
          gsap.to(hero, { '--dx1': '-2px', '--dy1': '-1px', '--dx2': '2px', '--dy2': '1.5px', duration: .9, ease: 'power3.out', overwrite: 'auto' });
        });
      }
    }

    var items = document.querySelectorAll('.rv');
    if (!items.length) return;
    if (window.ScrollTrigger) {
      window.ScrollTrigger.batch('.rv', {
        start: 'top 90%',
        once: true,
        onEnter: function (els) {
          gsap.to(els, { opacity: 1, y: 0, duration: .7, stagger: .09, ease: 'power3.out', overwrite: true });
        },
      });
    } else {
      gsap.to(items, { opacity: 1, y: 0, duration: .6, stagger: .06 });
    }
  }

  /* ---------- Intro (1x por sessão, só na página inicial) ---------- */
  function runIntro() {
    try { sessionStorage.setItem('gfIntro', '1'); } catch { /* ignora */ }
    var intro = document.getElementById('intro');
    var sheet = intro.querySelector('.intro-sheet');
    var started = false;
    function go() { if (!started) { started = true; startPage(); } }

    var tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: function () { root.classList.remove('has-intro'); go(); },
    });
    tl.from(sheet, { scale: .84, autoAlpha: 0, duration: .7 })
      .from(intro.querySelectorAll('.cm'), { autoAlpha: 0, scale: .3, duration: .45, stagger: .08 }, '-=.35')
      .from(intro.querySelectorAll('.intro-bar i'), { scaleY: 0, transformOrigin: 'top', duration: .35, stagger: .1 }, '-=.15')
      .addLabel('open', '+=.3')
      .to(sheet, { scale: 1.08, autoAlpha: 0, duration: .45, ease: 'power2.in' }, 'open')
      .to('.intro-top', { yPercent: -100, duration: .85, ease: 'power4.inOut' }, 'open')
      .to('.intro-bottom', { yPercent: 100, duration: .85, ease: 'power4.inOut' }, 'open')
      .add(go, 'open+=.35');

    intro.addEventListener('click', function () { tl.timeScale(4); });
  }

  /* ---------- Transição entre páginas ---------- */
  function revealPage() {
    gsap.to(curtain, {
      yPercent: -100, duration: .75, ease: 'power4.inOut', delay: .05,
      onStart: startPage,
      onComplete: function () { root.classList.remove('is-nav'); gsap.set(curtain, { clearProps: 'all' }); },
    });
  }

  function leave(href) {
    if (leaving) return;
    leaving = true;
    try { sessionStorage.setItem('gfNav', '1'); } catch { /* ignora */ }
    gsap.fromTo(curtain, { yPercent: 100 }, {
      yPercent: 0, duration: .55, ease: 'power3.inOut',
      onComplete: function () { window.location.href = href; },
    });
  }
  window.gfLeave = leave;

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download') || a.hasAttribute('data-no-transition')) return;
    var url;
    try { url = new URL(a.href, window.location.href); } catch { return; }
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return;
    if (/^\/(media|admin\/ficheiro|conta\/ficheiro)/.test(url.pathname)) return;
    e.preventDefault();
    leave(url.href);
  });

  // Voltar atrás com cache do browser: garante que a cortina não fica a tapar.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      leaving = false;
      root.classList.remove('is-nav');
      gsap.set(curtain, { clearProps: 'all' });
    }
  });

  /* ---------- Arranque ---------- */
  if (root.classList.contains('has-intro')) runIntro();
  else if (root.classList.contains('is-nav')) revealPage();
  else startPage();
})();
