/* Hero Dock: hides over the Games section and over the Download button */
(function(){
  // ── Dock hides once the "No Mac version. Playing anyway." (#games)
  // section reaches the viewport, and returns once you scroll back above it.
  // It also steps aside while it would sit on the hero's download button: on
  // a window under ~830px tall the button lands exactly where the Dock rests.
  var dockEl = document.querySelector('.dock');
  var gamesSection = document.getElementById('games');
  var heroCta = document.querySelector('.hero .cta');
  var heroSpec = document.getElementById('heroSpecline');
  if (dockEl && gamesSection){
    var ticking = false;
    function updateDock(){
      var rect = gamesSection.getBoundingClientRect();
      var pastThreshold = rect.top <= window.innerHeight * 0.3;
      var overCta = false;
      if (heroCta){
        // where the Dock sits when shown — measured from layout, not from its
        // rect, since .hide translates it off screen
        var dockTop = window.innerHeight - 14 - dockEl.offsetHeight - 4;
        var ctaTop = heroCta.getBoundingClientRect().top;
        var ctaBottom = (heroSpec || heroCta).getBoundingClientRect().bottom;
        overCta = ctaBottom > dockTop && ctaTop < window.innerHeight;
      }
      dockEl.classList.toggle('hide', pastThreshold || overCta);
      ticking = false;
    }
    function onScroll(){
      if (!ticking){ ticking = true; requestAnimationFrame(updateDock); }
    }
    window.addEventListener('scroll', onScroll, {passive:true});
    window.addEventListener('resize', onScroll);
    // the hero reflows after load — web fonts swap in, the release check
    // rewrites the button — and the button moves with it
    if (window.ResizeObserver) new ResizeObserver(onScroll).observe(document.querySelector('.hero'));
    updateDock();
  }
})();
