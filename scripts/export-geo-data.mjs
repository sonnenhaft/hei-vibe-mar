import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const rootDir = process.cwd();
const geoSourcePath = path.join(rootDir, "src", "geoData.ts");
const outputDir = path.join(rootDir, "public", "geo");

function featuresOf(source) {
  if (source.type === "FeatureCollection") return source.features;
  if (source.type === "Feature") return [source];
  throw new Error(`Unsupported GeoJSON source: ${source.type ?? "unknown"}`);
}

function featureCollection(...sources) {
  return {
    type: "FeatureCollection",
    features: sources.flatMap(featuresOf)
  };
}

function pseudoRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function createZabkaPointFeatures(count = 5200) {
  const random = pseudoRandom(20260617);
  const clusters = [
    { lat: 52.23, lng: 21.01, spreadLat: 0.055, spreadLng: 0.075, weight: 0.34, label: "Central" },
    { lat: 52.18, lng: 21.02, spreadLat: 0.04, spreadLng: 0.065, weight: 0.18, label: "Mokotow" },
    { lat: 52.25, lng: 21.08, spreadLat: 0.045, spreadLng: 0.06, weight: 0.16, label: "Praga" },
    { lat: 52.27, lng: 20.95, spreadLat: 0.044, spreadLng: 0.062, weight: 0.14, label: "Wola" },
    { lat: 52.14, lng: 21.06, spreadLat: 0.038, spreadLng: 0.058, weight: 0.1, label: "Ursynow" },
    { lat: 52.31, lng: 20.99, spreadLat: 0.036, spreadLng: 0.052, weight: 0.08, label: "Bielany" }
  ];

  function pickCluster() {
    const roll = random();
    let cursor = 0;
    return clusters.find((cluster) => {
      cursor += cluster.weight;
      return roll <= cursor;
    }) ?? clusters[0];
  }

  return Array.from({ length: count }, (_, index) => {
    const cluster = pickCluster();
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random());
    const lat = cluster.lat + Math.sin(angle) * radius * cluster.spreadLat + (random() - 0.5) * 0.022;
    const lng = cluster.lng + Math.cos(angle) * radius * cluster.spreadLng + (random() - 0.5) * 0.028;
    const score = random();

    return {
      type: "Feature",
      properties: {
        id: `zabka-${String(index + 1).padStart(4, "0")}`,
        kind: "zabka-store",
        cluster: cluster.label,
        score: Number(score.toFixed(4)),
        hot: score > 0.93
      },
      geometry: {
        type: "Point",
        coordinates: [Number(lng.toFixed(6)), Number(lat.toFixed(6))]
      }
    };
  });
}

function createZabkaCoverageHubFeatures() {
  return [
    { lat: 52.232, lng: 21.012, label: "Central", coverage: 96 },
    { lat: 52.184, lng: 21.026, label: "Mokotow", coverage: 88 },
    { lat: 52.252, lng: 21.085, label: "Praga", coverage: 84 },
    { lat: 52.273, lng: 20.952, label: "Wola", coverage: 81 },
    { lat: 52.142, lng: 21.061, label: "Ursynow", coverage: 76 },
    { lat: 52.314, lng: 20.992, label: "Bielany", coverage: 72 }
  ].map((hub) => ({
    type: "Feature",
    properties: {
      id: `zabka-hub-${hub.label.toLowerCase()}`,
      kind: "zabka-coverage-hub",
      label: hub.label,
      coverage: hub.coverage
    },
    geometry: {
      type: "Point",
      coordinates: [hub.lng, hub.lat]
    }
  }));
}

async function loadGeoDataModule() {
  const source = await fs.readFile(geoSourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false
    },
    fileName: geoSourcePath
  });

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "hei-map-geo-"));
  const tempModulePath = path.join(tempDir, "geoData.mjs");
  await fs.writeFile(tempModulePath, transpiled.outputText, "utf8");
  return import(pathToFileURL(tempModulePath).href);
}

async function writeGeoJson(fileName, data) {
  const filePath = path.join(outputDir, fileName);
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return { file: fileName, features: data.features?.length ?? 0 };
}

async function main() {
  const geo = await loadGeoDataModule();
  await fs.mkdir(outputDir, { recursive: true });

  const outputs = [
    ["poland-country.geojson", featureCollection(geo.polandFeature)],
    ["poland-voivodeships.geojson", geo.adminBoundaryFeatures],
    ["poland-admin-boundaries.geojson", geo.adminBoundaryFeatures],
    ["highways.geojson", featureCollection(geo.transportFeatures, geo.regionTransportFeatures, geo.cityTransportFeatures)],
    ["poland-transport.geojson", geo.transportFeatures],
    ["poland-signals.geojson", geo.signalPolygonFeatures],
    ["poland-events.geojson", geo.eventPointFeatures],
    ["poland-cities.geojson", geo.cityPointFeatures],
    ["mazowieckie-region.geojson", featureCollection(geo.mazowieckieRegionFeature)],
    ["mazowieckie-signals.geojson", geo.regionSignalPolygonFeatures],
    ["mazowieckie-transport.geojson", geo.regionTransportFeatures],
    ["mazowieckie-events.geojson", geo.regionEventPointFeatures],
    ["mazowieckie-cities.geojson", geo.regionCityPointFeatures],
    ["warsaw-city.geojson", featureCollection(geo.warsawBoundaryFeature)],
    ["warsaw-districts.geojson", geo.warsawDistrictLineFeatures],
    ["warsaw-signals.geojson", geo.citySignalPolygonFeatures],
    ["warsaw-transport.geojson", geo.cityTransportFeatures],
    ["warsaw-events.geojson", geo.cityEventPointFeatures],
    ["zabka-points.geojson", featureCollection(...createZabkaPointFeatures(5200))],
    ["zabka-coverage-hubs.geojson", featureCollection(...createZabkaCoverageHubFeatures())]
  ];

  const manifestEntries = [];
  for (const [fileName, data] of outputs) {
    manifestEntries.push(await writeGeoJson(fileName, data));
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: "src/geoData.ts + deterministic Zabka generator",
    files: manifestEntries
  };
  await fs.writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`Exported ${manifestEntries.length} GeoJSON files to public/geo`);
  manifestEntries.forEach((entry) => {
    console.log(`- ${entry.file}: ${entry.features} features`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
