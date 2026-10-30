/* The “Building — your game” card that steps through on scroll */
(function(){
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // build sequence
  var bld = document.getElementById('bld');
  var steps = bld.querySelectorAll('.st');
  var fill = bld.querySelector('.bar i');
  // the folder/bundle trees behind the card light up as each step is reached
  var lights = document.querySelectorAll('#build .bbg [data-at]');
  function light(n){
    lights.forEach(function(el){ el.classList.toggle('lit', n >= +el.getAttribute('data-at')); });
  }
  function finish(){
    steps.forEach(function(s){ s.classList.remove('run'); s.classList.add('done'); });
    fill.style.width = '100%'; bld.classList.add('fin');
    light(steps.length);
  }
  if (reduce) { finish(); }
  else {
    var started = false;
    new IntersectionObserver(function(es, obs){
      if(!es[0].isIntersecting || started) return;
      started = true; obs.disconnect();
      var i = 0;
      (function next(){
        // the last step used to keep spinning: it was never marked done
        if(i >= steps.length){ finish(); return; }
        if(i > 0) { steps[i-1].classList.remove('run'); steps[i-1].classList.add('done'); }
        steps[i].classList.add('run');
        light(i);
        fill.style.width = Math.round((i/steps.length)*100) + '%';
        i++;
        setTimeout(next, 620);
      })();
    }, {threshold:.4}).observe(bld);
  }

})();
