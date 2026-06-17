import L, { type LatLngExpression, type LayerGroup, type Map as LeafletMap } from "leaflet";

interface ZabkaPoint {
  lat: number;
  lng: number;
  score: number;
}

interface ZabkaCoverageHub {
  lat: number;
  lng: number;
  label: string;
  coverage: number;
}

type ZabkaMode = "national" | "warsaw";

function pseudoRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

export function createZabkaLayer(_map: LeafletMap, count = 2400, mode: ZabkaMode = "national"): LayerGroup {
  const random = pseudoRandom(20260617);
  const renderer = L.canvas({ padding: 0.35 });
  const layers: L.Layer[] = [];

  const nationalClusters = [
    { lat: 52.23, lng: 21.01, spreadLat: 0.22, spreadLng: 0.34, weight: 0.38 },
    { lat: 50.06, lng: 19.94, spreadLat: 0.15, spreadLng: 0.24, weight: 0.18 },
    { lat: 51.77, lng: 19.46, spreadLat: 0.16, spreadLng: 0.26, weight: 0.14 },
    { lat: 51.11, lng: 17.03, spreadLat: 0.14, spreadLng: 0.24, weight: 0.12 },
    { lat: 52.41, lng: 16.93, spreadLat: 0.13, spreadLng: 0.22, weight: 0.1 },
    { lat: 54.35, lng: 18.65, spreadLat: 0.12, spreadLng: 0.22, weight: 0.08 }
  ];

  const warsawClusters = [
    { lat: 52.23, lng: 21.01, spreadLat: 0.055, spreadLng: 0.075, weight: 0.34 },
    { lat: 52.18, lng: 21.02, spreadLat: 0.04, spreadLng: 0.065, weight: 0.18 },
    { lat: 52.25, lng: 21.08, spreadLat: 0.045, spreadLng: 0.06, weight: 0.16 },
    { lat: 52.27, lng: 20.95, spreadLat: 0.044, spreadLng: 0.062, weight: 0.14 },
    { lat: 52.14, lng: 21.06, spreadLat: 0.038, spreadLng: 0.058, weight: 0.1 },
    { lat: 52.31, lng: 20.99, spreadLat: 0.036, spreadLng: 0.052, weight: 0.08 }
  ];

  const warsawCoverageHubs: ZabkaCoverageHub[] = [
    { lat: 52.232, lng: 21.012, label: "Central", coverage: 96 },
    { lat: 52.184, lng: 21.026, label: "Mokotow", coverage: 88 },
    { lat: 52.252, lng: 21.085, label: "Praga", coverage: 84 },
    { lat: 52.273, lng: 20.952, label: "Wola", coverage: 81 },
    { lat: 52.142, lng: 21.061, label: "Ursynow", coverage: 76 },
    { lat: 52.314, lng: 20.992, label: "Bielany", coverage: 72 }
  ];

  const clusters = mode === "warsaw" ? warsawClusters : nationalClusters;

  function pickCluster() {
    const roll = random();
    let cursor = 0;
    return clusters.find((cluster) => {
      cursor += cluster.weight;
      return roll <= cursor;
    }) ?? clusters[0];
  }

  function makePoint(): ZabkaPoint {
    const cluster = pickCluster();
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random());
    return {
      lat: cluster.lat + Math.sin(angle) * radius * cluster.spreadLat + (random() - 0.5) * 0.022,
      lng: cluster.lng + Math.cos(angle) * radius * cluster.spreadLng + (random() - 0.5) * 0.028,
      score: random()
    };
  }

  for (let index = 0; index < count; index += 1) {
    const point = makePoint();
    const latLng: LatLngExpression = [point.lat, point.lng];
    layers.push(L.circleMarker(latLng, {
      renderer,
      radius: point.score > 0.93 ? 2.5 : 1.55,
      stroke: false,
      fill: true,
      fillColor: point.score > 0.93 ? "#ffe66d" : "#4dff9d",
      fillOpacity: point.score > 0.93 ? 0.82 : 0.42,
      pane: "markerPane"
    }));
  }

  if (mode === "warsaw") {
    warsawCoverageHubs.forEach((hub) => {
      layers.push(L.marker([hub.lat, hub.lng], {
        interactive: false,
        pane: "markerPane",
        icon: L.divIcon({
          className: "zabka-coverage-hub",
          html: `
            <span class="zabka-logo-mark">Ż</span>
            <span class="zabka-brand-star"></span>
            <b>${hub.coverage}%</b>
          `,
          iconSize: [82, 34],
          iconAnchor: [12, 17]
        })
      }).bindTooltip(`${hub.label}: ${hub.coverage}% Zabka coverage`, {
        direction: "top",
        opacity: 0.95,
        className: "coverage-tooltip"
      }));
    });
  }

  const group = L.layerGroup(layers);
  return group;
}
