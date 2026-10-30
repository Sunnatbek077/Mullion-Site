/* The “your download is starting” dialog */
(function(){
  var modal = document.getElementById('dlm');
  if (!modal) return;
  var countEl = document.getElementById('dlmCount');
  var linkEl = document.getElementById('dlmLink');
  var nowBtn = document.getElementById('dlmNow');
  var WAIT = 5;
  var timer = null, left = WAIT, url = '', name = '', lastFocus = null, started = false;

  // every real download control on the page: the hero button, the one in the
  // Download section, and the links in the recent-builds table. A disabled button
  // ("No build published yet") is skipped, so it still does nothing.
  function matchTrigger(el){
    var a = el && el.closest ? el.closest('a[download], #buildRows a') : null;
    if (!a || a.getAttribute('aria-disabled') === 'true') return null;
    var href = a.getAttribute('href') || '';
    return /^https?:/i.test(href) ? a : null;
  }

  function setCount(){
    countEl.textContent = '';
    if (started){ countEl.textContent = 'Download started — check your Downloads folder.'; return; }
    countEl.appendChild(document.createTextNode('Your download will start in '));
    var b = document.createElement('b');
    b.textContent = left + (left === 1 ? ' second' : ' seconds');
    countEl.appendChild(b);
    countEl.appendChild(document.createTextNode('…'));
  }

  function startDownload(){
    if (started || !url) return;
    started = true;
    clearInterval(timer); timer = null;
    var a = document.createElement('a');
    a.href = url;
    if (name) a.setAttribute('download', name);
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setCount();
  }

  function openModal(trigger){
    url = trigger.href;
    name = trigger.getAttribute('download') || '';
    started = false; left = WAIT;
    lastFocus = document.activeElement;
    linkEl.href = url;
    linkEl.textContent = url;
    setCount();
    modal.classList.remove('run');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('dlm-lock');
    // restart the bar's 5s transition from empty
    void modal.offsetWidth;
    modal.classList.add('run');
    clearInterval(timer);
    timer = setInterval(function(){
      left--;
      if (left <= 0){ startDownload(); } else { setCount(); }
    }, 1000);
    nowBtn.focus();
  }

  function closeModal(){
    clearInterval(timer); timer = null;
    modal.classList.remove('open', 'run');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('dlm-lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('click', function(e){
    var t = matchTrigger(e.target);
    if (t && !modal.classList.contains('open')){
      // let ctrl/cmd/middle-click behave normally
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      openModal(t);
      return;
    }
    if (e.target.closest && e.target.closest('[data-dlm-close]')) closeModal();
    else if (e.target === modal) closeModal();
  });

  nowBtn.addEventListener('click', startDownload);

  document.addEventListener('keydown', function(e){
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape'){ closeModal(); return; }
    if (e.key !== 'Tab') return;
    // keep focus inside the dialog
    var f = modal.querySelectorAll('button, a[href]');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
})();
