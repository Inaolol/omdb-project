# Reel Index

A small movie search app built on the [OMDb API](https://www.omdbapi.com/). Type a title, browse a grid of posters, click one to see the full plot, ratings, and credits.

**Live demo:** https://inaolol.github.io/omdb-project/

## Run locally

No build step. Clone the repo and serve the directory with anything that speaks HTTP:

```bash
git clone https://github.com/Inaolol/omdb-project.git
cd omdb-project
python3 -m http.server 8000   # or: npx serve .
```

Open http://localhost:8000.

The OMDb key is committed in `config.js` so the deployed site works out of the box. To use your own, replace the value or copy `config.example.js` to `config.js`.

## Tests

```bash
npm test
```

Unit tests for the API layer and pure helpers live in `app.test.js` and run with Node's built-in test runner — no dependencies.

## Features

- Live search with debounced fetches (380 ms) — no submit button needed
- Filter by type (movie / series / episode) and year
- Recent searches saved between visits (localStorage)
- Detail overlay with plot, ratings (IMDb, Rotten Tomatoes, Metacritic), full credits
- Empty, loading (skeleton grid), no-results, and error states
- Keyboard shortcuts: `/` or `⌘K` to focus search, `Esc` to close detail, `Enter` to open a card
- Last search restored from the URL on reload (shareable links)
- Responsive — single column on mobile, fluid grid on desktop

## Screenshots

- [Home / empty state](docs/examples/home.png)
- [Search results grid](docs/examples/results.png)
- [Detail overlay](docs/examples/detail.png)
- [Mobile layout](docs/examples/mobile.png)

## Requirements coverage

### Functional

| # | Requirement | Where |
|---|---|---|
| 1 | Movie search input with filters | Header search + type/year filters (`index.html`, `app.js` `runSearch`) |
| 2 | Display title, year, genre, director, poster | Card grid + detail overlay (`cardHtml`, `detailBodyHtml`) |
| 3 | Error handling for not-found and API errors | `errorStateHtml`, `noResultsHtml`, `try/catch` around every fetch |
| 4 | Multiple searches without refresh; state retained on reload | SPA — last query restored from `?q=` URL param and recent searches from localStorage |
| 5 | Backend proxy (optional) | Not implemented — direct OMDb calls from the browser |

### Non-functional (bonus)

- **Performance**
  - 380 ms input debounce avoids a request per keystroke (`scheduleSearch`)
  - In-flight request token (`searchToken`) discards stale responses, preventing flicker if a slow query resolves after a newer one
  - Lazy-loaded poster images (`loading="lazy"`) and CSS-only skeleton loaders
  - Single `innerHTML` write per render — no per-item DOM thrash
- **Usability**
  - Live search, recent-query chips, keyboard shortcuts, visible focus states
  - Distinct empty / loading / no-results / error states with retry & clear actions
  - All user-facing strings escape HTML to prevent injection from API responses
- **Portability**
  - Vanilla HTML/CSS/JS — no framework, no build, no transpile. Runs in any modern browser
  - Responsive grid (`auto-fill` / `minmax`) and mobile-first CSS
  - No browser-specific APIs beyond `fetch`, `URLSearchParams`, `localStorage`
- **Maintainability**
  - Pure functions (URL builders, view-model creators) are isolated from DOM and `fetch`, so they're unit-testable
  - `fetchImpl` and `documentObject` are injected into core functions — tests run without a browser or network
  - Code organised in clear sections inside `app.js`: config → URL builders → API → renderers → app wiring
  - `npm test` runs against the same module the browser loads — no duplication

## Tech decisions

- **No framework, no build step.** The brief asks for HTML/CSS/JS; adding React or a bundler would only add complexity for a single-screen app. Source is what the browser runs.
- **Single `app.js` with internal sections.** Splitting into ES modules would require a build or a server with correct MIME types — both work against "drop into GitHub Pages and go." The file is sectioned and exports a testable surface.
- **Key in repo.** OMDb free-tier keys are rate-limited per-key (1000 req/day) and trivially rotated. A serverless proxy would defeat "static GitHub Pages deploy." If abused, the key gets rotated; nothing else is at risk.
- **State as plain variables in a closure.** No state-management library for ~6 fields. The closure inside `initApp` is the state container.
