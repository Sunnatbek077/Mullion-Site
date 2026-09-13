/**
 * Mullion — auto-updating release download
 * ------------------------------------------------------------------
 * Reads the same update.json that the Mullion client itself checks
 * (mullion-runtime repo, published by MullionAdmin's AppReleaseService,
 * see Services/AppReleaseService.swift + GitHubService.swift).
 *
 * It's fetched fresh from GitHub on every page load, so the moment a
 * new build is staged and published from the admin app, this page
 * offers it on the very next visit — nothing on the site itself ever
 * needs to be edited or redeployed for a version bump.
 *
 * Include this after the rest of the page's markup, e.g.:
 *   <script src="js/release.js"></script>
 *
 * Required markup hooks (add these ids/element to index.html — see
 * the accompanying patch notes):
 *   #heroDl        the hero CTA <a class="btn btn-p" aria-disabled="true">
 *   #heroSpecline  the <p class="specline"> under the hero CTA
 *   #dlKicker      the "Download" kicker in the #specs section
 *   #dlHeading     the h2 in #specs ("Nothing to download yet.")
 *   #dlBody        the paragraph under that h2
 *   #dlButtonWrap  an empty <div> where the real download button is inserted
 *   #dlNote        (optional) small print under the button
 */
(function () {
  "use strict";

  // Public repo + file — no token needed to read it, same as the Mullion
  // client itself. raw.githubusercontent.com serves the file straight from
  // the `main` branch with only Fastly's short edge cache in front of it.
  var UPDATE_JSON_URL =
    "https://raw.githubusercontent.com/Sunnatbek077/mullion-runtime/main/update.json";

  function fileNameFromURL(url) {
    try {
      return decodeURIComponent(url.split("/").pop().split("?")[0]);
    } catch (e) {
      return url.split("/").pop();
    }
  }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function applyRelease(release) {
    // No `latest` in update.json (or the fetch failed) — leave every
    // "nothing published yet" default already in the page's HTML alone.
    if (!release || !release.downloadURL || !release.version) return;

    var fileName = fileNameFromURL(release.downloadURL);

    var hero = document.getElementById("heroDl");
    if (hero) {
      hero.href = release.downloadURL;
      hero.removeAttribute("aria-disabled");
      hero.setAttribute("download", fileName);
      hero.textContent = "Download for Mac — v" + release.version;
    }

    var specline = document.getElementById("heroSpecline");
    if (specline && release.minimumSystemVersion) {
      specline.textContent =
        "Apple Silicon · macOS " +
        release.minimumSystemVersion +
        "+ · Rosetta 2 required";
    }

    var kicker = document.getElementById("dlKicker");
    if (kicker) kicker.textContent = "Download — v" + release.version;

    var heading = document.getElementById("dlHeading");
    if (heading) heading.innerHTML = "Mullion " + release.version + "<br>is ready.";

    var body = document.getElementById("dlBody");
    if (body) {
      var bits = [
        "Version " +
          release.version +
          (release.build && release.build !== release.version
            ? " (build " + release.build + ")"
            : "") +
          ".",
      ];
      var when = release.publishedAt ? formatDate(release.publishedAt) : null;
      if (when) bits.push("Published " + when + ".");
      bits.push("Unzip it and drag Mullion.app to Applications.");
      body.textContent = bits.join(" ");
    }

    var wrap = document.getElementById("dlButtonWrap");
    if (wrap) {
      wrap.innerHTML = "";
      var a = document.createElement("a");
      a.className = "btn btn-p";
      a.href = release.downloadURL;
      a.setAttribute("download", fileName);
      a.textContent = "Download " + fileName;
      wrap.appendChild(a);

      if (release.notes) {
        var p = document.createElement("p");
        p.className = "small";
        p.style.marginTop = "16px";
        p.textContent = release.notes;
        wrap.appendChild(p);
      }
    }

    var note = document.getElementById("dlNote");
    if (note) {
      note.textContent =
        "This page checks for the latest release on every visit — it will " +
        "pick up the next version the moment it is published, with nothing " +
        "to change here.";
    }
  }

  function checkForLatestRelease() {
    fetch(UPDATE_JSON_URL, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("update.json " + r.status);
        return r.json();
      })
      .then(function (doc) {
        applyRelease(doc && doc.latest);
      })
      .catch(function () {
        // Network hiccup, rate limit, or nothing published — stay on
        // whatever "not published yet" state is already in the HTML.
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkForLatestRelease);
  } else {
    checkForLatestRelease();
  }
})();