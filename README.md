# HEI Neon Map

Leaflet + TypeScript prototype for an offline neon signal map of Poland.

## Run

```bash
npm install
npm run dev
```

The dev server is configured for `http://127.0.0.1:8123`.

## Codex Log

- [Codex chat log](codex.log.md)

## Structure

- `src/main.ts` - Leaflet app, level switching, layer toggles, AI priority scanner.
- `src/mapSvg.ts` - local offline SVG basemap fallback.
- `src/zabkaLayer.ts` - city-level Żabka canvas layer with thousands of points.
- `src/priorities.ts` - AI priority polygons that rotate by region.
- `public/data/demo.json` - demo business signals.

## Geo Data Contract

The app is ready to replace the fallback SVG with real local vector data:

- `public/geo/poland-country.geojson`
- `public/geo/poland-voivodeships.geojson`
- `public/geo/warsaw-city.geojson`
- `public/geo/highways.geojson`
- `public/geo/zabka-points.geojson`

Runtime should stay offline: GeoJSON files live in the repo and Leaflet renders them locally.
