const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildOmdbUrl,
  createMovieViewModel,
  ensureApiKey,
  getApiKey,
  normalizeQuery,
  shouldSkipDuplicateSearch,
  updateSearchParam,
} = require("./app.js");

test("normalizes search queries by trimming whitespace", () => {
  assert.equal(normalizeQuery("  Inception  "), "Inception");
  assert.equal(normalizeQuery(""), "");
});

test("reads the OMDB API key from runtime config", () => {
  assert.equal(getApiKey({ OMDB_CONFIG: { apiKey: "  demo-key  " } }), "demo-key");
  assert.equal(getApiKey({}), "");
});

test("rejects a pasted OMDB URL where only the API key is expected", () => {
  assert.throws(
    () => ensureApiKey("http://www.omdbapi.com/?i=tt3896198&apikey=demo-key"),
    /only the key string/
  );
});

test("builds an OMDB title search URL", () => {
  const url = buildOmdbUrl("abc123", "The Matrix");

  assert.equal(url, "https://www.omdbapi.com/?apikey=abc123&t=The%20Matrix");
});

test("maps successful OMDB responses into the required movie details", () => {
  const movie = createMovieViewModel({
    Title: "Inception",
    Year: "2010",
    Genre: "Action, Sci-Fi",
    Director: "Christopher Nolan",
    Poster: "N/A",
    Response: "True",
  });

  assert.deepEqual(movie, {
    title: "Inception",
    year: "2010",
    genre: "Action, Sci-Fi",
    director: "Christopher Nolan",
    poster: "",
  });
});

test("detects duplicate searches without case or whitespace sensitivity", () => {
  assert.equal(shouldSkipDuplicateSearch(" Matrix ", "matrix"), true);
  assert.equal(shouldSkipDuplicateSearch("Matrix Reloaded", "matrix"), false);
});

test("updates the q URL parameter without dropping existing params", () => {
  const calls = [];
  const history = {
    pushState(_state, _title, url) {
      calls.push(url);
    },
  };
  const location = {
    href: "https://example.test/?theme=dark",
  };

  updateSearchParam("The Matrix", history, location);

  assert.equal(calls[0], "/?theme=dark&q=The+Matrix");
});
