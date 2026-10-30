/* Section backdrops (on-screen only), cursor spotlight, Stores download-chunks canvas */
(function(){
  // ── Section backdrops ─────────────────────────────────────────────
  // motion in a backdrop only runs while its section is on screen
  var onIO = new IntersectionObserver(function(es){
    es.forEach(function(e){ e.target.classList.toggle('on', e.isIntersecting); });
  });
  document.querySelectorAll('#metal').forEach(function(s){ onIO.observe(s); });

  // cursor spotlight on the dark scenes — mouse and trackpad only
  if (matchMedia('(hover: hover) and (pointer: fine)').matches){
    document.querySelectorAll('.hero, .scene.dark, .scene.deep').forEach(function(sec){
      var spot = document.createElement('div');
      spot.className = 'spot';
      spot.setAttribute('aria-hidden', 'true');
      sec.insertBefore(spot, sec.firstChild);
      var px = 0, py = 0, pending = false;
      function place(){
        pending = false;
        var x = px - 240, y = py - 240;
        spot.style.transform = 'translate(' + x + 'px,' + y + 'px)';
        // the section's grid has a line at width/2 − 32 + n·64 across and n·64 down
        spot.style.backgroundPosition = (sec.clientWidth / 2 - 32 - x) + 'px ' + (-y) + 'px';
      }
      sec.addEventListener('pointermove', function(e){
        var r = sec.getBoundingClientRect();
        px = e.clientX - r.left; py = e.clientY - r.top;
        if (!pending){ pending = true; requestAnimationFrame(place); }
        spot.classList.add('on');
      });
      sec.addEventListener('pointerleave', function(){ spot.classList.remove('on'); });
    });
  }

  // Stores: a download drawn as its chunks. Scrolling through the section is the
  // download: chunks land out of order, the bottom rows first, and a lighter band
  // runs just ahead — what the downloader has claimed but the disk does not have
  // yet. The section's own copy is about exactly that gap.
  var chunks = document.getElementById('chunks');
  if (chunks && chunks.getContext){
    var storesSec = document.getElementById('stores');
    var cctx = chunks.getContext('2d');
    var cells = [], cw = 0, ch = 0, cInView = false, cQueued = false;
    var CELL = 9, GAP = 5;
    function layoutChunks(){
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      cw = chunks.clientWidth; ch = chunks.clientHeight;
      chunks.width = Math.round(cw * dpr); chunks.height = Math.round(ch * dpr);
      cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var step = CELL + GAP, cols = Math.ceil(cw / step), rows = Math.ceil(ch / step);
      var x0 = (cw - (cols * step - GAP)) / 2, seed = 11;
      function rnd(){ seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      cells = [];
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++)
        cells.push({x: x0 + c * step, y: ch - (r + 1) * step + GAP, t: .55 * rnd() + .45 * (r / rows)});
    }
    function drawChunks(){
      cQueued = false;
      // 0 as the strip enters at the bottom of the window, 1 by the time it is 55% up
      var rect = chunks.getBoundingClientRect(), vh = window.innerHeight;
      var p = Math.max(0, Math.min(1, (vh - rect.top) / (vh * .45 + rect.height)));
      cctx.clearRect(0, 0, cw, ch);
      for (var i = 0; i < cells.length; i++){
        var k = cells[i];
        cctx.fillStyle = k.t < p ? 'rgba(46,110,166,.42)'
                       : k.t < p + .09 ? 'rgba(46,110,166,.16)'
                       : 'rgba(17,17,19,.06)';
        cctx.fillRect(k.x, k.y, CELL, CELL);
      }
    }
    function queueChunks(){ if (cInView && !cQueued){ cQueued = true; requestAnimationFrame(drawChunks); } }
    new IntersectionObserver(function(es){ cInView = es[0].isIntersecting; queueChunks(); }).observe(storesSec);
    window.addEventListener('scroll', queueChunks, {passive: true});
    window.addEventListener('resize', function(){ layoutChunks(); queueChunks(); });
    layoutChunks();
  }

})();
