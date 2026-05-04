(function (root) {
  "use strict";

  const OMDB_ENDPOINT = "https://www.omdbapi.com/";

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

  async function fetchMovie(query, apiKey, fetchImpl) {
    const response = await fetchImpl(buildOmdbUrl(apiKey, query));

    if (!response.ok) {
      throw new Error("The movie service could not be reached.");
    }

    return createMovieViewModel(await response.json());
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character];
    });
  }

  function renderMovie(target, movie) {
    const posterMarkup = movie.poster
      ? `<img src="${escapeHtml(movie.poster)}" alt="${escapeHtml(movie.title)} poster">`
      : `<div class="poster-fallback">Poster unavailable</div>`;

    target.innerHTML = `
      <article class="movie-card">
        <div class="poster-frame">${posterMarkup}</div>
        <div class="movie-details">
          <span class="movie-year">${escapeHtml(movie.year)}</span>
          <h2 class="movie-title">${escapeHtml(movie.title)}</h2>
          <dl class="fact-list">
            <div>
              <dt>Genre</dt>
              <dd>${escapeHtml(movie.genre)}</dd>
            </div>
            <div>
              <dt>Director</dt>
              <dd>${escapeHtml(movie.director)}</dd>
            </div>
          </dl>
        </div>
      </article>
    `;
  }

  function setStatus(target, message) {
    target.textContent = message;
  }

  function initApp(documentObject) {
    const documentRef = documentObject || root.document;
    const form = documentRef.getElementById("search-form");
    const input = documentRef.getElementById("movie-query");
    const button = documentRef.getElementById("search-button");
    const status = documentRef.getElementById("status");
    const result = documentRef.getElementById("result");
    let currentQuery = "";

    async function runSearch(rawQuery, options) {
      const query = normalizeQuery(rawQuery);
      const shouldUpdateUrl = !options || options.updateUrl !== false;

      if (!query) {
        setStatus(status, "Enter a movie title to search.");
        return;
      }

      if (shouldSkipDuplicateSearch(query, currentQuery)) {
        return;
      }

      let apiKey;
      try {
        apiKey = ensureApiKey(getApiKey(root));
      } catch (error) {
        setStatus(status, error.message);
        return;
      }

      button.disabled = true;
      setStatus(status, "Searching OMDB...");

      try {
        const movie = await fetchMovie(query, apiKey, root.fetch.bind(root));
        currentQuery = query;
        input.value = query;
        renderMovie(result, movie);
        setStatus(status, "");

        if (shouldUpdateUrl) {
          updateSearchParam(query, root.history, root.location);
        }
      } catch (error) {
        setStatus(
          status,
          error.code === "NOT_FOUND" || error.code === "CONFIG"
            ? error.message
            : "Something went wrong while searching. Try again in a moment."
        );
      } finally {
        button.disabled = false;
      }
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      runSearch(input.value);
    });

    const initialQuery = new URL(root.location.href).searchParams.get("q");
    if (initialQuery) {
      input.value = initialQuery;
      runSearch(initialQuery, { updateUrl: false });
    }
  }

  const api = {
    buildOmdbUrl,
    createMovieViewModel,
    ensureApiKey,
    fetchMovie,
    getApiKey,
    initApp,
    normalizeQuery,
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
