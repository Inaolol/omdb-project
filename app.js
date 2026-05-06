(function (root) {
  "use strict";

  const OMDB_ENDPOINT = "https://www.omdbapi.com/";
  const RECENT_KEY = "rx.recent";
  const MAX_RECENT = 6;

  function normalizeQuery(value) {
    return String(value || "").trim();
  }

  function getApiKey(source) {
    const configSource = source || root;
    const key = configSource && configSource.OMDB_CONFIG && configSource.OMDB_CONFIG.apiKey;
    return normalizeQuery(key);
  }

  function ensureApiKey(apiKey) {
    const key = normalizeQuery(apiKey);

    if (!key) {
      const error = new Error("Create config.js from config.example.js and add your OMDB API key.");
      error.code = "CONFIG";
      throw error;
    }

    if (/^https?:\/\//i.test(key) || key.includes("omdbapi.com") || key.includes("apikey=")) {
      const error = new Error("Your config.js apiKey must contain only the key string, not the full OMDB URL.");
      error.code = "CONFIG";
      throw error;
    }

    return key;
  }

  function buildOmdbUrl(apiKey, title) {
    return `${OMDB_ENDPOINT}?apikey=${encodeURIComponent(apiKey)}&t=${encodeURIComponent(normalizeQuery(title))}`;
  }

  function buildOmdbSearchUrl(apiKey, query, opts) {
    const params = new URLSearchParams();
    params.set("apikey", apiKey);
    params.set("s", normalizeQuery(query));
    params.set("page", String((opts && opts.page) || 1));
    if (opts && opts.year) params.set("y", String(opts.year));
    if (opts && opts.type && opts.type !== "any") params.set("type", opts.type);
    return `${OMDB_ENDPOINT}?${params.toString()}`;
  }

  function buildOmdbDetailUrl(apiKey, imdbID) {
    const params = new URLSearchParams();
    params.set("apikey", apiKey);
    params.set("i", imdbID);
    params.set("plot", "full");
    return `${OMDB_ENDPOINT}?${params.toString()}`;
  }

  function createMovieViewModel(data) {
    if (!data || data.Response === "False") {
      const message = data && data.Error ? data.Error : "Movie not found.";
      const error = new Error(message);
      error.code = "NOT_FOUND";
      throw error;
    }

    return {
      title: data.Title || "Unknown title",
      year: data.Year || "Unknown year",
      genre: data.Genre || "Unknown genre",
      director: data.Director || "Unknown director",
      poster: data.Poster && data.Poster !== "N/A" ? data.Poster : "",
    };
  }

  function shouldSkipDuplicateSearch(nextQuery, currentQuery) {
    return normalizeQuery(nextQuery).toLowerCase() === normalizeQuery(currentQuery).toLowerCase();
  }

  function updateSearchParam(query, historyObject, locationObject) {
    const currentLocation = locationObject || root.location;
    const currentHistory = historyObject || root.history;
    const url = new URL(currentLocation.href);
    url.searchParams.set("q", normalizeQuery(query));
    currentHistory.pushState({}, "", `${url.pathname}${url.search}`);
  }

  async function omdbSearch(query, opts, apiKey, fetchImpl) {
    const response = await fetchImpl(buildOmdbSearchUrl(apiKey, query, opts || {}));
    if (!response.ok) throw new Error(`The movie service could not be reached. (HTTP ${response.status})`);
    const json = await response.json();
    if (json.Response === "False") {
      const error = new Error(json.Error || "No matches.");
      error.code = json.Error === "Movie not found!"
        ? "NO_RESULTS"
        : json.Error === "Too many results."
          ? "TOO_BROAD"
          : "API";
      throw error;
    }
    return { results: json.Search || [], total: Number(json.totalResults) || 0 };
  }

  async function omdbDetail(imdbID, apiKey, fetchImpl) {
    const response = await fetchImpl(buildOmdbDetailUrl(apiKey, imdbID));
    if (!response.ok) throw new Error(`The movie service could not be reached. (HTTP ${response.status})`);
    const json = await response.json();
    if (json.Response === "False") {
      const error = new Error(json.Error || "Not found.");
      error.code = "NOT_FOUND";
      throw error;
    }
    return json;
  }

  // Local storage helpers
  function lsGet(key, fallback) {
    try {
      const raw = root.localStorage && root.localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { root.localStorage && root.localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  // Renderers ────────────────────────────────────────────────────────────────
  function posterPlaceholderHtml(title, year) {
    return `
      <div class="poster-ph" aria-label="No poster for ${escapeHtml(title)}">
        <svg viewBox="0 0 200 296" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id="stripes" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="8" height="8" fill="transparent"/>
              <line x1="0" y1="0" x2="0" y2="8" stroke="currentColor" stroke-width="0.6" opacity=".22"/>
            </pattern>
          </defs>
          <rect width="200" height="296" fill="url(#stripes)"/>
        </svg>
        <div class="poster-ph-meta">
          <div class="poster-ph-title">${escapeHtml(title)}</div>
          <div class="poster-ph-sub">no poster · ${escapeHtml(year || "—")}</div>
        </div>
      </div>`;
  }

  function posterHtml(src, title, year) {
    const valid = src && src !== "N/A";
    if (!valid) return posterPlaceholderHtml(title, year);
    return `<img class="poster-img" src="${escapeHtml(src)}" alt="${escapeHtml(title)} poster" loading="lazy" onerror="this.outerHTML=this.dataset.fallback" data-fallback="${escapeHtml(posterPlaceholderHtml(title, year))}">`;
  }

  function emptyStateHtml() {
    return `
      <div class="state state-empty">
        <div class="state-mark">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <rect x="6" y="10" width="52" height="44" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/>
            <line x1="14" y1="10" x2="14" y2="54" stroke="currentColor" stroke-width="1"/>
            <line x1="50" y1="10" x2="50" y2="54" stroke="currentColor" stroke-width="1"/>
            ${[14,22,30,38,46].map((y) => `
              <rect x="9" y="${y-2}" width="3" height="3" fill="currentColor"/>
              <rect x="52" y="${y-2}" width="3" height="3" fill="currentColor"/>
            `).join("")}
          </svg>
        </div>
        <h2 class="state-title">Search the OMDb archive</h2>
        <p class="state-body">Type a title above. Browse posters, open a card for full credits, plot, and ratings.</p>
        <div class="state-hints">
          <span><kbd>/</kbd> focus search</span>
          <span><kbd>Esc</kbd> close detail</span>
          <span><kbd>↵</kbd> open</span>
        </div>
      </div>`;
  }

  function loadingStateHtml() {
    const cards = Array.from({ length: 12 }).map(() => `
      <div class="card card-skel">
        <div class="skel-poster"></div>
        <div class="skel-line skel-line-1"></div>
        <div class="skel-line skel-line-2"></div>
      </div>`).join("");
    return `<div class="grid" aria-busy="true" aria-live="polite">${cards}</div>`;
  }

  function errorStateHtml(message) {
    return `
      <div class="state state-error" role="alert">
        <div class="state-mark error">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <path d="M32 8L60 56H4z" fill="none" stroke="currentColor" stroke-width="1.5"/>
            <line x1="32" y1="26" x2="32" y2="42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <circle cx="32" cy="48" r="1.6" fill="currentColor"/>
          </svg>
        </div>
        <h2 class="state-title">Something broke the projector</h2>
        <p class="state-body">${escapeHtml(message)}</p>
        <button class="btn-primary" type="button" data-action="retry">Try again</button>
      </div>`;
  }

  function noResultsHtml(query) {
    return `
      <div class="state state-empty">
        <div class="state-mark">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="28" cy="28" r="18" fill="none" stroke="currentColor" stroke-width="1.4"/>
            <path d="M40 40l16 16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            <line x1="20" y1="20" x2="36" y2="36" stroke="currentColor" stroke-width="1.2"/>
            <line x1="36" y1="20" x2="20" y2="36" stroke="currentColor" stroke-width="1.2"/>
          </svg>
        </div>
        <h2 class="state-title">Nothing in the reels</h2>
        <p class="state-body">No matches for "<em>${escapeHtml(query)}</em>". Check the spelling or remove filters.</p>
        <button class="btn-secondary" type="button" data-action="clear">Clear search</button>
      </div>`;
  }

  function tooBroadHtml(query, hasFilters) {
    const suggestion = hasFilters
      ? "Type a more specific title."
      : "Add a year, pick a type, or type a more specific title.";
    return `
      <div class="state state-empty">
        <div class="state-mark">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <path d="M10 18h44M10 32h44M10 46h28" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M48 40l8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="44" cy="36" r="12" fill="none" stroke="currentColor" stroke-width="1.4"/>
          </svg>
        </div>
        <h2 class="state-title">Search is too broad</h2>
        <p class="state-body">OMDb returned too many matches for "<em>${escapeHtml(query)}</em>". ${suggestion}</p>
        <button class="btn-secondary" type="button" data-action="clear">Clear search</button>
      </div>`;
  }

  function cardHtml(movie, index) {
    const delay = Math.min(index, 18) * 24;
    return `
      <div class="grid-item" style="animation-delay: ${delay}ms">
        <article class="card" tabindex="0" role="button" aria-label="Open ${escapeHtml(movie.Title)}" data-imdb="${escapeHtml(movie.imdbID)}">
          <div class="card-poster">
            ${posterHtml(movie.Poster, movie.Title, movie.Year)}
            <div class="card-overlay"><div class="card-overlay-cta">View details →</div></div>
          </div>
          <div class="card-meta">
            <div class="card-title" title="${escapeHtml(movie.Title)}">${escapeHtml(movie.Title)}</div>
            <div class="card-sub">
              <span>${escapeHtml(movie.Year || "")}</span>
              <span class="card-dot">·</span>
              <span class="card-type">${escapeHtml(movie.Type || "")}</span>
            </div>
          </div>
        </article>
      </div>`;
  }

  function resultsMetaHtml(total, query, year, type) {
    const filters = [];
    if (type && type !== "any") filters.push(`<span class="pill">${escapeHtml(type)}</span>`);
    if (year) filters.push(`<span class="pill">${escapeHtml(year)}</span>`);
    return `
      <div class="results-meta">
        <span><strong>${total.toLocaleString()}</strong> result${total === 1 ? "" : "s"} for "<em>${escapeHtml(query)}</em>"</span>
        ${filters.length ? `<span class="results-filters">${filters.join("")}</span>` : ""}
      </div>`;
  }

  function detailBodyHtml(d) {
    const ratings = (d.Ratings || []).filter((r) => r.Value);
    const ratingsHtml = ratings.length ? `
      <div class="detail-ratings">
        ${ratings.map((r) => `
          <div class="rating">
            <div class="rating-val">${escapeHtml(r.Value)}</div>
            <div class="rating-src">${escapeHtml(r.Source)}</div>
          </div>`).join("")}
      </div>` : "";

    const eyebrow = [
      d.Type, d.Year,
      d.Rated && d.Rated !== "N/A" ? d.Rated : null,
      d.Runtime && d.Runtime !== "N/A" ? d.Runtime : null,
    ].filter(Boolean);

    const credits = [
      ["Director", d.Director], ["Writer", d.Writer], ["Cast", d.Actors],
      ["Released", d.Released], ["Country", d.Country], ["Language", d.Language],
      ["Awards", d.Awards], ["Box office", d.BoxOffice],
    ].filter(([, v]) => v && v !== "N/A");

    const genres = (d.Genre && d.Genre !== "N/A")
      ? `<div class="detail-genres">${d.Genre.split(", ").map((g) => `<span class="tag">${escapeHtml(g)}</span>`).join("")}</div>`
      : "";

    return `
      <div class="detail">
        <div class="detail-poster-wrap">${posterHtml(d.Poster, d.Title, d.Year)}</div>
        <div class="detail-info">
          <div class="detail-eyebrow">
            ${eyebrow.map((v, i) => `${i ? `<span class="dot">·</span>` : ""}<span>${escapeHtml(v)}</span>`).join("")}
          </div>
          <h1 class="detail-title">${escapeHtml(d.Title)}</h1>
          ${genres}
          ${d.Plot && d.Plot !== "N/A" ? `<p class="detail-plot">${escapeHtml(d.Plot)}</p>` : ""}
          ${ratingsHtml}
          <dl class="detail-credits">
            ${credits.map(([k, v]) => `<div class="credit-row"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("")}
          </dl>
        </div>
      </div>`;
  }

  function detailLoadingHtml() {
    return `
      <div class="detail detail-loading">
        <div class="skel-poster"></div>
        <div class="detail-info">
          <div class="skel-line skel-line-h"></div>
          <div class="skel-line"></div>
          <div class="skel-line skel-line-2"></div>
          <div class="skel-line"></div>
          <div class="skel-line skel-line-2"></div>
        </div>
      </div>`;
  }

  // App ──────────────────────────────────────────────────────────────────────
  function initApp(documentObject) {
    const doc = documentObject || root.document;

    const form = doc.getElementById("search-form");
    const input = doc.getElementById("movie-query");
    const clearBtn = doc.getElementById("search-clear");
    const kbdHint = doc.getElementById("kbd-hint");
    const yearInput = doc.getElementById("f-year");
    const typeSeg = doc.getElementById("type-seg");
    const recent = doc.getElementById("recent");
    const recentRow = doc.getElementById("recent-row");
    const results = doc.getElementById("results");
    const overlayRoot = doc.getElementById("overlay-root");

    let query = "";
    let year = "";
    let type = "any";
    let recentList = lsGet(RECENT_KEY, []);
    let lastResults = null;
    let debounceId = null;
    let searchToken = 0;

    const isMac = /Mac|iPhone|iPod|iPad/.test((root.navigator && root.navigator.platform) || "");
    if (kbdHint) kbdHint.textContent = isMac ? "⌘K" : "/";

    function getKey() {
      try { return ensureApiKey(getApiKey(root)); }
      catch (e) { return null; }
    }

    const responseCache = new Map();
    async function cachedFetch(url) {
      if (responseCache.has(url)) {
        return { ok: true, status: 200, json: async () => responseCache.get(url) };
      }
      const response = await root.fetch(url);
      if (response.ok) {
        const data = await response.clone().json();
        responseCache.set(url, data);
        if (responseCache.size > 100) responseCache.delete(responseCache.keys().next().value); // Keep max 100 items
      }
      return response;
    }

    function renderRecent() {
      if (!recentList.length) { recent.hidden = true; recentRow.innerHTML = ""; return; }
      recent.hidden = false;
      recentRow.innerHTML =
        recentList.map((q) => `<button type="button" class="chip" data-recent="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join("") +
        `<button type="button" class="chip chip-ghost" data-recent-clear="1" aria-label="Clear recent">clear</button>`;
    }

    function pushRecent(q) {
      const t = normalizeQuery(q);
      if (!t) return;
      recentList = [t, ...recentList.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT);
      lsSet(RECENT_KEY, recentList);
      renderRecent();
    }

    function showEmpty() {
      results.innerHTML = emptyStateHtml();
      lastResults = null;
    }

    async function runSearch() {
      const q = normalizeQuery(query);
      if (q.length < 2) { showEmpty(); return; }

      const apiKey = getKey();
      if (!apiKey) {
        results.innerHTML = errorStateHtml("Create config.js from config.example.js and add your OMDB API key.");
        return;
      }

      const token = ++searchToken;
      results.innerHTML = loadingStateHtml();

      try {
        const { results: items, total } = await omdbSearch(q, { year, type }, apiKey, cachedFetch);
        if (token !== searchToken) return;
        lastResults = items;
        if (!items.length) {
          results.innerHTML = noResultsHtml(q);
        } else {
          results.innerHTML =
            resultsMetaHtml(total || items.length, q, year, type) +
            `<div class="grid">${items.map((m, i) => cardHtml(m, i)).join("")}</div>`;
        }
        pushRecent(q);
        updateSearchParam(q, root.history, root.location);
      } catch (e) {
        if (token !== searchToken) return;
        if (e.code === "NO_RESULTS") {
          results.innerHTML = noResultsHtml(q);
        } else if (e.code === "TOO_BROAD") {
          results.innerHTML = tooBroadHtml(q, year || (type && type !== "any"));
        } else {
          results.innerHTML = errorStateHtml(e.message || "Request failed");
        }
      }
    }

    function scheduleSearch() {
      clearTimeout(debounceId);
      debounceId = setTimeout(runSearch, 380);
    }

    // Detail overlay
    let overlayKeyHandler = null;
    function closeOverlay() {
      overlayRoot.innerHTML = "";
      doc.body.style.overflow = "";
      if (overlayKeyHandler) {
        root.removeEventListener("keydown", overlayKeyHandler);
        overlayKeyHandler = null;
      }
    }

    async function openDetail(imdbID) {
      const apiKey = getKey();
      if (!apiKey) return;

      overlayRoot.innerHTML = `
        <div class="overlay" data-overlay>
          <div class="overlay-card" role="dialog" aria-modal="true" aria-label="Movie detail">
            <button class="overlay-close" type="button" data-overlay-close aria-label="Close detail">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
            </button>
            <div data-overlay-body>${detailLoadingHtml()}</div>
          </div>
        </div>`;
      doc.body.style.overflow = "hidden";

      overlayKeyHandler = (e) => { if (e.key === "Escape") closeOverlay(); };
      root.addEventListener("keydown", overlayKeyHandler);

      const closeEl = overlayRoot.querySelector("[data-overlay-close]");
      closeEl && closeEl.focus();

      try {
        const data = await omdbDetail(imdbID, apiKey, cachedFetch);
        const body = overlayRoot.querySelector("[data-overlay-body]");
        if (body) body.innerHTML = detailBodyHtml(data);
      } catch (e) {
        const body = overlayRoot.querySelector("[data-overlay-body]");
        if (body) body.innerHTML = `<div class="detail-error"><h3>Couldn't load this title</h3><p>${escapeHtml(e.message)}</p></div>`;
      }
    }

    // Event wiring
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      clearTimeout(debounceId);
      runSearch();
    });

    input.addEventListener("input", () => {
      query = input.value;
      clearBtn.hidden = !query;
      scheduleSearch();
    });

    clearBtn.addEventListener("click", () => {
      input.value = ""; query = ""; clearBtn.hidden = true;
      input.focus();
      showEmpty();
    });

    yearInput.addEventListener("input", () => {
      yearInput.value = yearInput.value.replace(/[^\d]/g, "").slice(0, 4);
      year = yearInput.value;
      scheduleSearch();
    });

    typeSeg.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-value]");
      if (!btn) return;
      type = btn.dataset.value;
      [...typeSeg.querySelectorAll("button")].forEach((b) => {
        b.dataset.on = b === btn ? "1" : "0";
        b.setAttribute("aria-checked", b === btn ? "true" : "false");
      });
      scheduleSearch();
    });

    recentRow.addEventListener("click", (e) => {
      const clear = e.target.closest("[data-recent-clear]");
      if (clear) { recentList = []; lsSet(RECENT_KEY, recentList); renderRecent(); return; }
      const chip = e.target.closest("[data-recent]");
      if (!chip) return;
      input.value = chip.dataset.recent;
      query = input.value;
      clearBtn.hidden = !query;
      input.focus();
      runSearch();
    });

    results.addEventListener("click", (e) => {
      const card = e.target.closest("[data-imdb]");
      if (card) { openDetail(card.dataset.imdb); return; }
      if (e.target.closest("[data-action='retry']")) { runSearch(); return; }
      if (e.target.closest("[data-action='clear']")) {
        input.value = ""; query = ""; clearBtn.hidden = true; showEmpty();
      }
    });

    results.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const card = e.target.closest("[data-imdb]");
      if (!card) return;
      e.preventDefault();
      openDetail(card.dataset.imdb);
    });

    overlayRoot.addEventListener("mousedown", (e) => {
      if (e.target.matches("[data-overlay]")) closeOverlay();
    });
    overlayRoot.addEventListener("click", (e) => {
      if (e.target.closest("[data-overlay-close]")) closeOverlay();
    });

    // Global keyboard
    root.addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName ? e.target.tagName : "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || (e.target && e.target.isContentEditable);
      if ((e.key === "/" || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) && !typing) {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });

    // Initial state — restore from URL or just show empty
    renderRecent();
    const initialQuery = new URL(root.location.href).searchParams.get("q");
    if (initialQuery) {
      input.value = initialQuery;
      query = initialQuery;
      clearBtn.hidden = false;
      runSearch();
    } else {
      showEmpty();
    }
  }

  // Fetch movie (preserved for backwards-compat with existing tests)
  async function fetchMovie(query, apiKey, fetchImpl) {
    const response = await fetchImpl(buildOmdbUrl(apiKey, query));
    if (!response.ok) throw new Error("The movie service could not be reached.");
    return createMovieViewModel(await response.json());
  }

  const api = {
    buildOmdbUrl,
    buildOmdbSearchUrl,
    buildOmdbDetailUrl,
    createMovieViewModel,
    ensureApiKey,
    fetchMovie,
    getApiKey,
    initApp,
    normalizeQuery,
    omdbSearch,
    omdbDetail,
    shouldSkipDuplicateSearch,
    updateSearchParam,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root && root.document) {
    root.addEventListener("DOMContentLoaded", () => initApp(root.document));
  }
})(typeof window !== "undefined" ? window : globalThis);
