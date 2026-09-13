# Mullion — site

Landing page for Mullion. `index.html` holds all the CSS and SVG inline; alongside it
are `img/` (four gameplay stills), `js/` (a vendored three.js) and `models/` (the
MacBook). Google Fonts is still the only external host. **Serve the folder — don't open
the file directly:** ES-module imports need an origin, so `file://` silently falls back
to the static screenshot.

## Run it

No build step and nothing to install — three.js is vendored in `js/`. Serve the folder
and open the page:

```bash
python3 -m http.server 8000
```

```bash
open http://localhost:8000
```

Or in one line, from the repo root:

```bash
python3 -m http.server 8000 & sleep 1 && open http://localhost:8000
```

Stop it with:

```bash
pkill -f "http.server 8000"
```

Any static server does — `npx serve`, `php -S localhost:8000`, whatever is already on the
machine. The only requirement is an HTTP origin.

**What you should see.** The page works everywhere, but the MacBook sequence needs three
things: a window at least 900px wide, motion enabled (it is skipped under
`prefers-reduced-motion`), and WebGL. Miss any of them and `#games` shows the static
Red Dead screenshot instead — that is the designed fallback, not a failure. Scroll slowly
through `#games` to scrub the laptop open; it is driven by scroll position, so it will sit
still if you do.

## The 3D MacBook

`#games` opens on a real MacBook Pro 16" glTF model rendered with WebGL, **scrubbed by
the scrollbar rather than played**: it starts shut and far away, comes in, opens on its
own hinge, comes closer, and where the display fills the frame it hands over to the flat
screenshot — the same panel treatment the three games below it get. Nothing tracks the
cursor. `.scrub` is the scroll distance the sequence gets (210vh); the sticky `.pin`
inside it is what you actually see.

**The module carries a version stamp — `js/macbook.js?v=3` — and it is not decoration.**
`python3 -m http.server` sends no cache headers, so an edited module keeps being served
from the browser's cache: you fix the file, reload, and are still looking at the previous
build. Two rounds of "it is still broken" here were exactly that. Bump the number when you
change the module, or hard-reload.

**Check `window.__mbErr` before believing a screenshot of this section.** `draw()` runs
inside a promise chain, so anything it throws is swallowed into that variable: the page
does not go red, it silently keeps the static fallback and the track keeps the 210vh it
had already claimed. That looks exactly like "the 3D was never enabled". Worse, a harness
that scrolls the iframe *before* the module boots lands past the end of the track — the
track is `flat` (auto height) until then — so every capture comes back showing the final
handoff frame and looks fine. Read the error first, then look.

**The caption is inside the pin, and it is faded in by the sequence.** Left in normal
flow after the track it only appeared once the pin released — the picture scrolled away
first, so there was a screen and a half of empty black between the still and the words
describing it. It is now the pin's second flex child, hidden until the last 9% of the
scroll. Two consequences worth knowing: the stage has to leave room for it, so its width
is `min(100%, (100vh - 200px) * 1.549)` and it gives way on a short window rather than
pushing the caption off screen; and because the fade is driven by `draw()`, the CSS has to
show the caption when the 3D never runs — that is what `.scrub.flat .stagecap{opacity:1}`
is for. Delete that rule and the fallback loses its caption silently.

**The stage is the column's full width and the display's own shape**, not a narrower box
of its own. It used to be `min(1010px, 92vw)` against a 1120px column, so the still it
hands over to came out ~10% narrower than the three game screens directly below it — the
sequence ended on a smaller picture than the ones it was supposed to match. `aspect-ratio`
is the panel's `16/10.35` rather than `16/10`, so the 3D display fills the canvas exactly
and the still that replaces it starts at the same size. Both end up 1120 × 630, the same
box as `.bigscreen`. Measure with `offsetWidth`, not `getBoundingClientRect` — the reveal
transform on `.big` makes the rect read ~9px wide and 16px short while it settles, which
looks like a real mismatch and is not.

**The handoff is a match cut, not a dissolve.** Fading a 16:10.35 display through a 16:9
still while the camera is still pushing in gives you two mismatched rectangles ghosting
over each other — it reads as a double exposure. Three things fix it and all three are
needed: the camera's last keyframe lands at `HAND_FROM`, so it is parked before the fade
starts and the panel stops moving underneath; the still is sized in `draw()` to the
panel's own measured proportions rather than a CSS ratio, so the two rectangles coincide;
and only in the last 4.5% does it ease from the display's shape to the 16:9 the three
screens below use. `screenAspect` is measured off the panel in its own plane — the mesh is
tilted, so its height is the diagonal of its bounding box's y and z extents, not either
one.

**The hinge is centred at load, not placed by hand.** Putting the pivot on the base's
back edge is close but not the real axis — the actual hinge sits ~0.9 cm forward of it.
Rotating about the edge lands the shut lid off-centre: it overhangs at the back and is
inset at the front, which on screen reads as a step on one corner and a recess on the
opposite one. The code rotates the lid to `SHUT` once at load, measures how far it passes
the base at each end, and slides the hinge forward by half the difference so both ends
match. It is four lines and it means a different `.glb` centres itself.

**The shut angle is measured, not derived — 108°, and it is in `SHUT` with the reason.**
The obvious way to get it is trigonometry on the lid's bounding box: the lid leans 22°
back, so it should shut at 90 + 22 = 112°. That is 4° too far. At 112° the lid rotates
*through* the base and vanishes underneath, leaving the keyboard facing the camera, and
on the way down its near corner sinks into the body and reads as a skewed screen. The box
is why: it includes the hinge barrel and the rounded corners, so the lean it implies is
steeper than the display panel's actual lean. Auto-measuring by sweeping the hinge and
keeping the flattest bounding box does not rescue it either — that lands on 90° and
leaves the lid ajar. Sweeping 85–125° and looking at the renders is what settled it.
**Swap the model and this has to be re-measured.**

**`.track` was already taken.** The DirectX→Metal path diagram uses it. Naming the new
scroll container `.track` too made the two rules overwrite each other silently: the
diagram grew to 210vh, and the pin became a centred flex item that sat below the fold, so
the first quarter of the sequence rendered to an empty screen. It cost hours to find
because every individual thing measured correct — camera, model bounds, canvas size,
lid angle — and a wireframe marker dropped into the scene did not draw either, which
pointed at the renderer instead of at layout. Grep the stylesheet before adding a class.

The model's own textures are shown **unlit**: no environment probe, no lights, no shadow
pass, no tone mapping. `flatten()` replaces every material with a `MeshBasicMaterial`
carrying the map the model already ships, and picks out the display panel on the way
through — it is the only material with an emissive map, which is how the model lit its
own wallpaper. The trade is visible and intended: the aluminium has no base-colour
texture, so the body renders as one flat grey. Adding lights back means adding all of it
back, since a `MeshBasicMaterial` ignores every light in the scene.

Two more things worth keeping. `preserveDrawingBuffer: true` and `transform:translateZ(0)`
on the canvas — a WebGL canvas inside `position:sticky` can otherwise composite blank.
And the lid is found by shape (`findLid`: an open laptop is one squat group and one tall
one under the same parent), not by node name, so swapping `models/macbook.glb` for
another model does not mean rewriting the module.

three.js plus the model is ~11 MB. None of it is fetched until the section is close, and
viewports under 900px and `prefers-reduced-motion` skip it entirely and keep the still.

The tiles are **built as app icons, not cropped posters**. A square crop of
`library_600x900` is a portrait banner with its edges cut off — it reads as a poster in a
Dock, because that is what it is. Each tile here is instead composited the way a real Mac
icon is: the game's transparent wordmark (`logo.png`) alpha-trimmed to its own bounding
box and centred over its `library_hero.jpg`, blurred and darkened into a background. 180px
WebP data URIs, ~39 KB for ten — data URIs, not hotlinks, so the page still makes one
external request.

Three traps if you regenerate them. `library_600x900.jpg` without `_2x` serves a 300×450
image. **`sips --cropOffset` silently disables `-c`** in the macOS 27 build, so crops come
out as squashed full posters and nothing warns you — check `sips -g pixelWidth`. And
`logo.png` is a 640×360 canvas that is mostly transparent, so it has to be alpha-trimmed
or the mark lands tiny and off-centre. All of this is done with a canvas in headless
Chrome (`--allow-file-access-from-files`); the source is `scratchpad/art/icons.html` in
the session that built them, reproducible from the note above.

Six of the ten are titles nobody has run through Mullion. They are illustration, and the
`#games` section below is where the page makes claims — keep it that way. The art belongs
to its publishers; it is used here the way every launcher in this category uses it, which
is a decision the repo owner has made rather than a licence anyone granted.

`#games` sits directly after the hero, and is `dark` rather than `deep` for that reason:
`deep` is `#0B0B0D` against the hero's `#000` and the seam was visible. Want first,
mechanism second — `#build` is the page's first light section and lands as the contrast.

The `#games` section is the page's one emotional beat: four cinematic covers, big
copy, no spec table. The four titles are the ones Mullion has actually been run with,
on the development Mac (MacBook Pro, M1 Pro, 2021) — the receipts under the grid are
quoted from `BugExperience.md` and the `engine-graphics` skill in the app repo. Don't
add a title here that hasn't been played, and don't name a machine that hasn't been
tested; the section sells hardest when every word of it survives a check.

The covers are drawn, not photographed — a layered CSS gradient plus an inline SVG
scene per game — so the file stays self-contained and borrows nobody's artwork. They
are composed 16:10 and `slice`-cropped, so on phones the card stacks (full cover, copy
underneath) rather than growing taller and cropping the sides off the art.

`#no-ai` states an absence as a feature, which only works while it stays true. If Mullion
ever gains anything model-backed, that section comes out in the same release as the code —
not the one after. Its outbound-request sentence is worded to match the Privacy footnote at
the bottom of the page verbatim; change one and change both.

Prototype — the download button is deliberately disabled and the `#` links have no
destination yet. Nothing on the page claims anything that hasn't been checked; see
the comparison table's two rows that go against us.

Kept outside the app repo on purpose: the website is not part of the product.
