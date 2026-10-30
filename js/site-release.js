/* Download button, What’s new link and Recent builds — read from update.json */
(function(){
  // ── Auto-updating release download ────────────────────────────────
  // Reads update.json from the mullion-runtime repo — the same file the
  // Mullion client itself checks against, written by MullionAdmin's App
  // Release screen when a build is published. Nothing on the site needs
  // touching for a version bump.
  //
  // Read through the contents API, not raw.githubusercontent.com: raw is
  // served from a CDN that holds the file for five minutes (max-age=300, and a
  // cache-busting query string still hits the cached copy), so for five
  // minutes after a publish the admin app and this page disagreed. The API
  // answers from the repository itself. It allows 60 unauthenticated requests
  // an hour per visitor, so raw stays as the fallback.
  var UPDATE_API_URL = 'https://api.github.com/repos/Sunnatbek077/mullion-runtime/contents/update.json?ref=main';
  var UPDATE_RAW_URL = 'https://raw.githubusercontent.com/Sunnatbek077/mullion-runtime/main/update.json';

  function getJSON(url, headers){
    return fetch(url, {cache: 'no-store', headers: headers || {}})
      .then(function(r){ if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  }

  function fetchUpdateDoc(){
    return getJSON(UPDATE_API_URL, {Accept: 'application/vnd.github.raw+json'})
      .catch(function(){ return getJSON(UPDATE_RAW_URL); });
  }

  // Numeric, dot by dot — "0.10" is newer than "0.9". Same rule as the
  // admin app's VersionOrder, so both sides agree on what "older" means.
  function compareVersions(a, b){
    var x = String(a).split('.'), y = String(b).split('.');
    for (var i = 0; i < Math.max(x.length, y.length); i++){
      var d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0);
      if (d) return d;
    }
    return 0;
  }

  // "27.0" → "27"; "26.5" stays "26.5"
  function macOSLabel(v){
    return String(v).replace(/(\.0)+$/, '');
  }

  function fileNameFromURL(url){
    try { return decodeURIComponent(url.split('/').pop().split('?')[0]); }
    catch(e){ return url.split('/').pop(); }
  }

  function formatDate(iso){
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {year:'numeric', month:'long', day:'numeric'});
  }

  function applyRelease(release){
    // No `latest` in update.json (or the fetch failed) — leave every
    // "nothing published yet" default already in the page's HTML alone.
    if (!release || !release.downloadURL || !release.version) return;

    var fileName = fileNameFromURL(release.downloadURL);

    var hero = document.getElementById('heroDl');
    if (hero){
      hero.href = release.downloadURL;
      hero.removeAttribute('aria-disabled');
      hero.setAttribute('download', fileName);
      hero.textContent = 'Download beta for Mac — v' + release.version;
    }

    var chip = document.getElementById('heroChip');
    if (chip) chip.textContent = 'v' + release.version + ' · public beta';

    // the bundle's LSMinimumSystemVersion, as the admin app read it — the
    // hero line and the requirements table both follow it
    if (release.minimumSystemVersion){
      var os = macOSLabel(release.minimumSystemVersion);
      var specline = document.getElementById('heroSpecline');
      if (specline) specline.textContent = 'Apple Silicon · macOS ' + os + '+ · Rosetta 2 required';
      var req = document.getElementById('reqMacOS');
      if (req) req.textContent = 'macOS ' + os;
    }

    var kicker = document.getElementById('dlKicker');
    if (kicker) kicker.textContent = 'Download — v' + release.version;

    var heading = document.getElementById('dlHeading');
    if (heading){
      // built from nodes, not innerHTML: the version string comes off the network
      heading.textContent = 'Mullion ' + release.version;
      heading.appendChild(document.createElement('br'));
      heading.appendChild(document.createTextNode('is ready.'));
    }

    var body = document.getElementById('dlBody');
    if (body){
      var bits = ['Version ' + release.version + (release.build && release.build !== release.version ? ' (build ' + release.build + ')' : '') + '.'];
      var when = release.publishedAt ? formatDate(release.publishedAt) : null;
      if (when) bits.push('Published ' + when + '.');
      bits.push('Unzip it and drag Mullion.app to Applications.');
      body.textContent = bits.join(' ');
    }

    var wrap = document.getElementById('dlButtonWrap');
    if (wrap){
      wrap.innerHTML = '';
      var a = document.createElement('a');
      a.className = 'btn btn-p';
      a.href = release.downloadURL;
      a.setAttribute('download', fileName);
      a.textContent = 'Download ' + fileName;
      wrap.appendChild(a);
      // the notes live on their own page, together with the version history
      var wn = document.createElement('a');
      wn.href = 'whats-new.html';
      wn.target = '_blank';
      wn.rel = 'noopener';
      wn.className = 'btn btn-s';
      wn.style.marginTop = '14px';
      wn.textContent = 'What’s new in ' + release.version + ' ›';
      wrap.appendChild(wn);
    }

    var note = document.getElementById('dlNote');
    if (note){
      note.textContent = 'This page reads the release straight from the source on every visit — a version published from the admin app shows up here within a minute, with nothing to change on the site.';
    }
  }

  // ── Recent builds ─────────────────────────────────────────────────
  // Every build MullionAdmin uploads is a zip on the one `app` release in
  // mullion-releases, so the asset list is the version history — but it is
  // not the list of *published* builds. The admin app uploads when a build is
  // staged, before anyone presses Publish, and a withdrawn build's file stays
  // up. So the list is cut to what update.json says: nothing newer than the
  // live release, "Latest" on exactly that file, and no list at all while
  // nothing is offered. Hidden if the API refuses.
  //
  // Older builds are cut too. The admin app's "Older builds blocked" setting
  // makes the live version the required one: every older Mac is told "Update
  // Required", so the page must not hand out a zip the app will then refuse.
  // Only builds at the live version are listed, and a list of one is not shown
  // — the Download button above already is that build.
  var RELEASES_URL = 'https://api.github.com/repos/Sunnatbek077/mullion-releases/releases/tags/app';

  function formatSize(bytes){
    return (bytes / 1e6).toFixed(1) + ' MB';
  }

  function showBuilds(rel, live){
    var builds = document.getElementById('builds');
    var tbody = document.getElementById('buildRows');
    if (!builds || !tbody || !live || !live.version) return;
    var liveFile = live.downloadURL ? fileNameFromURL(live.downloadURL) : null;
    var rows = (rel.assets || []).map(function(a){
      // the admin app names it Mullion-<version>.zip, or Mullion-<version>-<build>.zip
      // when the build number says something the version doesn't
      var m = /^Mullion-(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.]+))?\.zip$/.exec(a.name);
      return m && {version: m[1], build: m[2] || null, name: a.name,
                   url: a.browser_download_url, size: a.size, at: a.updated_at || a.created_at};
    }).filter(function(b){
      // same version, and not a rebuild staged after the live one
      return b && compareVersions(b.version, live.version) === 0 &&
             (!live.build || !b.build || compareVersions(b.build, live.build) <= 0);
    }).sort(function(x, y){
      return compareVersions(y.version, x.version) || compareVersions(y.build || 0, x.build || 0);
    }).slice(0, 5);
    if (rows.length < 2) return;

    rows.forEach(function(b){
      var tr = document.createElement('tr');
      var v = document.createElement('td');
      // two zips of one version (a rebuild) are told apart by build
      var twin = rows.filter(function(o){ return o.version === b.version; }).length > 1;
      v.textContent = b.version + (twin && b.build ? ' · build ' + b.build : '');
      if (b.name === liveFile){
        var tag = document.createElement('span');
        tag.className = 'latest';
        tag.textContent = 'Latest';
        v.appendChild(tag);
      }
      var d = document.createElement('td');
      d.textContent = formatDate(b.at) || '';
      var s = document.createElement('td');
      s.textContent = formatSize(b.size);
      var l = document.createElement('td');
      var a = document.createElement('a');
      a.href = b.url;
      a.textContent = 'Download';
      a.setAttribute('aria-label', 'Download Mullion ' + b.version);
      l.appendChild(a);
      tr.appendChild(v); tr.appendChild(d); tr.appendChild(s); tr.appendChild(l);
      tbody.appendChild(tr);
    });
    builds.hidden = false;
  }

  // update.json first: the page is useful the moment it lands, and the build
  // list can't be drawn without knowing which build is live
  var updateDoc = fetchUpdateDoc();
  updateDoc
    .then(function(doc){ applyRelease(doc && doc.latest); })
    .catch(function(){ /* stay in the "nothing published yet" state */ });
  Promise.all([updateDoc, getJSON(RELEASES_URL, {Accept: 'application/vnd.github+json'})])
    .then(function(r){ showBuilds(r[1], r[0] && r[0].latest); })
    .catch(function(){ /* no history shown */ });

})();
