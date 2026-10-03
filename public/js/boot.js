/* Corre no <head>, antes de pintar: decide se há intro e se vem de uma transição de página. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');
  if (reduce) return;
  try {
    if (!sessionStorage.getItem('gfIntro') && document.location.pathname === '/') {
      root.classList.add('has-intro');
    } else if (sessionStorage.getItem('gfNav') === '1') {
      root.classList.add('is-nav');
      sessionStorage.removeItem('gfNav');
    }
  } catch { /* sessionStorage indisponível */ }

  // Rede de segurança: se algum script falhar, o site nunca fica tapado.
  setTimeout(function () {
    if (!window.__gfReady) root.classList.remove('has-intro', 'is-nav', 'js');
  }, 7000);
})();
