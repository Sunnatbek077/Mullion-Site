/* Page setup: JS flag, phone menu, scroll-reveal */
(function(){
  document.documentElement.classList.add('js');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // phone menu — the desktop link list, dropped down under the bar
  var navEl = document.querySelector('nav');
  var menuBtn = navEl.querySelector('.mt');
  function setMenu(open){
    navEl.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
  }
  menuBtn.addEventListener('click', function(){ setMenu(!navEl.classList.contains('open')); });
  navEl.querySelectorAll('.nv ul a').forEach(function(a){
    a.addEventListener('click', function(){ setMenu(false); });
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && navEl.classList.contains('open')){ setMenu(false); menuBtn.focus(); }
  });
  document.addEventListener('click', function(e){
    if (navEl.classList.contains('open') && !navEl.contains(e.target)) setMenu(false);
  });
  matchMedia('(min-width: 821px)').addEventListener('change', function(m){ if (m.matches) setMenu(false); });

  // scroll reveals
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  }, {rootMargin:'0px 0px -12% 0px', threshold:.12});
  document.querySelectorAll('.rv').forEach(function(el,i){
    el.style.transitionDelay = Math.min(i%6,5)*60 + 'ms';
    io.observe(el);
  });

})();
