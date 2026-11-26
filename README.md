# MT-Link Interactive Demo — Frontend v2

React 18 + TypeScript + Vite 5 + Tailwind CSS 3 + ECharts. It can talk to
`backend_v2` through `/api`, or run the complete demo locally in the browser with ONNX.

The visual language is intentionally the same as v1 — same palette, same card style,
same `shadow-soft`, same typography — so the two demos can be compared side by side. What
changed is the content: this version is all English, the long problem statement / method
narrative / paper introduction are gone, and the interactive matching surface is the
centre of the application.


---

## 0. Browser-only static build (current GitHub Pages mode)

The public site no longer needs FastAPI, SSH tunnels or a GPU. The full interactive
pipeline runs in the browser:

- 20 ONNX models (4 platform pairs × 5 seeds) in `public/browser-models/`;
- all user trajectories in compact sharded binaries in `public/browser-data/`;
- ONNX Runtime Web in a Web Worker;
- mask ratio, attention, evidence removal and Why drawer are computed from the ONNX
  outputs locally.

Build it with:

```bash
VITE_BROWSER_MODE=true npm run build
npm run preview -- --port 4174
```

`scripts/copy-ort.mjs` runs automatically before `dev`/`build` and copies the ONNX
Runtime Web WASM/worker files into `public/ort/` (generated, git-ignored).

The output is roughly 295 MB including models/data; every user and every seed is
supported. The legacy FastAPI mode remains available when `VITE_BROWSER_MODE` is not set.

---

## 1. Run it

```bash
cd "/Users/xiaokang/时空数据挖掘/2025AAAI-Mt-Link-main/frontend_v2"
npm install          # first time only
npm run dev          # http://localhost:5183
```

The dev server proxies `/api` to `http://127.0.0.1:8000` (see `vite.config.ts`), so start
the backend first:

```bash
cd ../
./backend_v2/run.sh
```

Other scripts: `npm run build` (type-check + production bundle), `npm run preview`,
`npm run typecheck`.

> v2 uses port **5183** so it can run at the same time as the v1 frontend on 5173. The
> backend allows both origins.

---

## 2. Pages

| route | page | content |
| --- | --- | --- |
| `/` | Overview | one hero, two module cards, one table of the four live models. No research narrative. |
| `/match` | Live Matching | the core interactive module |
| `/results` | Results | the four reproduced result groups, read from the training output files |

### Live Matching

* **Platform A / B selectors.** Platform A is the model's *dense* side and B its *sparse*
  side, because that is what the model's `forward` signature means. Only pairs with a
  trained checkpoint are offered, so picking the same platform twice is impossible by
  construction.
* **Checkpoint seed selector** (shown when a pair has more than one seed). Every pair ships
  five seeds; the default one is loaded at start-up and any other is loaded on its first
  request. Because each run derived its location vocabulary from its own split, switching the
  seed changes the vocabulary shown in the card (e.g. ISP-Weibo seed 454 → 0–3 298, seed 812 →
  0–3 295) and therefore which users are listed as selectable. The pickers, the quick picks and
  the match request all use the selected seed.
* **Two searchable user pickers** backed by `/api/pairs/{id}/users`. A user whose id also
  exists on the other platform gets an emerald `id match` chip — that is the pattern the
  released datasets use for a ground-truth match, and it is shown as context only.
* **Quick picks** load a shared-id pair, a different-id pair or a random pair, computed
  against the selected seed's vocabulary.
* **Start matching** issues `POST /api/match` for exactly the two selected users.
* Five tabs: `Trajectories`, `Attention`, `Masking`, `Result` and the live
  `Model pipeline` rail in the left column.

### What is deliberately not there

v1 had a `Problem`, a `Model` and a long `Experiment` page, with hard-coded mask ratios,
placeholder `User / Sample` labels and a fake timed progress animation. None of that is
reproduced here:

* the pipeline rail is driven by the `pipeline` array of the real response, so a completed
  step means that module's output tensor was captured;
* the mask ratio shown is `mask_count / trajectory_length` from the real mask array, next
  to the configured ratio for comparison;
* the score, the threshold, the model, the checkpoint seed and path, the location vocabulary
  and every timing come from the response, including the one-off `model_load` time when a
  seed had to be brought into memory;
* when the backend marks something unavailable, the UI shows the backend's reason rather
  than a placeholder.

---

## 3. How the result is presented

Three things are kept visually separate, because conflating them would be misleading:

1. **Model output** — the raw score, the verdict at the 0.5 threshold, and an explicit note
   that the value is a sigmoid output and not a calibrated probability.
2. **Dataset-level correspondence** — whether both users share the same numeric id, in a
   panel labelled *not used by the model*.
3. **Evidence that nothing was looked up** — the index sizes, the number of selectable
   user pairs, and whether this pair happens to occur in a stored sample list (with the
   stored label never used).

### Trajectory map and co-occurrence

Both platforms share **one persistent Leaflet map** above the evidence tabs, on a real OpenStreetMap
basemap with a verified scale bar and coordinate readouts. The map stays mounted while you switch
between Trajectories / Attention / Masking / Result, so the spatial context never disappears.

* **One map, two view modes.** `Co-occurrence` (default) fits the shared spatio-temporal cluster;
  `Both` fits the union of every A+B point and re-enables both trajectory layers, which is the view
  to use for world-spanning Twitter/Facebook pairs. The `Fit` button reapplies the current mode
  after free pan/zoom.
* **Layers.** A trajectory (blue), B trajectory (red), dashed green co-occurrence connectors and
  C1..Cn points, plus an optional `All check-ins` layer. The map uses white route casing and a muted
  basemap so the evidence stays readable even when 300 check-ins are plotted.
* **Linked selection.** Hovering a table row highlights the matching C point; clicking a row (or a
  C point) pins the pair, flies to it and opens a popup with the time slot, distance and both step /
  location ids. Clicking a check-in reveals its step, loc id and coordinates.
* **Real coordinates only.** Tiles are WGS-84; no GCJ-02 offset provider is used. Esri street tiles
  are capped at their real z13 coverage (`maxNativeZoom`), so the old grey “Map data not yet
  available” card can never be requested; OSM mirrors are tried first and an explicit “basemap
  unavailable” note is shown if every provider fails.
* **First screen is never empty.** As soon as a pair's quick picks arrive, the page opens a real
  ground-truth example automatically; `Clear selection` opts out for that pair/seed. Quick picks sit
  above the model pipeline in the left rail.

A pair is a co-occurrence when a platform-A check-in and a platform-B check-in fall in the same time
bucket (the same hour slot for ISP/Weibo, within one hour for the XSiteTraj platforms) and within
2 km of each other, which is the paper's definition of a spatio-temporal co-occurrence point.

### Explainability and mask controls

* **Why this match?** A right-side drawer (map header, C-point popup, or the `Why?` button on a
  co-occurrence row) shows the score/verdict, a normalized shape comparison, the selected
  co-occurrence's geometry, the whole-pair evidence summary, top attention links and the
  checkpoint/mask/timing provenance. Attention token loc ids come from a full
  `tokens.a/b` mapping returned by `/api/match`, not from the display preview.
* **Dual-lane timeline.** Play/pause, 1x/2x and click-to-seek under the map. Playback
  progressively draws each side; a C point appears only after both sides reach its time.
* **Mask ratio.** After a baseline match, the slider re-runs a real forward pass with
  `mask_ratio` set on the checkpoint's `AttentionGuidedMaskStrategy`; the score delta, mask counts
  and gray masked check-ins update. The backend restores the checkpoint ratio in a `finally` block
  and serialises override passes, so the default model is never left modified.
* **Attention to map.** Clicking a heatmap cell locates both raw trajectory tokens on the map,
  even when those tokens are outside the 300-point display preview.
* **Evidence removal + scope.** Select one or more co-occurrence points; the intervention removes
  their check-ins plus the nearby redundant check-ins (±3 h and 2 km), then re-runs the real model:
  baseline, after-removal score and Δ. `Seeds` repeats the same intervention for every available
  checkpoint.

### Tensor-shaped details

The Attention tab renders the correlation-attention matrices actually returned, labelled
with the real platform names and real token counts. Matrices above the backend's cell
budget are block-mean reduced and the UI says so. The Masking tab shows the real tokens
and the real 0/1 mask; the preview is truncated to 200 tokens and that is stated.

---

## 4. Layout

```
frontend_v2/src/
├── main.tsx, App.tsx          entry + routes
├── index.css                  v1's custom CSS (unchanged tokens) + a thin scrollbar
├── api/client.ts              axios client; unwraps FastAPI's {"detail": ...}
├── types/index.ts             every backend response shape
├── lib/format.ts              formatting only; no metric is computed here
├── components/
│   ├── Navbar.tsx             Overview / Live Matching / Results
│   ├── UserPicker.tsx         debounced search, pagination, id-match highlighting
│   ├── UserSummaryCard.tsx    one selected user
│   ├── TrajectoryMap.tsx      deterministic preview of a sequence (not a geo map)
│   ├── AttentionHeatmap.tsx   ECharts heatmap + direction toggle
│   ├── MaskSequence.tsx       original vs masked tokens with measured ratios
│   ├── PipelineStages.tsx     the six modules, driven by the real response
│   └── MatchResultPanel.tsx   score, timings, model info, evidence
└── pages/OverviewPage.tsx, MatchPage.tsx, ResultsPage.tsx
```

---

## 5. Results page rules

* Values are the mean ± **population** standard deviation of the five seed values found in
  each result file, plus a relative-standard-deviation row.
* A metric that is absent shows `--`; the Accuracy column is empty for three of the four
  pairs because those runs never wrote an accuracy.
* The paper's published numbers appear in their own columns and their own bar series,
  converted to percent for display, with a separate caveat block listing every reason the
  two are not directly comparable.
* The loaded checkpoint is compared with the reported run's configuration; when they
  differ the pair carries a "checkpoint differs" badge and a field-by-field table.
* Every block lists the source file it was read from, with a green/red dot per file.
* Reason strings that exist only in Chinese in the original result file are quoted
  verbatim and attributed, rather than silently translated or dropped.

### Offline cache

`public/sw.js` is registered in production builds only. It caches the app shell, hashed Vite
assets, API GET responses, `POST /api/match` responses keyed by their exact JSON body, and map
tiles that have already been viewed. A pair that was run once online can therefore be re-opened
when the backend is unreachable; a cache miss returns an explicit 503 JSON error instead of a
fabricated result. The dev server does not register the worker, so HMR is unaffected.
