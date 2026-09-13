// The MacBook Pro 16" in the games section is a real glTF model rendered with WebGL,
// scrubbed by the scrollbar rather than played: it starts shut and far away, comes in,
// opens on its own hinge, comes closer still, and at the point where the display fills
// the frame it hands over to the flat screenshot — the same treatment the three games
// below it get. Nothing tracks the cursor.
//
// models/macbook.glb is a Sketchfab asset in centimetres, Y-up, exported with its lid
// already open. Nothing here is keyed to that file's node names — the lid is found by
// shape (findLid) and the display panel by being the only material with an emissive map
// (flatten) — so swapping the model does not mean rewriting this.
//
// There is deliberately no lighting rig: no environment probe, no lights, no shadow
// pass, no tone mapping. Every material becomes an unlit MeshBasicMaterial carrying the
// texture the model already ships.
//
// three.js plus the model is ~11 MB. That is a fair trade for a hero on a desktop and a
// bad one on a phone, so narrow viewports and reduced motion keep the still and download
// nothing at all.

const track  = document.getElementById('mbtrack');
const stage  = document.getElementById('mbstage');
const hand   = document.getElementById('mbhand');
const cap    = document.getElementById('mbcap');

const WANTS_3D = track && stage
  && innerWidth >= 900
  && !matchMedia('(prefers-reduced-motion: reduce)').matches;

if (WANTS_3D) {
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    boot().catch((e) => { window.__mbErr = String(e && e.stack || e); console.error('[mb]', e); });
  };
  const io = new IntersectionObserver((es) => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    start();
  }, { rootMargin: '900px 0px' });
  io.observe(track);
  // An IntersectionObserver on a hidden document does not deliver anything, so a page
  // opened straight onto this section in a background tab would sit on the still until
  // it was looked at. The rect says the same thing without waiting to be told.
  const r = track.getBoundingClientRect();
  if (r.top < innerHeight + 900 && r.bottom > -900) { io.disconnect(); start(); }
}

// How far the lid swings to be shut. The trigonometry is right — the lid leans 22° back,
// so it shuts at 90 + 22 = 112° — but it only lands if the hinge is on the real axis. The
// lid's own bounding box is not it: its bottom sits ~1 cm low because it contains the
// hinge barrel, and ~0.5 cm forward because of the rounded corners. Pivoting there made
// the shut lid miss the body by a visible margin (overhanging corner, a seam out of
// parallel) and chasing it with the angle instead only traded one artefact for another —
// 108° about the wrong axis looked closed at a glance and still had a step at the front
// edge. The hinge comes off the base now, and 112° seats flush.
const SHUT      = Math.PI * 112 / 180;
const LID_FROM  = 0.18, LID_TO = 0.58;  // where in the scroll the lid swings
const HAND_FROM = 0.80, HAND_TO = 1.00; // where the 3D gives way to the still

async function boot() {
  const [THREE, { GLTFLoader }] = await Promise.all([
    import('./three.module.min.js'),
    import('./GLTFLoader.js')
  ]);

  const canvas = document.getElementById('mbcanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 16 / 10, 1, 900);

  const gltf  = await new GLTFLoader().loadAsync('models/macbook.glb');
  const model = gltf.scene;
  const parts = findParts(THREE, model);
  const lid   = parts.lid;
  const box   = new THREE.Box3().setFromObject(model);
  const { mesh: screenMesh, tex: screenTex } = flatten(THREE, model);

  model.position.x -= (box.min.x + box.max.x) / 2;
  model.position.z -= (box.min.z + box.max.z) / 2;
  model.position.y -= box.min.y;
  scene.add(model);

  let pivot = null, lean = 0;
  if (lid && parts.base) {
    // Box3.setFromObject reports world space, but a child of `model` is positioned in
    // model space — and `model` has just been moved. Convert, or the hinge lands short
    // of the real one and the lid swings away from the body instead of shutting onto it.
    model.updateMatrixWorld(true);
    const lb = new THREE.Box3().setFromObject(lid);
    lean = Math.atan2(lb.max.z - lb.min.z, lb.max.y - lb.min.y);   // how far it leans back
    // The hinge is the top-back edge of the BASE, not a corner of the lid's bounding box.
    // The lid's box bottom sits ~1 cm low (it contains the hinge barrel) and ~0.5 cm
    // forward (rounded corners), and rotating 108° about a point that far off lands the
    // shut lid visibly offset from the body — overhanging corner, seam out of parallel.
    const bb = new THREE.Box3().setFromObject(parts.base);
    pivot = new THREE.Group();
    pivot.position.copy(model.worldToLocal(new THREE.Vector3(0, bb.max.y, bb.min.z)));
    model.add(pivot);
    pivot.attach(lid);

    // The base's back edge is close to the hinge but not on it — the real axis sits a
    // little forward of it. Rotating about the edge lands the shut lid off-centre: it
    // overhangs at the back and is inset at the front, which reads as a step on one
    // corner and a recess on the opposite one. Measure that mismatch at the shut angle
    // and slide the hinge forward by half of it, so both ends overhang the same.
    pivot.rotation.x = SHUT;
    pivot.updateMatrixWorld(true);
    const shutBox = new THREE.Box3().setFromObject(lid);
    const backOver  = bb.min.z - shutBox.min.z;   // how far the lid passes the back edge
    const frontOver = shutBox.max.z - bb.max.z;   // and the front one
    pivot.position.z += (backOver - frontOver) / 2;
    pivot.rotation.x = 0;
    pivot.updateMatrixWorld(true);
  }

  // Where the camera has to end up for the display to fill the frame exactly: on the
  // panel's own normal, far enough back that its width spans the horizontal field.
  track.classList.remove('flat');   // the track only earns its scroll height now
  resize();                         // the end pose needs the real aspect, so size first

  const end = { pos: new THREE.Vector3(0, 12, 46), tgt: new THREE.Vector3(0, 12, 0) };
  let screenAspect = 16 / 10.35;
  if (screenMesh) {
    const sb = new THREE.Box3().setFromObject(screenMesh);
    const c  = sb.getCenter(new THREE.Vector3());
    const halfW = (sb.max.x - sb.min.x) / 2;
    const vfov  = camera.fov * Math.PI / 180;
    const hfov  = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const dist  = halfW / Math.tan(hfov / 2);   // the panel spans the frame exactly
    const n = new THREE.Vector3(0, Math.sin(lean), Math.cos(lean));
    end.tgt.copy(c);
    end.pos.copy(c).addScaledVector(n, dist);
    // the panel measured in its own plane, not its axis-aligned box: it is tilted, so
    // its height is the diagonal of the box's y and z extents
    screenAspect = (sb.max.x - sb.min.x) /
                   Math.hypot(sb.max.y - sb.min.y, sb.max.z - sb.min.z);
  }
  screenTex.userData.panelAspect = screenAspect;
  fitCover(screenTex);

  // A shut MacBook is 1.7 cm tall: aim at the desk, not at where the screen will be,
  // or it sits under the bottom edge for the whole first third.
  const K = [
    { at: 0.00, pos: orbit(THREE, 124, 23, -18), tgt: new THREE.Vector3(0, 1, 0) },
    { at: 0.30, pos: orbit(THREE, 108, 20, -12), tgt: new THREE.Vector3(0, 3, 0) },
    { at: 0.62, pos: orbit(THREE, 93, 15, -5),   tgt: new THREE.Vector3(0, 9, -3) },
    { at: HAND_FROM, pos: end.pos,               tgt: end.tgt }
  ];



  const pos = new THREE.Vector3(), tgt = new THREE.Vector3();

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize, { passive: true });

  const col = track.parentElement;
  const colWidth = () => col ? col.clientWidth : stage.clientWidth;

  function progress() {
    const r = track.getBoundingClientRect();
    const span = track.offsetHeight - innerHeight;
    return span <= 0 ? 0 : clamp(-r.top / span, 0, 1);
  }

  // The pose for a given progress, drawn once. Keeping this separate from the rAF loop
  // is what makes it testable: a headless run can ask for an exact p and get that frame,
  // instead of hoping a frame callback fires.
  function draw(p) {
    if (pivot) pivot.rotation.x = SHUT * (1 - smoothstep(LID_FROM, LID_TO, p));
    sample(THREE, K, p, pos, tgt);
    camera.position.copy(pos);
    camera.lookAt(tgt);
    // Two rectangles of different shapes fading through each other reads as a double
    // exposure, not a transition. The still is sized to sit exactly where the 3D panel
    // is — the camera is parked by now, so the panel is not moving under it — and only
    // once the fade is over does it ease into the 16:9 the three screens below use.
    const over = smoothstep(HAND_FROM, HAND_TO, p);
    canvas.style.opacity = String(1 - over);
    if (hand) {
      hand.style.opacity = String(over);
      // The still starts exactly where the 3D panel is — same width, same shape — and
      // only after the fade eases to the column width and the 16:9 the three screens
      // below use. On a full-height window the two widths are already equal and the
      // morph is shape-only; on a short one the stage shrank, and this is where it
      // catches back up.
      const morph = smoothstep(HAND_TO - 0.06, HAND_TO, p);
      const w = stage.clientWidth + (colWidth() - stage.clientWidth) * morph;
      const a = screenAspect + (16 / 9 - screenAspect) * morph;
      const f = hand.firstElementChild;
      f.style.width = w + 'px';
      f.style.height = (w / a) + 'px';
    }
    if (cap) cap.style.opacity = String(smoothstep(HAND_TO - 0.09, HAND_TO, p));
    if (over < 1) renderer.render(scene, camera);
  }

  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const r = track.getBoundingClientRect();
    if (r.bottom < -200 || r.top > innerHeight + 200) return;   // off screen: skip the draw
    draw(progress());
  }
  draw(progress());                 // one frame now, so nothing flashes empty
  raf = requestAnimationFrame(frame);

  window.__mb = { draw, tex: screenTex, get p() { return progress(); } };
  stage.classList.add('ready');
}

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
function orbit(THREE, dist, elevDeg, yawDeg) {
  const e = elevDeg * Math.PI / 180, y = yawDeg * Math.PI / 180;
  return new THREE.Vector3(
    Math.sin(y) * Math.cos(e) * dist,
    Math.sin(e) * dist,
    Math.cos(y) * Math.cos(e) * dist
  );
}
function sample(THREE, keys, p, outPos, outTgt) {
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1].at) i++;
  const a = keys[i], b = keys[i + 1];
  const t = smoothstep(a.at, b.at, p);
  outPos.copy(a.pos).lerp(b.pos, t);
  outTgt.copy(a.tgt).lerp(b.tgt, t);
}

// An open laptop is one squat group and one tall one hanging off the same parent. That
// holds whatever the exporter called them, and it gives us the base as well as the lid —
// the base is what the hinge line is measured from.
function findParts(THREE, root) {
  let found = { lid: null, base: null };
  root.traverse((o) => {
    if (found.lid || o.children.length < 2 || o.children.length > 6) return;
    const kids = [], hs = [], vol = [];
    for (const c of o.children) {
      const b = new THREE.Box3().setFromObject(c);
      if (b.isEmpty()) continue;
      kids.push(c);
      hs.push(b.max.y - b.min.y);
      vol.push((b.max.x - b.min.x) * (b.max.z - b.min.z));
    }
    if (kids.length < 2) return;
    const tall = hs.indexOf(Math.max(...hs));
    const rest = hs.filter((_, i) => i !== tall);
    if (hs[tall] <= 4 * Math.max(...rest)) return;
    // the base is the widest footprint that is not the lid
    let bi = -1;
    for (let i = 0; i < kids.length; i++) {
      if (i === tall) continue;
      if (bi < 0 || vol[i] > vol[bi]) bi = i;
    }
    found = { lid: kids[tall], base: bi >= 0 ? kids[bi] : null };
  });
  return found;
}

// Every material becomes unlit and keeps the map the model already ships. The display
// panel is found on the way through — it is the only one with an emissive map, which is
// how the model lit its own wallpaper — and gets the game instead.
function flatten(THREE, model) {
  // The image lands at one point and the panel is measured at another; whichever is
  // second runs the fit (see fitCover).
  const tex = new THREE.TextureLoader().load('img/rdr2.webp', () => fitCover(tex));
  tex.colorSpace = THREE.SRGBColorSpace;
  // the panel's V axis runs opposite to the glTF default; neither flipY value lands it
  // the right way up, so it is flipped in UV space
  tex.flipY = false;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, -1);
  tex.offset.set(0, 1);
  tex.anisotropy = 8;

  let screenMesh = null;
  const swapped = new Map();
  model.traverse((o) => {
    if (!o.isMesh) return;
    const one = (m) => {
      const isScreen = !!m.emissiveMap;
      if (isScreen) screenMesh = o;
      if (swapped.has(m)) return swapped.get(m);
      const flat = new THREE.MeshBasicMaterial({
        map: isScreen ? tex : (m.map || null),
        color: isScreen ? 0xffffff : m.color,
        transparent: m.transparent,
        opacity: m.opacity,
        alphaTest: m.alphaTest,
        side: m.side,
        toneMapped: false
      });
      swapped.set(m, flat);
      return flat;
    };
    o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
  });
  return { mesh: screenMesh, tex };
}

// The panel is 16:10.35 and the still is 16:9, so mapping the image straight onto the
// UVs stretches it — ~15% of horizontal squash, which nothing gives away on a landscape
// but which a standing figure shows immediately. Crop to the panel's shape instead,
// which is also what `object-fit:cover` does to the same file in `.mbhand img`: the two
// rectangles then hold identical framing, and the handoff at HAND_TO is a real match cut
// rather than a stretched picture dissolving into a cropped one. Needs both proportions,
// so it is called from the texture's onLoad and again once the panel is measured, and
// returns until it has them.
function fitCover(tex) {
  const img = tex.image;
  const panel = tex.userData.panelAspect;
  if (!img || !panel) return;
  const image = (img.naturalWidth || img.width) / (img.naturalHeight || img.height);
  const rx = image > panel ? panel / image : 1;
  const ry = image > panel ? 1 : image / panel;
  // the V axis is mirrored here (repeat.y is negative), so its span is centred as
  // offset.y = (1 + ry) / 2 rather than the usual (1 - ry) / 2
  tex.repeat.set(rx, -ry);
  tex.offset.set((1 - rx) / 2, (1 + ry) / 2);
  tex.needsUpdate = true;
}
