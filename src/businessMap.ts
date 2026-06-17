import L, { type LatLngBoundsExpression, type LayerGroup, type Map as LeafletMap } from "leaflet";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import {
  cityEventPointFeatures,
  cityPointFeatures,
  citySignalPolygonFeatures,
  cityTransportFeatures,
  eventPointFeatures,
  hotRegionFeatures,
  majorCities,
  mazowieckieRegionFeature,
  polandFeature,
  regionCityPointFeatures,
  regionEventPointFeatures,
  regionSignalPolygonFeatures,
  regionTransportFeatures,
  signalPolygonFeatures,
  type CityProperties,
  type EventProperties,
  type SignalKind,
  type SignalProperties,
  transportFeatures,
  warsawBoundaryFeature,
  warsawDistrictLineFeatures
} from "./geoData";
import { isLatLngInsideAllPolygons } from "./geoClip";
import { isInsidePolandStarClip, polandStarClipPolygons } from "./polandStarClip";
import type { LayerId } from "./types";

export type MapScene = "poland" | "region" | "city";

type SceneLayerGroups = Record<LayerId, LayerGroup>;

export interface BusinessMapScene {
  base: LayerGroup;
  bounds: LatLngBoundsExpression;
  groups: SceneLayerGroups;
  priorityLayer: L.GeoJSON<SignalProperties, Polygon>;
}

export interface BusinessMapLayers {
  scenes: Record<MapScene, BusinessMapScene>;
  cityById: Map<string, typeof majorCities[number]>;
}

const countryBounds: LatLngBoundsExpression = [[48.55, 12.85], [55.45, 25.35]];
const regionBounds: LatLngBoundsExpression = [[50.86, 19.05], [53.18, 22.7]];
const cityBounds: LatLngBoundsExpression = [[51.94, 20.62], [52.48, 21.42]];
const majorCityStarMinPopulationK = 500;

const countryStyle: L.PathOptions = {
  color: "rgba(239, 255, 86, 0.82)",
  weight: 1.25,
  opacity: 1,
  fill: true,
  fillColor: "transparent",
  fillOpacity: 0,
  dashArray: "5 8",
  className: "country-polygon"
};

const regionBoundaryStyle: L.PathOptions = {
  color: "rgba(239, 255, 86, 0.92)",
  weight: 3,
  opacity: 1,
  fill: true,
  fillColor: "rgba(87, 255, 61, 0.06)",
  fillOpacity: 0.75,
  dashArray: "7 8",
  className: "scene-boundary"
};

const cityBoundaryStyle: L.PathOptions = {
  ...regionBoundaryStyle,
  color: "rgba(47, 255, 255, 0.92)",
  className: "city-boundary"
};

const districtLineStyle: L.PathOptions = {
  color: "rgba(47, 255, 255, 0.68)",
  weight: 1.4,
  opacity: 1,
  dashArray: "4 8",
  className: "district-line"
};

const highwayStyle: L.PathOptions = {
  color: "rgba(239, 255, 86, 0.42)",
  weight: 3.5,
  opacity: 1,
  className: "highway-line"
};

const cityRouteStyle: L.PathOptions = {
  color: "rgba(239, 255, 86, 0.52)",
  weight: 2.5,
  opacity: 1,
  className: "city-route"
};

const riverStyle: L.PathOptions = {
  color: "rgba(47, 255, 255, 0.42)",
  weight: 5,
  opacity: 1,
  className: "city-river"
};

const signalStyles: Record<SignalKind | "countryRevenue" | "priority", L.PathOptions> = {
  countryRevenue: {
    color: "transparent",
    weight: 0,
    fillColor: "rgba(54, 255, 60, 0.32)",
    fillOpacity: 0.52,
    pane: "countryHeatPane",
    className: "country-revenue-fill"
  },
  revenue: {
    color: "transparent",
    weight: 0,
    fillColor: "rgba(87, 255, 61, 0.3)",
    fillOpacity: 0.5,
    className: "revenue-region"
  },
  expenses: {
    color: "transparent",
    weight: 0,
    fillColor: "rgba(255, 104, 35, 0.28)",
    fillOpacity: 0.46,
    className: "expenses-region"
  },
  debt: {
    color: "transparent",
    weight: 0,
    fillColor: "rgba(255, 35, 77, 0.24)",
    fillOpacity: 0.44,
    className: "debt-region"
  },
  stock: {
    color: "transparent",
    weight: 0,
    fillColor: "rgba(210, 255, 68, 0.2)",
    fillOpacity: 0.4,
    className: "stock-region"
  },
  priority: {
    color: "transparent",
    weight: 0,
    fillColor: "rgba(255, 35, 77, 0.62)",
    opacity: 0,
    fillOpacity: 0,
    className: "priority-region"
  }
};

function ensureMapPanes(map: LeafletMap): void {
  if (!map.getPane("countryHeatPane")) {
    const pane = map.createPane("countryHeatPane");
    pane.style.zIndex = "360";
    pane.style.pointerEvents = "none";
    pane.style.mixBlendMode = "screen";
  }
}

type HeatKind = "revenue" | "expenses" | "debt" | "stock" | "ai";
type HeatScene = "country" | "region" | "city";

interface HeatFrame {
  bounds: LatLngBoundsExpression;
  feature: Feature<Polygon>;
  geo: {
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
  };
}

const heatFrames: Record<HeatScene, HeatFrame> = {
  country: {
    bounds: countryBounds,
    feature: polandFeature,
    geo: { minLng: 12.85, maxLng: 25.35, minLat: 48.55, maxLat: 55.45 }
  },
  region: {
    bounds: regionBounds,
    feature: mazowieckieRegionFeature,
    geo: { minLng: 19.05, maxLng: 22.7, minLat: 50.86, maxLat: 53.18 }
  },
  city: {
    bounds: cityBounds,
    feature: warsawBoundaryFeature,
    geo: { minLng: 20.62, maxLng: 21.42, minLat: 51.94, maxLat: 52.48 }
  }
};

function featureClipPath(frame: HeatFrame, viewWidth: number, viewHeight: number): string {
  return frame.feature.geometry.coordinates[0].map(([lng, lat], index) => {
    const x = ((lng - frame.geo.minLng) / (frame.geo.maxLng - frame.geo.minLng)) * viewWidth;
    const y = ((frame.geo.maxLat - lat) / (frame.geo.maxLat - frame.geo.minLat)) * viewHeight;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ") + " Z";
}

function createSceneHeatOverlay(scene: HeatScene, kind: HeatKind): SVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const width = 1000;
  const height = 700;
  const frame = heatFrames[scene];
  const id = `${scene}-${kind}-heat`;
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("class", `country-heat-svg scene-heat-svg scene-heat-${scene} scene-heat-${kind}`);
  svg.innerHTML = `
    <defs>
      <clipPath id="${id}-clip">
        <path d="${featureClipPath(frame, width, height)}"></path>
      </clipPath>
      <filter id="${id}-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="24"></feGaussianBlur>
      </filter>
      <linearGradient id="${id}-base" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#123f24"></stop>
        <stop offset="38%" stop-color="#44ff31"></stop>
        <stop offset="65%" stop-color="#155c31"></stop>
        <stop offset="100%" stop-color="#0f351f"></stop>
      </linearGradient>
    </defs>
    <g clip-path="url(#${id}-clip)">
      ${sceneHeatMarkup(scene, kind, id)}
    </g>
  `;
  return svg;
}

function sceneHeatMarkup(scene: HeatScene, kind: HeatKind, id: string): string {
  if (scene === "region") return regionHeatMarkup(kind, id);
  if (scene === "city") return cityHeatMarkup(kind, id);
  return countryHeatMarkup(kind, id);
}

function countryHeatMarkup(kind: HeatKind, id: string): string {
  if (kind === "revenue") {
    return `
      <rect width="1000" height="700" fill="url(#${id}-base)" opacity="0.82"></rect>
      <g filter="url(#${id}-soft)">
        <ellipse cx="640" cy="326" rx="205" ry="132" fill="#66ff33" opacity="0.74"></ellipse>
        <ellipse cx="506" cy="470" rx="168" ry="94" fill="#b7ff2d" opacity="0.58"></ellipse>
        <ellipse cx="323" cy="309" rx="150" ry="104" fill="#4dff35" opacity="0.46"></ellipse>
        <ellipse cx="754" cy="206" rx="166" ry="98" fill="#0f5f2f" opacity="0.46"></ellipse>
        <ellipse cx="846" cy="372" rx="135" ry="132" fill="#ff234d" opacity="0.52"></ellipse>
        <ellipse cx="224" cy="205" rx="142" ry="102" fill="#ff234d" opacity="0.38"></ellipse>
        <ellipse cx="514" cy="164" rx="170" ry="78" fill="#0b7d38" opacity="0.42"></ellipse>
      </g>
      <rect width="1000" height="700" fill="#39ff35" opacity="0.08"></rect>
    `;
  }
  if (kind === "expenses") {
    return `
      <rect width="1000" height="700" fill="#0b2c21" opacity="0.08"></rect>
      <g filter="url(#${id}-soft)">
        <ellipse cx="268" cy="250" rx="172" ry="116" fill="#ff6b23" opacity="0.56"></ellipse>
        <ellipse cx="716" cy="378" rx="178" ry="118" fill="#ffae34" opacity="0.5"></ellipse>
        <ellipse cx="470" cy="526" rx="138" ry="86" fill="#ff234d" opacity="0.42"></ellipse>
      </g>
    `;
  }
  if (kind === "debt") {
    return `
      <rect width="1000" height="700" fill="#0b2c21" opacity="0.04"></rect>
      <g filter="url(#${id}-soft)">
        <ellipse cx="645" cy="354" rx="188" ry="118" fill="#ff234d" opacity="0.7"></ellipse>
        <ellipse cx="514" cy="505" rx="142" ry="86" fill="#ff234d" opacity="0.5"></ellipse>
        <ellipse cx="828" cy="404" rx="124" ry="112" fill="#a50026" opacity="0.44"></ellipse>
      </g>
    `;
  }
  if (kind === "stock") {
    return `
      <rect width="1000" height="700" fill="#0b2c21" opacity="0.04"></rect>
      <g filter="url(#${id}-soft)">
        <ellipse cx="515" cy="360" rx="160" ry="92" fill="#efff56" opacity="0.55"></ellipse>
        <ellipse cx="390" cy="252" rx="150" ry="86" fill="#b7ff2d" opacity="0.42"></ellipse>
        <ellipse cx="740" cy="220" rx="138" ry="92" fill="#57ff3d" opacity="0.34"></ellipse>
      </g>
    `;
  }
  return `
    <rect width="1000" height="700" fill="#0b2c21" opacity="0.02"></rect>
    <g filter="url(#${id}-soft)">
      <ellipse cx="648" cy="330" rx="198" ry="124" fill="#57ff3d" opacity="0.22"></ellipse>
      <ellipse cx="720" cy="388" rx="150" ry="94" fill="#ff234d" opacity="0.3"></ellipse>
    </g>
  `;
}

function regionHeatMarkup(kind: HeatKind, id: string): string {
  if (kind === "revenue") {
    return `
      <rect width="1000" height="700" fill="url(#${id}-base)" opacity="0.74"></rect>
      <g filter="url(#${id}-soft)">
        <ellipse cx="548" cy="287" rx="245" ry="146" fill="#66ff33" opacity="0.72"></ellipse>
        <ellipse cx="602" cy="498" rx="170" ry="112" fill="#b7ff2d" opacity="0.44"></ellipse>
        <ellipse cx="820" cy="358" rx="150" ry="132" fill="#114e29" opacity="0.46"></ellipse>
        <ellipse cx="322" cy="334" rx="152" ry="118" fill="#ff234d" opacity="0.32"></ellipse>
        <ellipse cx="672" cy="562" rx="132" ry="92" fill="#ff234d" opacity="0.38"></ellipse>
      </g>
    `;
  }
  if (kind === "expenses") {
    return `
      <rect width="1000" height="700" fill="#0b2c21" opacity="0.05"></rect>
      <g filter="url(#${id}-soft)">
        <ellipse cx="318" cy="300" rx="205" ry="124" fill="#ffae34" opacity="0.52"></ellipse>
        <ellipse cx="760" cy="368" rx="185" ry="126" fill="#ff6b23" opacity="0.48"></ellipse>
        <ellipse cx="558" cy="552" rx="148" ry="88" fill="#ff234d" opacity="0.36"></ellipse>
      </g>
    `;
  }
  if (kind === "debt") {
    return `
      <rect width="1000" height="700" fill="#0b2c21" opacity="0.03"></rect>
      <g filter="url(#${id}-soft)">
        <ellipse cx="604" cy="496" rx="246" ry="118" fill="#ff234d" opacity="0.62"></ellipse>
        <ellipse cx="514" cy="332" rx="140" ry="90" fill="#a50026" opacity="0.38"></ellipse>
      </g>
    `;
  }
  if (kind === "stock") {
    return `
      <rect width="1000" height="700" fill="#0b2c21" opacity="0.03"></rect>
      <g filter="url(#${id}-soft)">
        <ellipse cx="484" cy="196" rx="218" ry="102" fill="#efff56" opacity="0.46"></ellipse>
        <ellipse cx="338" cy="420" rx="160" ry="112" fill="#b7ff2d" opacity="0.34"></ellipse>
      </g>
    `;
  }
  return `
    <rect width="1000" height="700" fill="#0b2c21" opacity="0.02"></rect>
    <g filter="url(#${id}-soft)">
      <ellipse cx="552" cy="330" rx="240" ry="138" fill="#57ff3d" opacity="0.2"></ellipse>
      <ellipse cx="616" cy="492" rx="196" ry="104" fill="#ff234d" opacity="0.25"></ellipse>
    </g>
  `;
}

function cityHeatMarkup(kind: HeatKind, id: string): string {
  if (kind === "revenue") {
    return `
      <rect width="1000" height="700" fill="url(#${id}-base)" opacity="0.7"></rect>
      <g filter="url(#${id}-soft)">
        <ellipse cx="490" cy="268" rx="230" ry="146" fill="#66ff33" opacity="0.72"></ellipse>
        <ellipse cx="570" cy="482" rx="210" ry="112" fill="#b7ff2d" opacity="0.45"></ellipse>
        <ellipse cx="290" cy="360" rx="150" ry="118" fill="#0d6632" opacity="0.38"></ellipse>
        <ellipse cx="790" cy="352" rx="150" ry="132" fill="#ff234d" opacity="0.34"></ellipse>
      </g>
    `;
  }
  if (kind === "expenses") {
    return `
      <rect width="1000" height="700" fill="#0b2c21" opacity="0.04"></rect>
      <g filter="url(#${id}-soft)">
        <ellipse cx="292" cy="332" rx="174" ry="132" fill="#ffae34" opacity="0.46"></ellipse>
        <ellipse cx="742" cy="308" rx="170" ry="118" fill="#ff6b23" opacity="0.42"></ellipse>
        <ellipse cx="528" cy="556" rx="150" ry="88" fill="#ff234d" opacity="0.34"></ellipse>
      </g>
    `;
  }
  if (kind === "debt") {
    return `
      <rect width="1000" height="700" fill="#0b2c21" opacity="0.03"></rect>
      <g filter="url(#${id}-soft)">
        <ellipse cx="724" cy="320" rx="224" ry="128" fill="#ff234d" opacity="0.58"></ellipse>
        <ellipse cx="584" cy="470" rx="174" ry="98" fill="#a50026" opacity="0.42"></ellipse>
      </g>
    `;
  }
  if (kind === "stock") {
    return `
      <rect width="1000" height="700" fill="#0b2c21" opacity="0.03"></rect>
      <g filter="url(#${id}-soft)">
        <ellipse cx="394" cy="186" rx="210" ry="104" fill="#efff56" opacity="0.42"></ellipse>
        <ellipse cx="558" cy="300" rx="150" ry="88" fill="#b7ff2d" opacity="0.32"></ellipse>
      </g>
    `;
  }
  return `
    <rect width="1000" height="700" fill="#0b2c21" opacity="0.02"></rect>
    <g filter="url(#${id}-soft)">
      <ellipse cx="500" cy="288" rx="230" ry="132" fill="#57ff3d" opacity="0.18"></ellipse>
      <ellipse cx="720" cy="350" rx="184" ry="110" fill="#ff234d" opacity="0.25"></ellipse>
    </g>
  `;
}

function addSceneHeatLayers(groups: SceneLayerGroups, scene: HeatScene): void {
  const bounds = heatFrames[scene].bounds;
  L.svgOverlay(createSceneHeatOverlay(scene, "revenue"), bounds, {
    pane: "countryHeatPane",
    interactive: false
  }).addTo(groups.revenue);
  L.svgOverlay(createSceneHeatOverlay(scene, "expenses"), bounds, {
    pane: "countryHeatPane",
    interactive: false
  }).addTo(groups.expenses);
  L.svgOverlay(createSceneHeatOverlay(scene, "debt"), bounds, {
    pane: "countryHeatPane",
    interactive: false
  }).addTo(groups.debt);
  L.svgOverlay(createSceneHeatOverlay(scene, "stock"), bounds, {
    pane: "countryHeatPane",
    interactive: false
  }).addTo(groups.stock);
}

function addSceneAiHeat(groups: SceneLayerGroups, scene: HeatScene): void {
  L.svgOverlay(createSceneHeatOverlay(scene, "ai"), heatFrames[scene].bounds, {
    pane: "countryHeatPane",
    interactive: false
  }).addTo(groups.ai);
}

function emptyGroups(): SceneLayerGroups {
  return {
    revenue: L.layerGroup(),
    expenses: L.layerGroup(),
    events: L.layerGroup(),
    debt: L.layerGroup(),
    stock: L.layerGroup(),
    ai: L.layerGroup()
  };
}

function pickSignals(
  collection: FeatureCollection<Polygon, SignalProperties>,
  kind: SignalKind
): FeatureCollection<Polygon, SignalProperties> {
  return {
    type: "FeatureCollection",
    features: collection.features.filter((feature) => feature.properties.kind === kind)
  };
}

function firstSignal(
  collection: FeatureCollection<Polygon, SignalProperties>,
  kind: SignalKind
): Feature<Polygon, SignalProperties> {
  return collection.features.find((feature) => feature.properties.kind === kind) ?? collection.features[0];
}

function isMajorCityStar(city: CityProperties): boolean {
  return (city.populationK ?? 0) >= majorCityStarMinPopulationK;
}

function cityStarZoomScale(zoom: number): number {
  return Math.min(1.82, Math.max(0.68, 0.76 + (zoom - 5.4) * 0.18));
}

function populationStarSize(city: CityProperties, zoom: number): number {
  const populationK = city.populationK ?? 120;
  const minPopulation = 45;
  const maxPopulation = 1860;
  const clampedPopulation = Math.min(maxPopulation, Math.max(minPopulation, populationK));
  const populationScale = Math.sqrt((clampedPopulation - minPopulation) / (maxPopulation - minPopulation));
  const baseSize = 8 + populationScale * 24;
  return Math.round((city.capital ? baseSize + 3 : baseSize) * cityStarZoomScale(zoom));
}

function populationStarIcon(city: CityProperties, className: string, zoom: number): L.DivIcon {
  const iconSize = populationStarSize(city, zoom);
  return L.divIcon({
    className: `${className} brand-city-icon`,
    html: `<span class="brand-star" aria-hidden="true"></span>`,
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2]
  });
}

function addCityNodes(
  source: FeatureCollection<Point, CityProperties>,
  base: LayerGroup,
  map: LeafletMap,
  cityById: Map<string, typeof majorCities[number]>
): void {
  const populationStarMarkers: Array<{ marker: L.Marker; city: CityProperties; className: string }> = [];
  let populationStarFrame = 0;

  function updatePopulationStars(): void {
    const zoom = map.getZoom();
    populationStarMarkers.forEach(({ marker, city, className }) => {
      marker.setIcon(populationStarIcon(city, className, zoom));
    });
  }

  function schedulePopulationStarUpdate(): void {
    if (populationStarFrame) window.cancelAnimationFrame(populationStarFrame);
    populationStarFrame = window.requestAnimationFrame(() => {
      populationStarFrame = 0;
      updatePopulationStars();
    });
  }

  L.geoJSON(source, {
    pointToLayer: (feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      const coordinateLatLng = L.latLng(lat, lng);
      const city = {
        ...feature.properties,
        latLng: [coordinateLatLng.lat, coordinateLatLng.lng] as L.LatLngExpression
      };
      cityById.set(city.id, city);
      const isPopulationStar = isMajorCityStar(city);
      const className = [
        "city-node",
        city.capital ? "capital-node" : "",
        isPopulationStar ? "million-city-node" : "",
        !city.capital ? "standard-city-star" : ""
      ].filter(Boolean).join(" ");
      const marker = L.marker(coordinateLatLng, {
        icon: populationStarIcon(city, className, map.getZoom()),
        interactive: true,
        pane: "markerPane"
      });
      populationStarMarkers.push({ marker, city, className });
      marker.on("click", (event) => {
        L.DomEvent.stop(event.originalEvent);
        map.fire("business-city-click", {
          cityId: city.id,
          cityName: city.name,
          latLng: city.latLng,
          populationK: city.populationK
        });
      });
      return marker;
    }
  }).addTo(base);

  if (populationStarMarkers.length > 0) {
    map.on("zoomend viewreset", schedulePopulationStarUpdate);
  }
}

function geoJsonPolygonToLatLngs(feature: Feature<Polygon>): L.LatLngExpression[] {
  return feature.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
}

function clipCityPoints(
  source: FeatureCollection<Point, CityProperties>,
  clipFeature: Feature<Polygon>
): FeatureCollection<Point, CityProperties> {
  const polygons = [geoJsonPolygonToLatLngs(clipFeature), ...polandStarClipPolygons];
  return {
    type: "FeatureCollection",
    features: source.features.filter((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      return isLatLngInsideAllPolygons([lat, lng], polygons);
    })
  };
}

function clipEventsToPoland(
  source: FeatureCollection<Point, EventProperties>
): FeatureCollection<Point, EventProperties> {
  return {
    type: "FeatureCollection",
    features: source.features.filter((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      return isInsidePolandStarClip([lat, lng]);
    })
  };
}

function addFinancialLayers(
  groups: SceneLayerGroups,
  signalSource: FeatureCollection<Polygon, SignalProperties>,
  eventSource: FeatureCollection<Point, EventProperties>,
  heatScene?: HeatScene
): void {
  if (heatScene) {
    addSceneHeatLayers(groups, heatScene);
  } else {
    L.geoJSON(pickSignals(signalSource, "revenue"), { style: signalStyles.revenue }).addTo(groups.revenue);
    L.geoJSON(pickSignals(signalSource, "expenses"), { style: signalStyles.expenses }).addTo(groups.expenses);
    L.geoJSON(pickSignals(signalSource, "debt"), { style: signalStyles.debt }).addTo(groups.debt);
    L.geoJSON(pickSignals(signalSource, "stock"), { style: signalStyles.stock }).addTo(groups.stock);
  }
  const clippedEventSource = clipEventsToPoland(eventSource);
  L.geoJSON(clippedEventSource, {
    pointToLayer: (_feature, latlng) => L.marker(latlng, {
      interactive: false,
      pane: "markerPane",
      icon: L.divIcon({
        className: "event-star-icon",
        html: `<span class="event-star" aria-hidden="true"></span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      })
    })
  }).addTo(groups.events);
  L.geoJSON(clippedEventSource, {
    pointToLayer: (feature, latlng) => L.marker(latlng, {
      interactive: false,
      icon: L.divIcon({
        className: "event-label",
        html: feature.properties.name,
        iconSize: [150, 24],
        iconAnchor: [-10, 24]
      })
    })
  }).addTo(groups.events);
}

function createPriorityLayer(feature: Feature<Polygon, SignalProperties>, groups: SceneLayerGroups): L.GeoJSON<SignalProperties, Polygon> {
  return L.geoJSON<SignalProperties, Polygon>(feature, {
    style: signalStyles.priority
  }).addTo(groups.ai);
}

type SalesDirectiveTone = "go" | "next" | "watch" | "skip";

interface SalesDirective {
  latLng: L.LatLngExpression;
  label: string;
  target: string;
  tone: SalesDirectiveTone;
}

function addSalesDirectiveLabels(groups: SceneLayerGroups, directives: SalesDirective[]): void {
  directives.forEach((directive) => {
    L.marker(directive.latLng, {
      interactive: false,
      pane: "markerPane",
      icon: L.divIcon({
        className: `sales-directive sales-directive-${directive.tone}`,
        html: `<strong>${directive.label}</strong><span>${directive.target}</span>`,
        iconSize: [126, 38],
        iconAnchor: [18, 19]
      })
    }).addTo(groups.ai);
  });
}

export function createBusinessMap(map: LeafletMap): BusinessMapLayers {
  ensureMapPanes(map);
  const cityById = new Map<string, typeof majorCities[number]>();

  const countryBase = L.layerGroup();
  L.geoJSON(polandFeature, { style: countryStyle }).addTo(countryBase);
  L.geoJSON(transportFeatures, { style: highwayStyle }).addTo(countryBase);
  addCityNodes(clipCityPoints(cityPointFeatures, polandFeature), countryBase, map, cityById);

  const countryGroups = emptyGroups();
  addFinancialLayers(countryGroups, signalPolygonFeatures, eventPointFeatures, "country");
  addSceneAiHeat(countryGroups, "country");
  const countryPriorityLayer = L.geoJSON<SignalProperties, Polygon>(undefined, {
    style: signalStyles.priority
  }).addTo(countryGroups.ai);
  addSalesDirectiveLabels(countryGroups, [
    { latLng: [52.23, 21.01], label: "Visit first", target: "Warsaw-Lodz", tone: "go" },
    { latLng: [50.26, 19.02], label: "Visit next", target: "Silesia-Krakow", tone: "next" },
    { latLng: [53.58, 22.25], label: "Low priority", target: "NE weak sales", tone: "skip" }
  ]);

  const regionBase = L.layerGroup();
  L.geoJSON(mazowieckieRegionFeature, { style: regionBoundaryStyle }).addTo(regionBase);
  L.geoJSON(regionTransportFeatures, { style: highwayStyle }).addTo(regionBase);
  addCityNodes(clipCityPoints(regionCityPointFeatures, mazowieckieRegionFeature), regionBase, map, cityById);

  const regionGroups = emptyGroups();
  addFinancialLayers(regionGroups, regionSignalPolygonFeatures, regionEventPointFeatures, "region");
  addSceneAiHeat(regionGroups, "region");
  const regionPriorityLayer = createPriorityLayer(firstSignal(regionSignalPolygonFeatures, "debt"), regionGroups);
  addSalesDirectiveLabels(regionGroups, [
    { latLng: [52.23, 21.01], label: "Visit first", target: "Warsaw core", tone: "go" },
    { latLng: [51.4, 21.15], label: "Collect debt", target: "Radom belt", tone: "watch" },
    { latLng: [52.17, 22.27], label: "Monitor", target: "Eastern route", tone: "next" }
  ]);

  const cityBase = L.layerGroup();
  L.geoJSON(warsawBoundaryFeature, { style: cityBoundaryStyle }).addTo(cityBase);
  L.geoJSON(warsawDistrictLineFeatures, { style: districtLineStyle }).addTo(cityBase);
  L.geoJSON(cityTransportFeatures, {
    style: (feature) => feature?.properties.kind === "admin" ? riverStyle : cityRouteStyle
  }).addTo(cityBase);

  const cityGroups = emptyGroups();
  addFinancialLayers(cityGroups, citySignalPolygonFeatures, cityEventPointFeatures, "city");
  addSceneAiHeat(cityGroups, "city");
  const cityPriorityLayer = createPriorityLayer(firstSignal(citySignalPolygonFeatures, "debt"), cityGroups);
  addSalesDirectiveLabels(cityGroups, [
    { latLng: [52.23, 21.01], label: "Visit first", target: "Central Zabka", tone: "go" },
    { latLng: [52.18, 21.02], label: "Visit next", target: "Mokotow", tone: "next" },
    { latLng: [52.25, 21.08], label: "Monitor", target: "Praga debt", tone: "watch" }
  ]);

  return {
    scenes: {
      poland: { base: countryBase, bounds: countryBounds, groups: countryGroups, priorityLayer: countryPriorityLayer },
      region: { base: regionBase, bounds: regionBounds, groups: regionGroups, priorityLayer: regionPriorityLayer },
      city: { base: cityBase, bounds: cityBounds, groups: cityGroups, priorityLayer: cityPriorityLayer }
    },
    cityById
  };
}

export function getPriorityFeature(index: number, scene: MapScene): Feature<Polygon, SignalProperties> {
  if (scene === "city") {
    const cityPriority = citySignalPolygonFeatures.features.filter((feature) => feature.properties.kind === "debt" || feature.properties.kind === "expenses");
    return cityPriority[index % cityPriority.length];
  }
  if (scene === "region") {
    const regionPriority = regionSignalPolygonFeatures.features.filter((feature) => feature.properties.kind === "debt" || feature.properties.kind === "expenses");
    return regionPriority[index % regionPriority.length];
  }
  return hotRegionFeatures[index % hotRegionFeatures.length];
}
