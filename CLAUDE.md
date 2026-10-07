# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A collection of SvelteKit starter page templates for ONS (Office for National Statistics) data visualisation, built on the [`@onsvisual/svelte-components`](https://github.com/ONSvisual/svelte-components/) library ([Storybook docs](https://onsvisual.github.io/svelte-components/)). Each route in `src/routes/` is a self-contained template (`article`, `feature`, `embed`, `map`). The root `+page.svelte` is an index linking to them. The intended workflow is that users copy one template's `+page.svelte` over `src/routes/+page.svelte` and delete the rest.

## Pensions calculator decisions

Keep this section current as the pensions calculator takes shape. For each meaningful change, record what changed and why; distinguish intended choices from work already implemented.

- **2026-10-07 - UI and chart dependencies:** Added `flowbite-svelte` and `echarts` to `devDependencies` and ran `npm install`. They are available for the planned calculator UI and charts. Kept `@onsvisual/svelte-components` and `@onsvisual/svelte-charts` in place because existing templates still use them; no components or charts have been migrated yet.
- **2026-10-07 - Deployment:** Removed the GitHub Pages workflow because commits were triggering failed deployment runs during calculator development. Local `npm run build` and `npm run build:preview` remain available; deployment is manual until explicitly configured again.
- **2026-10-07 - Calculator page shells:** Made `/` the pensions input page and added `/withdrawals/` for drawdown assumptions. Added Tailwind 4 and its Vite plugin to style Flowbite Svelte components. The shared layout supplies navigation and an in-memory draft so entries survive page changes without persisting financial data. Pension sources can be added or removed and marked as pots or projected annual income; withdrawals collect ages, an income target and a fixed-amount or percentage approach. No pension projections, tax logic, charts, or saved data are implemented yet; avoid presenting an estimate until the calculation model is agreed.
- **2026-10-07 - Restorable draft foundation:** `src/lib/pension-draft.js` owns the defaults and version 1 JSON contract: `{ formatVersion, pensions: [{ id, kind, name, amount }], withdrawals: { retirementAge, finalAge, annualIncome, strategy, withdrawalRate } }`. Blank numeric inputs serialize as `null`, not zero; hidden strategy fields remain in the document. Runtime `nextId` is derived from restored source IDs. Validate the full document before applying it to the existing reactive draft, and reject unsupported versions or unknown fields to avoid silently losing data. When adding an input, update the document mapping, validation, restoration and round-trip tests together. This prepares explicit file export/import controls for a later change; no automatic browser storage, file controls, calculation results or charts have been added.

## Commands

```bash
npm install
npm run dev            # dev server at localhost:5173, base path ''
npm run build          # production static build -> /build (relative URLs by default), then scripts/js-fix.js
npm run build:preview  # preview/GitHub Pages build (base_preview, SPA fallback 404.html)
npm run preview        # serve the built app
npm run lint           # prettier --check .
npm run format         # prettier --write .
```

There is no test suite, so check UI changes by running the dev server and using the page in a browser.

## Tooling

- **Node**: you need Node 20.19 or later for Vite 7 and `@sveltejs/vite-plugin-svelte` 6. CI uses Node 22.
- **Formatting**: `.prettierrc` matches [ONSdigital/svelte-components](https://github.com/ONSdigital/svelte-components/): tabs, no trailing commas, a print width of 100, and `prettier-plugin-svelte`.
  - `.vscode/settings.json` turns on format-on-save.
  - `.prettierignore` skips lockfiles and `static/`, which holds large data files such as `master-topo.json`. Prettier also skips everything in `.gitignore`.
  - Run `npm run lint` before committing.
- **`npm audit`**: it reports 3 low-severity `cookie` advisories that come from SvelteKit 2. This is accepted. Don't add an npm `overrides` entry for it; it goes away with SvelteKit 3.

## Architecture and build behaviour

- **Static only**: `@sveltejs/adapter-static` outputs to `build/`. There is no server-side code.
- **Base path switching** (`svelte.config.js`): the base path comes from `src/app.config.js`.
  - Dev: `''`
  - `NODE_ENV=production`: `base_prod`. It defaults to `null`, which means no base path.
  - `PUBLIC_APP_ENV=preview`: `base_preview` (`/sveltekit-starter`, the datavisweb preview server or GitHub Pages)
  - With no base path, `paths.relative` is `true`, so the build works at any path or sub-path. This only works for prerendered pages. Each page works out its base from its own URL in the browser.
  - With a base path, `paths.relative` is `false`, and the app works only at that path.
  - Keep `base_preview` set to a path. The preview build isn't prerendered and relies on a `404.html` fallback, which SvelteKit always gives absolute URLs.

  Never hard-code root-absolute URLs, and do not use the deprecated `base`/`assets` exports. Wrap route links in `resolve()` from `$app/paths` (e.g. `resolve("/article/")`) and static-file URLs (anything in `static/`, including `fetch` calls) in `asset()` (e.g. `asset("/data/mapstyle.json")`).

- **Prerendering** (`src/routes/+layout.js`): prerendering is on unless `PUBLIC_APP_ENV=preview`, in which case the preview build is an SPA with a `404.html` fallback. `trailingSlash = 'always'`.
- **`scripts/js-fix.js`** runs after `npm run build` only. It prepends `//js\n` to every JS file in `build/_app/` to avoid MIME-type errors on the ONS hosting. `build:preview` skips it.
- **`vite.config.js`** drops `console` and `debugger` in builds, so `console.log` output only appears in dev.
- **Global styles**: `src/routes/+layout.svelte` imports the svelte-components CSS, the maplibre-gl CSS and `src/app.css`. Tailwind 4 compiles Flowbite styles from `src/app.css` via the Vite plugin; calculator-specific selectors are prefixed with `pension-` to avoid styling the starter templates.
- **`src/lib/config.js`** holds the analytics config (GTM ID and `analyticsProps` placeholders to fill in per product), the colour themes, and demo data (regions, palettes, units).
- **Svelte 5** is installed, but the templates mix syntax. `feature` and `map` use runes (`$state`, `$props`). Match the style of the file you are editing. Components from `@onsvisual/svelte-components` and `@onsvisual/svelte-maps` still dispatch legacy events, so use `on:change`/`on:click` on them, or `bind:` their props.
- **`Section` vs `Container`** (svelte-components): `Section` renders its own `Container`, which has `marginBottom` set to `true` and `width` set to `"narrow"` (8 of 12 columns at large widths). Don't nest a `Container` inside a `Section`. Use one or the other, and set the margins and width on whichever you use.

## Map + search template (`src/routes/map/`)

This route is self-contained: its components, config and helpers all live in the folder, and `src/routes/map/README.md` explains how they fit together. In summary:

- It draws an ELS-style choropleth of `static/data/median-age.csv`, using LTLA boundaries from `static/master-topo.json` and the basemap in `static/data/mapstyle.json`.
- Only boundaries with a CSV row are drawn and searchable. The TopoJSON also contains superseded districts that overlap current ones, so don't drop this filter.
- Map data is kept in `$state.raw`, because it is passed to MapLibre's web worker.
- In `ChoroplethMap.svelte`, the `Map` import from svelte-maps shadows the global `Map`, so don't use `new Map()` in that file.
- **One `selected` area code is shared** by `AreaSearch`, the map fill layer and `MapLegend`, all through `bind:selected`. Clicking the map, clicking the legend or searching all select an area.
- **`AreaSearch.svelte` wraps `AccessibleSelect`**:
  - It uses `clearable={true}` and `autoClear={false}`. Search mode turns `autoClear` on by default, which hides the clear button. The clear button clears the selection, so there is no separate clear control.
  - It only asks postcodes.io for postcodes when no area names match the query.
  - It ignores results for any query that is no longer the latest one, so a slow lookup can't overwrite newer results.
  - Don't call `blur()` on the input after selecting. `accessible-autocomplete` keeps its own internal query, and blurring makes it write the typed text back over the area name.
- **Colours and units** are set in `config.js`: `colors.hovered` is `#f56927`, `colors.selected` is black, and the sequential palette is the ELS one. Legend ticks use `suffix`, while area labels also get `labelSuffix`, which is the indicator's `unit`.

## Deployment

No GitHub Actions deployment workflow is configured. Builds can still be produced locally using `npm run build` or `npm run build:preview`.
