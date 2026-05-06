# Reel Index

A small movie search app built on the OMDb API. Type a title, browse a grid of posters, click one to see the full plot, ratings, and credits.

## Features

- Live search with debounced fetches — no submit button needed
- Filter by type (movie / series / episode) and year
- Recent searches saved between visits
- Detail overlay with plot, ratings (IMDb, Rotten Tomatoes, Metacritic), full credits
- Empty, loading (skeleton grid), no-results, and error states
- Keyboard shortcuts: `/` or `⌘K` to focus search, `Esc` to close detail, `Enter` to open a card
- Last search restored from the URL on reload
- Responsive — single column on mobile, fluid grid on desktop

## Screenshots

- [Home / empty state](docs/examples/home.png)
- [Search results grid](docs/examples/results.png)
- [Detail overlay](docs/examples/detail.png)
- [Mobile layout](docs/examples/mobile.png)
