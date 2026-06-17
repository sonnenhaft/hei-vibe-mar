import L, { type LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import { createBusinessMap, getPriorityFeature, type BusinessMapLayers, type MapScene } from "./businessMap";
import { loadDemoData } from "./data";
import {
  eventPointFeatures,
  majorCities,
  regionEventPointFeatures,
  type EventProperties
} from "./geoData";
import { isLatLngInsideAllPolygons } from "./geoClip";
import { polandStarClipPolygons } from "./polandStarClip";
import { createZabkaLayer, type ZabkaStoreClickPayload } from "./zabkaLayer";
import type { Feature, Point } from "geojson";
import type { CitySignal, DemoData, LayerId, PriorityRegion, RegionId, RegionSignal } from "./types";

const layerNames: Record<LayerId, string> = {
  revenue: "Revenue",
  expenses: "Expenses",
  events: "Events",
  debt: "Debt",
  stock: "Stock",
  ai: "AI"
};

const metricMap: Record<Exclude<LayerId, "ai">, keyof DemoData["regions"][number]> = {
  revenue: "revenueMlnPln",
  expenses: "expensesMlnPln",
  events: "eventForecast",
  debt: "debtMlnPln",
  stock: "warehouseOverstock"
};

const cityZabkaPointCount = 1700;
const cityRetailMinZoom = 8.2;
const polandBounds: LatLngBoundsExpression = [[48.55, 12.85], [55.45, 25.35]];

const tacticalEdicts: PriorityRegion[] = [
  {
    id: "mazowieckie",
    label: "Warsaw revenue core",
    center: [52.23, 21.01],
    zoom: 8,
    polygon: "",
    reason: "Revenue is concentrated around Warsaw; protect margin before costs spread outward."
  },
  {
    id: "mazowieckie",
    label: "Southern debt belt",
    center: [51.4, 21.15],
    zoom: 8,
    polygon: "",
    reason: "Debt pressure is strongest on the Warsaw-Radom corridor; send finance with sales."
  },
  {
    id: "mazowieckie",
    label: "Eastern cost drag",
    center: [52.17, 22.27],
    zoom: 8,
    polygon: "",
    reason: "Route costs leak east of Warsaw; inspect field travel, replenishment, and overdue accounts."
  }
];

interface AppState {
  view: MapScene;
  selectedRegion: RegionId;
  selectedCity: string;
  focusedCityId: string | null;
  selectedZabkaStore: SelectedZabkaStore | null;
  priorityIndex: number;
  data: DemoData;
}

interface CityMapOption {
  id: string;
  name: string;
  latLng: L.LatLngExpression;
  populationK?: number;
}

interface BusinessCityClickPayload {
  cityId?: string;
  cityName?: string;
  latLng?: L.LatLngExpression;
  populationK?: number;
}

type RuntimeLayerGroups = Record<LayerId, L.LayerGroup>;

interface MonthlyPoint {
  label: string;
  revenue: number;
  expenses: number;
  debt: number;
}

interface ZabkaStatus {
  id: string;
  label: string;
  status: "OK" | "Visit" | "Debt" | "Stock";
  health: number;
  revenueMlnPln: number;
  debtMlnPln: number;
  stockPressure: number;
  months: number[];
}

interface SelectedZabkaStore extends ZabkaStatus {
  name: string;
  cityId: string;
  lat: number;
  lng: number;
  score: number;
  expensesMlnPln: number;
  marginMlnPln: number;
  routePriority: number;
}

interface RestaurantStatus {
  id: string;
  label: string;
  status: "Peak" | "Visit" | "Risk" | "OK";
  health: number;
  revenueMlnPln: number;
  eventLift: number;
  stockNeed: number;
  northKm: number;
  eastKm: number;
  months: number[];
}

const regionLabels: Record<RegionId, string> = {
  mazowieckie: "Mazowieckie",
  lodzkie: "Lodzkie",
  wielkopolskie: "Wielkopolskie",
  malopolskie: "Malopolskie",
  slaskie: "Slaskie",
  pomorskie: "Pomorskie",
  dolnoslaskie: "Dolnoslaskie",
  "kujawsko-pomorskie": "Kujawsko-Pomorskie",
  lubelskie: "Lubelskie",
  lubuskie: "Lubuskie",
  opolskie: "Opolskie",
  podkarpackie: "Podkarpackie",
  podlaskie: "Podlaskie",
  swietokrzyskie: "Swietokrzyskie",
  "warminsko-mazurskie": "Warminsko-Mazurskie",
  zachodniopomorskie: "Zachodniopomorskie"
};

const cityRegionFallback: Record<string, RegionId> = {
  warsaw: "mazowieckie",
  radom: "mazowieckie",
  plock: "mazowieckie",
  krakow: "malopolskie",
  tarnow: "malopolskie",
  lodz: "lodzkie",
  wroclaw: "dolnoslaskie",
  poznan: "wielkopolskie",
  kalisz: "wielkopolskie",
  gdansk: "pomorskie",
  gdynia: "pomorskie",
  katowice: "slaskie",
  czestochowa: "slaskie",
  "bielsko-biala": "slaskie",
  gliwice: "slaskie",
  szczecin: "zachodniopomorskie",
  koszalin: "zachodniopomorskie",
  bydgoszcz: "kujawsko-pomorskie",
  torun: "kujawsko-pomorskie",
  lublin: "lubelskie",
  bialystok: "podlaskie",
  rzeszow: "podkarpackie",
  kielce: "swietokrzyskie",
  olsztyn: "warminsko-mazurskie",
  elblag: "warminsko-mazurskie",
  opole: "opolskie",
  "zielona-gora": "lubuskie",
  gorzow: "lubuskie"
};

function createRuntimeLayerGroups(): RuntimeLayerGroups {
  return {
    revenue: L.layerGroup(),
    expenses: L.layerGroup(),
    events: L.layerGroup(),
    debt: L.layerGroup(),
    stock: L.layerGroup(),
    ai: L.layerGroup()
  };
}

function renderShell(): void {
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
    <main class="map-frame">
      <div class="imperial-decree" aria-hidden="true">
        <strong>FIELD SALES MANDATE</strong>
        <span>M40.000 / POLAND FRONT</span>
      </div>
      <div class="topbar">
        <div class="chips">
          <span class="chip" id="breadcrumb">Segmentum / Poland</span>
          <span class="chip" id="hint">Noosphere sales auspex</span>
        </div>
        <div class="zoom">
          <button id="zoomOut" type="button" aria-label="Zoom out">-</button>
          <button id="zoomIn" type="button" aria-label="Zoom in">+</button>
        </div>
      </div>
      <section class="city-chat collapsed" aria-label="AI command chat">
        <div class="city-chat-head">
          <div>
            <b>AI CHAT</b>
            <span>DRAG / ASK</span>
          </div>
          <button class="city-chat-toggle" id="cityChatToggle" type="button" aria-expanded="false">Open</button>
        </div>
        <div class="city-chat-log" id="cityChatLog">
          <article class="chat-message bot">
            <b>AI</b>
            <p>Ask where to go, or name a city. I will open the AI contour on the map.</p>
          </article>
        </div>
        <form class="city-chat-form" id="cityChatForm">
          <input id="cityChatInput" autocomplete="off" spellcheck="false" placeholder="Ask: should we go to Warsaw?">
          <button type="submit">Send</button>
        </form>
      </section>
      <div id="map" aria-label="Offline neon Poland business map"></div>
      <div class="damage-overlay" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
    </main>

    <aside class="hud">
      <div class="hud-head">
        <h1>SALES<br>40000</h1>
        <span class="status">M40.000</span>
      </div>

      <h2>Campaign Theatre</h2>
      <div class="view-switch">
        <button class="active" type="button" data-view="poland">Poland</button>
        <button type="button" data-view="region">Region</button>
        <button type="button" data-view="city">City</button>
      </div>

      <h2>Auspex Layers</h2>
      <div class="compact-layers">
        <label class="layer-pill" style="--accent: var(--green);"><input type="checkbox" data-layer="revenue" checked>Revenue</label>
        <label class="layer-pill" style="--accent: var(--orange);"><input type="checkbox" data-layer="expenses" checked>Costs</label>
        <label class="layer-pill" style="--accent: var(--yellow);"><input type="checkbox" data-layer="events" checked>Events</label>
        <label class="layer-pill" style="--accent: var(--red);"><input type="checkbox" data-layer="debt" checked>Debt</label>
        <label class="layer-pill" style="--accent: var(--orange);"><input type="checkbox" data-layer="stock" checked>Stock</label>
        <label class="layer-pill" style="--accent: var(--green);"><input type="checkbox" data-layer="ai" checked>AI</label>
      </div>

      <h2>Tithe Ledger</h2>
      <div class="metrics" id="stats"></div>

      <h2>12M Bar Graph</h2>
      <div class="monthly-chart" id="monthlyChart"></div>

      <h2>Żabka Store Status</h2>
      <div class="zabka-status-panel" id="zabkaStatus"></div>

      <h2>Restaurant Status</h2>
      <div class="restaurant-status-panel" id="restaurantStatus"></div>

      <h2>Sales Targets</h2>
      <div class="sales-route-panel" id="salesRoute"></div>

      <h2>Damage Forecast</h2>
      <div class="damage-panel" id="damagePanel"></div>

      <h2>Event Auspex</h2>
      <div class="details-panel" id="detailsPanel"></div>

      <h2>Field Orders</h2>
      <div class="ai-card">
        <h3>Sales visit target</h3>
        <div class="ai-text" id="aiPrompt"></div>
        <button class="ai-run" type="button" id="runAi">Next target</button>
      </div>

      <h2>Ledger Bars</h2>
      <div class="legend" id="legend"></div>

      <div class="readout">
        <p class="small" id="readout">Green = revenue. Orange/red = expenses, debt, waste.</p>
      </div>
    </aside>
  `;
}

function marginMlnPln(entity: RegionSignal | CitySignal): number {
  return entity.revenueMlnPln - entity.expensesMlnPln;
}

function formatCompactNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
    useGrouping: false
  }).format(value);
}

function formatMoneyPln(valueMln: number): string {
  const sign = valueMln < 0 ? -1 : 1;
  const absolute = Math.abs(valueMln);
  if (absolute >= 1000) {
    const truncated = Math.trunc((absolute / 1000) * 10) / 10;
    return `${formatCompactNumber(truncated * sign, 1)}MM pln`;
  }
  if (absolute >= 100) {
    return `${formatCompactNumber(Math.round(absolute / 10) * 10 * sign)}M pln`;
  }
  if (absolute >= 10) {
    return `${formatCompactNumber(Math.round(absolute) * sign)}M pln`;
  }
  if (absolute >= 1) {
    return `${formatCompactNumber(absolute * sign, 1)}M pln`;
  }
  const thousands = Math.max(37, Math.round((absolute || 0.137) * 1000));
  return `${formatCompactNumber(thousands * sign)}k pln`;
}

function formatTrendPercent(value: number): string {
  const sign = value < 0 ? "-" : "+";
  const absolute = Math.abs(value) < 0.1 ? 1.7 : Math.abs(value);
  return `${sign}${formatCompactNumber(absolute, 1)}%`;
}

function moneyScore(value: number): number {
  return Math.min(100, Math.max(4, Math.round(value / 15)));
}

function metricScore(metric: keyof RegionSignal, raw: number): number {
  if (metric === "revenueMlnPln" || metric === "expensesMlnPln" || metric === "debtMlnPln") {
    return moneyScore(raw);
  }
  return raw;
}

function metricValue(entity: RegionSignal | CitySignal, metric: keyof RegionSignal): string | number {
  const raw = entity[metric] as number;
  if (metric === "revenueMlnPln" || metric === "expensesMlnPln" || metric === "debtMlnPln") {
    return formatMoneyPln(raw);
  }
  return raw;
}

function scoreColor(score: number): string {
  if (score >= 82) return "var(--red)";
  if (score >= 66) return "var(--orange)";
  if (score >= 45) return "var(--yellow)";
  return "var(--green)";
}

const cyrillicToLatin: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sh",
  ы: "y",
  э: "e",
  ю: "yu",
  я: "ya",
  ь: "",
  ъ: ""
};

function normalizeCityText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "l")
    .replace(/[а-яё]/gi, (char) => cyrillicToLatin[char.toLowerCase()] ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char] ?? char));
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function hashString(value: string): number {
  return [...value].reduce((hash, char) => {
    return Math.imul(31, hash) + char.charCodeAt(0) | 0;
  }, 2166136261);
}

function seededNoise(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ mixed >>> 15, mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}

function visibleCode(seed: string, digits = 3): string {
  const random = seededNoise(hashString(seed));
  return Array.from({ length: digits }, () => String(Math.floor(random() * 9) + 1)).join("");
}

function zabkaLoreName(seed: string, zone?: string): string {
  const random = seededNoise(hashString(seed));
  const prefixes = ["Verdant", "Vistula", "Neon", "Pilgrim", "Market", "Night", "Amber", "Fresh", "Signal", "Metro", "Iron", "Saint"];
  const nouns = ["Gate", "Reliquary", "Bastion", "Lantern", "Depot", "Shrine", "Outpost", "Circuit", "Forge", "Cantina", "Anchor", "Vault"];
  const prefix = prefixes[Math.floor(random() * prefixes.length)];
  const noun = nouns[Math.floor(random() * nouns.length)];
  return `Żabka ${prefix} ${noun}${zone ? ` / ${zone}` : ""}`;
}

function createCityContour(center: L.LatLng, cityId: string, populationK = 120): L.LatLngExpression[] {
  const random = seededNoise(hashString(cityId));
  const radiusKm = Math.min(18, Math.max(4.6, Math.sqrt(populationK) * 0.28));
  const latitudeScale = radiusKm / 111;
  const longitudeScale = radiusKm / (111 * Math.max(0.22, Math.cos(center.lat * Math.PI / 180)));
  const rotation = random() * Math.PI;
  const points: L.LatLngExpression[] = [];

  for (let index = 0; index < 56; index += 1) {
    const angle = (Math.PI * 2 * index) / 56;
    const lump = 0.82 + random() * 0.34;
    const ridge = 1 + Math.sin(angle * 3 + random() * 0.8) * 0.08 + Math.cos(angle * 5 + random()) * 0.06;
    const radius = lump * ridge;
    const x = Math.cos(angle) * radius * (1.08 + random() * 0.22);
    const y = Math.sin(angle) * radius * (0.78 + random() * 0.18);
    const rotatedX = x * Math.cos(rotation) - y * Math.sin(rotation);
    const rotatedY = x * Math.sin(rotation) + y * Math.cos(rotation);
    points.push([
      center.lat + rotatedY * latitudeScale,
      center.lng + rotatedX * longitudeScale
    ]);
  }

  return points;
}

function initMap(): L.Map {
  const map = L.map("map", {
    attributionControl: false,
    zoomControl: false,
    minZoom: 4.5,
    maxZoom: 11,
    zoomSnap: 0.25,
    wheelPxPerZoomLevel: 78,
    preferCanvas: true,
    maxBounds: [[47.8, 11.6], [56.5, 27.4]],
    maxBoundsViscosity: 0.28
  });

  L.control.attribution({ prefix: false, position: "bottomright" }).addTo(map);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    className: "osm-neon-tiles",
    maxZoom: 19,
    crossOrigin: true
  }).addTo(map);

  map.fitBounds(polandBounds, { padding: [12, 12], animate: false });
  return map;
}

function bootInteractions(map: L.Map, layers: BusinessMapLayers, data: DemoData): void {
  const sceneOrder: MapScene[] = ["poland", "region", "city"];
  let activeScene: MapScene | null = null;
  const state: AppState = {
    view: "poland",
    selectedRegion: "mazowieckie",
    selectedCity: "warsaw",
    focusedCityId: null,
    selectedZabkaStore: null,
    priorityIndex: -1,
    data
  };

  const breadcrumbEl = document.querySelector<HTMLSpanElement>("#breadcrumb")!;
  const hintEl = document.querySelector<HTMLSpanElement>("#hint")!;
  const statsEl = document.querySelector<HTMLDivElement>("#stats")!;
  const monthlyChartEl = document.querySelector<HTMLDivElement>("#monthlyChart")!;
  const zabkaStatusEl = document.querySelector<HTMLDivElement>("#zabkaStatus")!;
  const restaurantStatusEl = document.querySelector<HTMLDivElement>("#restaurantStatus")!;
  const salesRouteEl = document.querySelector<HTMLDivElement>("#salesRoute")!;
  const damageEl = document.querySelector<HTMLDivElement>("#damagePanel")!;
  const detailsEl = document.querySelector<HTMLDivElement>("#detailsPanel")!;
  const legendEl = document.querySelector<HTMLDivElement>("#legend")!;
  const readoutEl = document.querySelector<HTMLParagraphElement>("#readout")!;
  const aiPromptEl = document.querySelector<HTMLDivElement>("#aiPrompt")!;
  const mapFrameEl = document.querySelector<HTMLElement>(".map-frame")!;
  const cityChatEl = document.querySelector<HTMLElement>(".city-chat")!;
  const cityChatHead = document.querySelector<HTMLElement>(".city-chat-head")!;
  const cityChatToggle = document.querySelector<HTMLButtonElement>("#cityChatToggle")!;
  const cityChatForm = document.querySelector<HTMLFormElement>("#cityChatForm")!;
  const cityChatInput = document.querySelector<HTMLInputElement>("#cityChatInput")!;
  const cityChatLog = document.querySelector<HTMLDivElement>("#cityChatLog")!;
  const navButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-view]")];
  const layerInputs = [...document.querySelectorAll<HTMLInputElement>("[data-layer]")];
  const selectedCityBase = L.layerGroup();
  const selectedCityGroups = createRuntimeLayerGroups();
  let cityRetailLayer: L.LayerGroup | null = null;
  let cityRetailLayerId: string | null = null;
  const chatContourLayer = L.layerGroup().addTo(map);
  const cityOptions: CityMapOption[] = majorCities
    .map((city) => ({
      id: city.id,
      name: city.name,
      latLng: city.latLng,
      populationK: city.populationK
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const cityAliases = new Map<string, string>([
    ["warszawa", "warsaw"],
    ["varshava", "warsaw"],
    ["varshavu", "warsaw"],
    ["varshave", "warsaw"],
    ["krakow", "krakow"],
    ["krakov", "krakow"],
    ["krakove", "krakow"],
    ["lodz", "lodz"],
    ["lodzy", "lodz"],
    ["wroclaw", "wroclaw"],
    ["vroclav", "wroclaw"],
    ["vroclave", "wroclaw"],
    ["poznan", "poznan"],
    ["gdansk", "gdansk"],
    ["katowice", "katowice"],
    ["katovice", "katowice"],
    ["radom", "radom"],
    ["plock", "plock"],
    ["bialystok", "bialystok"],
    ["belostok", "bialystok"],
    ["rzeszow", "rzeszow"],
    ["zheshuv", "rzeszow"],
    ["czestochowa", "czestochowa"],
    ["chenstohova", "czestochowa"],
    ["bielskobiala", "bielsko-biala"],
    ["zielonagora", "zielona-gora"],
    ["gorzowwielkopolski", "gorzow"]
  ]);

  function cityOptionById(cityId: string): CityMapOption {
    return cityOptions.find((city) => city.id === cityId) ?? cityOptions.find((city) => city.id === "warsaw") ?? cityOptions[0];
  }

  function ensureCityOptionFromClick(payload: BusinessCityClickPayload): CityMapOption | null {
    if (!payload.cityId) return null;

    const existing = cityOptions.find((city) => city.id === payload.cityId);
    if (existing) return existing;

    const mapCity = layers.cityById.get(payload.cityId);
    const latLng = payload.latLng ?? mapCity?.latLng;
    if (!latLng) return null;

    const option: CityMapOption = {
      id: payload.cityId,
      name: payload.cityName ?? mapCity?.name ?? payload.cityId,
      latLng,
      populationK: payload.populationK ?? mapCity?.populationK
    };
    cityOptions.push(option);
    cityAliases.set(normalizeCityText(option.name), option.id);
    return option;
  }

  function regionIdForCity(city: CityMapOption, knownCity?: CitySignal): RegionId {
    return knownCity?.regionId ?? cityRegionFallback[city.id] ?? "mazowieckie";
  }

  function regionEntity(regionId: RegionId): RegionSignal {
    const existing = state.data.regions.find((region) => region.id === regionId);
    if (existing) return existing;

    const regionCities = state.data.cities.filter((city) => city.regionId === regionId);
    const population = regionCities.reduce((sum, city) => sum + city.population, 0) || 1800000;
    const revenue = regionCities.reduce((sum, city) => sum + city.revenueMlnPln, 0) || Math.round(population / 5200);
    const expenses = regionCities.reduce((sum, city) => sum + city.expensesMlnPln, 0) || Math.round(revenue * 0.68);
    const debt = regionCities.reduce((sum, city) => sum + city.debtMlnPln, 0) || Math.round(revenue * 0.46);
    const divisor = Math.max(1, regionCities.length);

    return {
      id: regionId,
      name: regionLabels[regionId],
      population,
      revenueMlnPln: revenue,
      expensesMlnPln: expenses,
      debtMlnPln: debt,
      salesIndex: regionCities.length ? Math.round(regionCities.reduce((sum, city) => sum + city.salesIndex, 0) / divisor) : 58,
      debtRisk: regionCities.length ? Math.round(regionCities.reduce((sum, city) => sum + city.debtRisk, 0) / divisor) : 44,
      warehouseOverstock: regionCities.length ? Math.round(regionCities.reduce((sum, city) => sum + city.warehouseOverstock, 0) / divisor) : 38,
      eventForecast: regionCities.length ? Math.round(regionCities.reduce((sum, city) => sum + city.eventForecast, 0) / divisor) : 52
    };
  }

  function synthesizeCitySignal(city: CityMapOption): CitySignal {
    const regionId = regionIdForCity(city);
    const region = regionEntity(regionId);
    const random = seededNoise(hashString(city.id));
    const population = Math.round((city.populationK ?? 145) * 1000);
    const populationShare = Math.min(0.42, Math.max(0.025, population / Math.max(region.population, population * 2.4)));
    const demand = 0.82 + random() * 0.38;
    const pressure = 0.74 + random() * 0.5;
    const revenue = Math.max(18, Math.round(region.revenueMlnPln * populationShare * demand));
    const expenses = Math.max(12, Math.round(revenue * (0.56 + random() * 0.24)));
    const debt = Math.max(6, Math.round(region.debtMlnPln * populationShare * pressure));

    return {
      id: city.id,
      name: city.name,
      regionId,
      population,
      revenueMlnPln: revenue,
      expensesMlnPln: expenses,
      debtMlnPln: debt,
      salesIndex: Math.min(96, Math.max(38, Math.round(region.salesIndex * 0.82 + random() * 24))),
      debtRisk: Math.min(92, Math.max(22, Math.round(region.debtRisk * 0.74 + random() * 28))),
      warehouseOverstock: Math.min(88, Math.max(16, Math.round(region.warehouseOverstock * 0.76 + random() * 30))),
      eventForecast: Math.min(96, Math.max(22, Math.round(region.eventForecast * 0.78 + random() * 30))),
      trailScore: Math.min(94, Math.max(30, Math.round(region.salesIndex * 0.62 + region.eventForecast * 0.22 + random() * 22)))
    };
  }

  function citySignalForOption(city: CityMapOption): CitySignal {
    return state.data.cities.find((item) => item.id === city.id) ?? synthesizeCitySignal(city);
  }

  function selectedCitySignal(): CitySignal {
    return citySignalForOption(cityOptionById(state.selectedCity));
  }
  function countryEntity(): RegionSignal {
    const totals = state.data.regions.reduce((acc, region) => ({
      population: acc.population + region.population,
      revenueMlnPln: acc.revenueMlnPln + region.revenueMlnPln,
      expensesMlnPln: acc.expensesMlnPln + region.expensesMlnPln,
      debtMlnPln: acc.debtMlnPln + region.debtMlnPln,
      salesIndex: acc.salesIndex + region.salesIndex,
      debtRisk: acc.debtRisk + region.debtRisk,
      warehouseOverstock: acc.warehouseOverstock + region.warehouseOverstock,
      eventForecast: acc.eventForecast + region.eventForecast
    }), {
      population: 0,
      revenueMlnPln: 0,
      expensesMlnPln: 0,
      debtMlnPln: 0,
      salesIndex: 0,
      debtRisk: 0,
      warehouseOverstock: 0,
      eventForecast: 0
    });
    const count = Math.max(1, state.data.regions.length);
    return {
      id: "mazowieckie",
      name: "Poland total",
      population: totals.population,
      revenueMlnPln: totals.revenueMlnPln,
      expensesMlnPln: totals.expensesMlnPln,
      debtMlnPln: totals.debtMlnPln,
      salesIndex: Math.round(totals.salesIndex / count),
      debtRisk: Math.round(totals.debtRisk / count),
      warehouseOverstock: Math.round(totals.warehouseOverstock / count),
      eventForecast: Math.round(totals.eventForecast / count)
    };
  }

  const selectedEntity = () => {
    if (state.view === "poland") return countryEntity();
    if (state.view === "city") return selectedCitySignal();
    return regionEntity(state.selectedRegion);
  };

  function citySearchNames(city: CityMapOption): string[] {
    const aliases = [...cityAliases.entries()]
      .filter(([, cityId]) => cityId === city.id)
      .map(([alias]) => alias);
    return [city.id, city.name, ...aliases]
      .filter(Boolean)
      .map(normalizeCityText);
  }

  function bestCityMatch(rawValue: string): CityMapOption | null {
    const query = normalizeCityText(rawValue);
    if (!query) return null;
    const aliasId = cityAliases.get(query);
    if (aliasId) return cityOptions.find((city) => city.id === aliasId) ?? null;

    const exact = cityOptions.find((city) => citySearchNames(city).includes(query));
    if (exact) return exact;

    const prefix = cityOptions.find((city) => citySearchNames(city).some((name) => name.startsWith(query) || query.startsWith(name)));
    if (prefix) return prefix;

    const ranked = cityOptions
      .map((city) => ({
        city,
        distance: Math.min(...citySearchNames(city).map((name) => levenshteinDistance(query, name)))
      }))
      .sort((left, right) => left.distance - right.distance);
    const best = ranked[0];
    return best && best.distance <= Math.max(2, Math.floor(query.length * 0.34)) ? best.city : null;
  }

  function cityMatchFromPrompt(rawValue: string): CityMapOption | null {
    const query = normalizeCityText(rawValue);
    if (!query) return null;

    const directMatch = bestCityMatch(rawValue);
    if (directMatch) return directMatch;

    const contained = cityOptions
      .map((city) => ({
        city,
        length: Math.max(...citySearchNames(city).map((name) => name.length)),
        hit: citySearchNames(city).some((name) => query.includes(name))
      }))
      .filter((entry) => entry.hit)
      .sort((left, right) => right.length - left.length || left.city.name.localeCompare(right.city.name))[0];
    if (contained) return contained.city;

    const tokens = rawValue.split(/\s+/).filter((token) => normalizeCityText(token).length >= 3);
    for (const token of tokens) {
      const match = bestCityMatch(token);
      if (match) return match;
    }

    return null;
  }

  function setChatCollapsed(collapsed: boolean): void {
    cityChatEl.classList.toggle("collapsed", collapsed);
    cityChatToggle.textContent = collapsed ? "Open" : "Collapse";
    cityChatToggle.setAttribute("aria-expanded", String(!collapsed));
    if (!collapsed) {
      window.setTimeout(() => cityChatInput.focus({ preventScroll: true }), 0);
    }
  }

  function appendChatMessage(role: "user" | "bot", title: string, body: string): void {
    const message = document.createElement("article");
    message.className = `chat-message ${role}`;
    message.innerHTML = `<b>${escapeHtml(title)}</b><p>${body}</p>`;
    cityChatLog.append(message);
    cityChatLog.scrollTop = cityChatLog.scrollHeight;
  }

  function explainCurrentRoute(): string {
    const candidate = routeCandidates()[0];
    if (!candidate) {
      return "I do not have enough route signal yet. Switch a layer on and ask again.";
    }
    return `Best current target is <strong>${escapeHtml(candidate.name)}</strong>: route score ${routeScore(candidate)}, revenue ${formatMoneyPln(candidate.revenueMlnPln)}, debt ${formatMoneyPln(candidate.debtMlnPln)}.`;
  }

  function setChatPosition(left: number, top: number): void {
    const frameRect = mapFrameEl.getBoundingClientRect();
    const chatRect = cityChatEl.getBoundingClientRect();
    const maxLeft = Math.max(8, frameRect.width - chatRect.width - 8);
    const maxTop = Math.max(84, frameRect.height - Math.min(chatRect.height, frameRect.height - 92) - 8);
    cityChatEl.style.left = `${Math.min(maxLeft, Math.max(8, left))}px`;
    cityChatEl.style.top = `${Math.min(maxTop, Math.max(84, top))}px`;
    cityChatEl.style.bottom = "auto";
  }

  let chatDrag: { pointerId: number; offsetX: number; offsetY: number } | null = null;

  function startChatDrag(event: PointerEvent): void {
    if ((event.target as HTMLElement).closest("button")) return;
    const frameRect = mapFrameEl.getBoundingClientRect();
    const chatRect = cityChatEl.getBoundingClientRect();
    chatDrag = {
      pointerId: event.pointerId,
      offsetX: event.clientX - chatRect.left,
      offsetY: event.clientY - chatRect.top
    };
    cityChatEl.classList.add("dragging");
    cityChatHead.setPointerCapture(event.pointerId);
    setChatPosition(chatRect.left - frameRect.left, chatRect.top - frameRect.top);
  }

  function moveChatDrag(event: PointerEvent): void {
    if (!chatDrag || chatDrag.pointerId !== event.pointerId) return;
    const frameRect = mapFrameEl.getBoundingClientRect();
    setChatPosition(event.clientX - frameRect.left - chatDrag.offsetX, event.clientY - frameRect.top - chatDrag.offsetY);
  }

  function endChatDrag(event: PointerEvent): void {
    if (!chatDrag || chatDrag.pointerId !== event.pointerId) return;
    cityChatEl.classList.remove("dragging");
    cityChatHead.releasePointerCapture(event.pointerId);
    chatDrag = null;
  }

  function focusChatCity(rawValue: string): { match: CityMapOption; city: CitySignal; synthetic: boolean } | null {
    const match = cityMatchFromPrompt(rawValue);
    if (!match) {
      cityChatForm.closest(".city-chat")?.classList.remove("locked");
      hintEl.textContent = "City not found in Poland grid";
      return null;
    }

    const knownCity = state.data.cities.find((city) => city.id === match.id);
    const city = citySignalForOption(match);
    state.focusedCityId = null;
    state.selectedZabkaStore = null;
    state.selectedCity = match.id;
    state.selectedRegion = city.regionId;
    setView("city");
    cityChatForm.closest(".city-chat")?.classList.add("locked");
    hintEl.textContent = knownCity ? "Autocomplete corrected; city scene opened" : "Autocomplete corrected; demo city scene opened";
    readoutEl.textContent = `${match.name} opened as City view in ${regionLabels[city.regionId]}. The 12M graph and Zabka layer now follow this city.`;
    return { match, city, synthetic: !knownCity };
  }

  function renderStats(): void {
    const selectedStore = selectedZabkaStoreForCity();
    if (selectedStore) {
      statsEl.innerHTML = [
        ["Store", selectedStore.label],
        ["Revenue", formatMoneyPln(selectedStore.revenueMlnPln)],
        ["Costs", formatMoneyPln(selectedStore.expensesMlnPln)],
        ["Debt", formatMoneyPln(selectedStore.debtMlnPln)],
        ["Margin", formatMoneyPln(selectedStore.marginMlnPln)],
        ["Priority", `${selectedStore.routePriority}%`]
      ].map(([label, value]) => `
        <div class="metric selected-store-metric">
          <b>${label}</b>
          <strong>${value}</strong>
        </div>
      `).join("");
      return;
    }

    const entity = selectedEntity();
    statsEl.innerHTML = [
      ["Area", entity.name],
      ["Revenue", formatMoneyPln(entity.revenueMlnPln)],
      ["Expenses", formatMoneyPln(entity.expensesMlnPln)],
      ["Debt", formatMoneyPln(entity.debtMlnPln)],
      ["Margin", formatMoneyPln(marginMlnPln(entity))]
    ].map(([label, value]) => `
      <div class="metric">
        <b>${label}</b>
        <strong>${value}</strong>
      </div>
    `).join("");
  }

  function monthLabels(): string[] {
    const formatter = new Intl.DateTimeFormat("en-US", { month: "short" });
    const now = new Date();
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
      return formatter.format(date);
    });
  }

  function monthlySeries(entity: RegionSignal | CitySignal): MonthlyPoint[] {
    const labels = monthLabels();
    const random = seededNoise(hashString(`${entity.name}-${state.view}-${state.selectedCity}`));
    const baseRevenue = Math.max(1, entity.revenueMlnPln / 12);
    const baseExpenses = Math.max(1, entity.expensesMlnPln / 12);
    const baseDebt = Math.max(1, entity.debtMlnPln / 12);

    return labels.map((label, index) => {
      const momentum = 0.9 + index * 0.018 + (entity.salesIndex - 64) / 520;
      const seasonal = 1 + Math.sin((index / 11) * Math.PI * 2 + random() * 0.8) * 0.075;
      const shock = 0.93 + random() * 0.16;
      const riskWave = 0.94 + Math.cos((index / 11) * Math.PI * 1.6 + random()) * 0.07;
      return {
        label,
        revenue: Number((baseRevenue * momentum * seasonal * shock).toFixed(1)),
        expenses: Number((baseExpenses * (0.96 + index * 0.006) * (0.94 + random() * 0.14)).toFixed(1)),
        debt: Number((baseDebt * riskWave * (0.96 + entity.debtRisk / 1400)).toFixed(1))
      };
    });
  }

  function chartBarsMarkup(series: MonthlyPoint[], maxValue: number): string {
    const width = 320;
    const top = 18;
    const bottom = 104;
    const monthWidth = width / series.length;
    const barWidth = 5.2;
    const barGap = 1.7;
    const keys = ["revenue", "expenses", "debt"] as const;

    return series.map((point, index) => {
      const groupStart = index * monthWidth + (monthWidth - barWidth * 3 - barGap * 2) / 2;
      return keys.map((key, keyIndex) => {
        const value = point[key];
        const barHeight = Math.max(2, (value / maxValue) * (bottom - top));
        const x = groupStart + keyIndex * (barWidth + barGap);
        const y = bottom - barHeight;
        return `<rect class="chart-bar chart-${key}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth}" height="${barHeight.toFixed(1)}" rx="1.4"></rect>`;
      }).join("");
    }).join(" ");
  }

  function renderMonthlyChart(): void {
    const selectedStore = selectedZabkaStoreForCity();
    const entity = selectedEntity();
    const series = selectedStore ? selectedZabkaMonthlySeries(selectedStore) : monthlySeries(entity);
    const entityName = selectedStore?.name ?? entity.name;
    const maxValue = Math.max(1, ...series.flatMap((point) => [point.revenue, point.expenses, point.debt])) * 1.12;
    const last = series[series.length - 1];
    const first = series[0];
    const revenueDelta = ((last.revenue - first.revenue) / Math.max(1, first.revenue)) * 100;
    const trendClass = revenueDelta >= 0 ? "up" : "down";
    const monthMarks = series.map((point, index) => `
      <span class="${index % 3 === 0 || index === series.length - 1 ? "major" : ""}">${point.label}</span>
    `).join("");

    monthlyChartEl.innerHTML = `
      <div class="monthly-chart-head">
        <div>
          <b>${escapeHtml(entityName)}</b>
          <span>${selectedStore ? "selected Żabka / last 12 months" : "last 12 months"}</span>
        </div>
        <strong class="${trendClass}">${formatTrendPercent(revenueDelta)}</strong>
      </div>
      <svg class="monthly-chart-svg" viewBox="0 0 320 118" role="img" aria-label="12 month bar chart">
        <path class="chart-grid" d="M0 18 H320 M0 47 H320 M0 76 H320 M0 104 H320"></path>
        ${chartBarsMarkup(series, maxValue)}
      </svg>
      <div class="monthly-chart-months">${monthMarks}</div>
      <div class="monthly-chart-legend">
        <span class="revenue">Revenue ${formatMoneyPln(last.revenue)}</span>
        <span class="expenses">Costs ${formatMoneyPln(last.expenses)}</span>
        <span class="debt">Debt ${formatMoneyPln(last.debt)}</span>
      </div>
    `;
  }

  function createZabkaStatuses(city: CitySignal): ZabkaStatus[] {
    const random = seededNoise(hashString(`zabka-status-${city.id}`));
    const labels = ["Core", "North", "South", "East", "West", "Outer", "Station", "Campus", "Office", "Metro", "Ring", "Night"];
    const count = 24;

    return Array.from({ length: count }, (_, index) => {
      const seed = `${city.id}-zabka-status-${index}`;
      const code = visibleCode(seed, 3);
      const zone = labels[index % labels.length];
      const roll = random();
      const status: ZabkaStatus["status"] = roll > 0.78
        ? "Debt"
        : roll > 0.58
          ? "Stock"
          : roll > 0.35
            ? "Visit"
            : "OK";
      const health = Math.max(18, Math.min(99, Math.round(city.trailScore * 0.62 + random() * 42 - (status === "Debt" ? 18 : status === "Stock" ? 10 : 0))));
      const revenueMlnPln = Number(Math.max(0.08, city.revenueMlnPln / 120 + random() * city.revenueMlnPln / 80).toFixed(2));
      const debtMlnPln = Number(Math.max(0.01, city.debtMlnPln / 180 + random() * city.debtMlnPln / 130).toFixed(2));
      const stockPressure = Math.max(8, Math.min(96, Math.round(city.warehouseOverstock * 0.72 + random() * 42)));
      const trendBase = Math.max(0.08, revenueMlnPln / 12);
      const months = Array.from({ length: 12 }, (_, monthIndex) => {
        const ramp = 0.82 + monthIndex * 0.028;
        const wave = 0.9 + Math.sin(monthIndex * 0.8 + random() * 0.8) * 0.11;
        return Number((trendBase * ramp * wave * (0.84 + random() * 0.34)).toFixed(2));
      });

      return {
        id: `${city.id}-zabka-${code}`,
        label: zabkaLoreName(seed, zone),
        status,
        health,
        revenueMlnPln,
        debtMlnPln,
        stockPressure,
        months
      };
    });
  }

  function createSelectedZabkaStore(payload: ZabkaStoreClickPayload): SelectedZabkaStore {
    const city = selectedCitySignal();
    const random = seededNoise(hashString(`${city.id}-${payload.storeId}-${payload.lat.toFixed(5)}-${payload.lng.toFixed(5)}`));
    const statusRoll = payload.score * 0.68 + random() * 0.32;
    const status: ZabkaStatus["status"] = statusRoll > 0.78
      ? "Visit"
      : statusRoll > 0.58
        ? "Stock"
        : statusRoll < 0.24
          ? "Debt"
          : "OK";
    const revenueMlnPln = Number(Math.max(0.14, city.revenueMlnPln / 165 + random() * city.revenueMlnPln / 95).toFixed(2));
    const expensesMlnPln = Number(Math.max(0.08, revenueMlnPln * (0.48 + random() * 0.32)).toFixed(2));
    const debtMlnPln = Number(Math.max(0.01, city.debtMlnPln / 260 + random() * city.debtMlnPln / 150).toFixed(2));
    const stockPressure = Math.max(5, Math.min(98, Math.round(city.warehouseOverstock * 0.58 + payload.score * 35 + random() * 30)));
    const health = Math.max(12, Math.min(99, Math.round(38 + payload.score * 42 + city.trailScore * 0.18 - (status === "Debt" ? 18 : 0) + random() * 16)));
    const routePriority = Math.max(8, Math.min(99, Math.round(payload.score * 46 + city.eventForecast * 0.24 + city.debtRisk * 0.18 + stockPressure * 0.12)));
    const trendBase = Math.max(0.04, revenueMlnPln / 12);
    const months = Array.from({ length: 12 }, (_, monthIndex) => {
      const ramp = 0.78 + monthIndex * 0.035;
      const weekendWave = 0.9 + Math.sin(monthIndex * 0.76 + random() * 1.3) * 0.13;
      const activation = status === "Visit" ? 1.12 : status === "Debt" ? 0.82 : status === "Stock" ? 0.94 : 1;
      return Number((trendBase * ramp * weekendWave * activation * (0.86 + random() * 0.3)).toFixed(2));
    });

    return {
      id: payload.storeId,
      name: payload.label,
      label: payload.label,
      cityId: city.id,
      lat: payload.lat,
      lng: payload.lng,
      score: payload.score,
      status,
      health,
      revenueMlnPln,
      expensesMlnPln,
      debtMlnPln,
      marginMlnPln: Number((revenueMlnPln - expensesMlnPln - debtMlnPln * 0.08).toFixed(2)),
      stockPressure,
      routePriority,
      months
    };
  }

  function selectedZabkaStoreForCity(): SelectedZabkaStore | null {
    if (state.view !== "city") return null;
    return state.selectedZabkaStore?.cityId === selectedCitySignal().id ? state.selectedZabkaStore : null;
  }

  function selectedZabkaMonthlySeries(store: SelectedZabkaStore): MonthlyPoint[] {
    const labels = monthLabels();
    return labels.map((label, index) => {
      const revenue = store.months[index] ?? store.revenueMlnPln / 12;
      const expenses = Number((revenue * Math.max(0.42, store.expensesMlnPln / Math.max(0.01, store.revenueMlnPln))).toFixed(2));
      const debt = Number((store.debtMlnPln / 12 * (0.84 + index * 0.018 + store.stockPressure / 950)).toFixed(2));
      return { label, revenue, expenses, debt };
    });
  }

  function createRestaurantStatuses(city: CitySignal, center?: L.LatLng, clipPolygons: L.LatLngExpression[][] = []): RestaurantStatus[] {
    const random = seededNoise(hashString(`restaurant-status-${city.id}`));
    const labels = ["Old Town", "Station", "Arena", "Campus", "Market", "Hotel", "River", "Night", "Office", "Mall", "South", "North"];
    const count = 18;

    function nextOffset(): { northKm: number; eastKm: number } {
      const angle = random() * Math.PI * 2;
      const radiusKm = 1.8 + random() * Math.min(11.5, Math.max(4.2, Math.sqrt(city.population) * 0.006));
      return {
        northKm: Math.sin(angle) * radiusKm,
        eastKm: Math.cos(angle) * radiusKm
      };
    }

    function boundedOffset(index: number): { northKm: number; eastKm: number } {
      if (!center || clipPolygons.length === 0) return nextOffset();

      for (let attempt = 0; attempt < 48; attempt += 1) {
        const offset = nextOffset();
        if (isLatLngInsideAllPolygons(offsetLatLng(center, offset.northKm, offset.eastKm), clipPolygons)) return offset;
      }

      return {
        northKm: Math.sin(index * 1.91) * 0.42,
        eastKm: Math.cos(index * 1.91) * 0.42
      };
    }

    return Array.from({ length: count }, (_, index) => {
      const code = visibleCode(`${city.id}-restaurant-status-${index}`, 3);
      const { northKm, eastKm } = boundedOffset(index);
      const roll = random();
      const status: RestaurantStatus["status"] = roll > 0.78
        ? "Peak"
        : roll > 0.56
          ? "Visit"
          : roll > 0.36
            ? "Risk"
            : "OK";
      const health = Math.max(16, Math.min(99, Math.round(city.eventForecast * 0.42 + city.trailScore * 0.38 + random() * 34 - (status === "Risk" ? 18 : 0))));
      const revenueMlnPln = Number(Math.max(0.06, city.revenueMlnPln / 190 + random() * city.revenueMlnPln / 115).toFixed(2));
      const eventLift = Math.max(8, Math.min(98, Math.round(city.eventForecast * 0.68 + random() * 34)));
      const stockNeed = Math.max(6, Math.min(94, Math.round(city.warehouseOverstock * 0.54 + random() * 48)));
      const trendBase = Math.max(0.05, revenueMlnPln / 12);
      const months = Array.from({ length: 12 }, (_, monthIndex) => {
        const weekendWave = 0.92 + Math.sin(monthIndex * 0.72 + random() * 1.2) * 0.16;
        const eventPulse = status === "Peak" ? 1.12 : status === "Visit" ? 1.04 : status === "Risk" ? 0.9 : 0.98;
        return Number((trendBase * weekendWave * eventPulse * (0.82 + random() * 0.4)).toFixed(2));
      });

      return {
        id: `${city.id}-restaurant-${code}`,
        label: `R-${code} ${labels[index % labels.length]}`,
        status,
        health,
        revenueMlnPln,
        eventLift,
        stockNeed,
        northKm,
        eastKm,
        months
      };
    });
  }

  function miniBarMarkup(values: number[]): string {
    const maxValue = Math.max(0.01, ...values);
    return values.map((value) => {
      const height = Math.max(12, Math.round((value / maxValue) * 100));
      return `<span style="height: ${height}%"></span>`;
    }).join("");
  }

  function renderZabkaStatus(): void {
    if (state.view !== "city") {
      zabkaStatusEl.innerHTML = `
        <div class="zabka-status-empty">Open a city to inspect Żabka status cards.</div>
      `;
      return;
    }

    const city = selectedCitySignal();
    const selectedStore = selectedZabkaStoreForCity();
    const statuses = selectedStore
      ? [selectedStore, ...createZabkaStatuses(city).filter((status) => status.id !== selectedStore.id).slice(0, 11)]
      : createZabkaStatuses(city);
    zabkaStatusEl.innerHTML = statuses.map((status) => `
      <article class="zabka-status-card status-${status.status.toLowerCase()} ${selectedStore?.id === status.id ? "selected-store" : ""}">
        <div class="zabka-status-head">
          <b>${escapeHtml(status.label)}</b>
          <strong>${selectedStore?.id === status.id ? "Selected" : status.status}</strong>
        </div>
        <div class="zabka-status-bars" aria-label="12 month Żabka revenue bars">
          ${miniBarMarkup(status.months)}
        </div>
        <div class="zabka-status-meta">
          <span><b>${status.health}%</b> health</span>
          <span><b>${formatMoneyPln(status.revenueMlnPln)}</b> rev</span>
          <span><b>${formatMoneyPln(status.debtMlnPln)}</b> debt</span>
          <span><b>${selectedStore?.id === status.id ? `${selectedStore.routePriority}%` : `${status.stockPressure}%`}</b> ${selectedStore?.id === status.id ? "route" : "stock"}</span>
        </div>
      </article>
    `).join("");
  }

  function renderRestaurantStatus(): void {
    if (state.view !== "city") {
      restaurantStatusEl.innerHTML = `
        <div class="restaurant-status-empty">Open a city to inspect restaurant cards.</div>
      `;
      return;
    }

    const city = selectedCitySignal();
    const option = cityOptionById(city.id);
    const center = L.latLng(option.latLng);
    const statuses = createRestaurantStatuses(city, center, [
      createCityContour(center, option.id, city.population / 1000),
      ...polandStarClipPolygons
    ]);
    restaurantStatusEl.innerHTML = statuses.map((status) => `
      <article class="restaurant-status-card restaurant-${status.status.toLowerCase()}">
        <div class="restaurant-status-head">
          <b>${escapeHtml(status.label)}</b>
          <strong>${status.status}</strong>
        </div>
        <div class="restaurant-status-bars" aria-label="12 month restaurant revenue bars">
          ${miniBarMarkup(status.months)}
        </div>
        <div class="restaurant-status-meta">
          <span><b>${status.health}%</b> health</span>
          <span><b>${formatMoneyPln(status.revenueMlnPln)}</b> rev</span>
          <span><b>${status.eventLift}%</b> event</span>
          <span><b>${status.stockNeed}%</b> stock</span>
        </div>
      </article>
    `).join("");
  }

  function renderLegend(): void {
    const entity = selectedEntity();
    legendEl.innerHTML = Object.entries(metricMap).map(([layer, metric]) => {
      const raw = entity[metric] as number;
      const score = metricScore(metric, raw);
      const value = metricValue(entity, metric);
      return `
        <div class="legend-row">
          <span>${layerNames[layer as LayerId]}</span>
          <span class="bar"><span style="width: ${score}%; color: ${scoreColor(score)};"></span></span>
          <b>${value}</b>
        </div>
      `;
    }).join("");
  }

  function routeScore(entity: RegionSignal | CitySignal): number {
    return Math.round(
      entity.salesIndex * 0.4 +
      entity.eventForecast * 0.3 +
      entity.debtRisk * 0.18 +
      entity.warehouseOverstock * 0.12
    );
  }

  function damageScore(entity: RegionSignal | CitySignal): number {
    const margin = Math.max(0, marginMlnPln(entity));
    const debtPressure = Math.min(100, entity.debtRisk + entity.debtMlnPln / 28);
    const stockPressure = Math.min(100, entity.warehouseOverstock * 1.15);
    const lostMomentum = Math.max(0, 100 - entity.salesIndex);
    const marginShield = Math.max(0, 100 - margin / 6);
    return Math.min(99, Math.round(debtPressure * 0.34 + stockPressure * 0.24 + lostMomentum * 0.2 + marginShield * 0.22));
  }

  function damageState(score: number): "Critical" | "Severe" | "Contained" {
    if (score >= 74) return "Critical";
    if (score >= 52) return "Severe";
    return "Contained";
  }

  function renderDamagePanel(): void {
    const entity = selectedEntity();
    const damage = damageScore(entity);
    const revenueAtRisk = Math.max(0, entity.expensesMlnPln * 0.18 + entity.debtMlnPln * 0.08 - marginMlnPln(entity) * 0.04);
    const actionWindow = damage >= 74 ? "24h" : damage >= 52 ? "72h" : "7d";
    damageEl.innerHTML = `
      <div class="damage-head ${damage >= 74 ? "critical" : ""}">
        <strong>${damageState(damage)}</strong>
        <span>${damage}% damage risk</span>
      </div>
      <div class="damage-grid">
        <div><b>${formatMoneyPln(revenueAtRisk)}</b><span>revenue at risk</span></div>
        <div><b>${formatMoneyPln(entity.debtMlnPln)}</b><span>debt exposure</span></div>
        <div><b>${entity.warehouseOverstock}%</b><span>stock pressure</span></div>
        <div><b>${actionWindow}</b><span>action window</span></div>
      </div>
    `;
  }

  function routeCandidates(): Array<RegionSignal | CitySignal> {
    if (state.view === "poland") return [...state.data.regions].sort((a, b) => routeScore(b) - routeScore(a)).slice(0, 3);
    if (state.view === "city") {
      const selected = selectedCitySignal();
      const rest = state.data.cities
        .filter((city) => city.id !== selected.id)
        .sort((a, b) => routeScore(b) - routeScore(a))
        .slice(0, 2);
      return [selected, ...rest];
    }
    const regionCities = state.data.cities
      .filter((city) => city.regionId === state.selectedRegion)
      .sort((a, b) => routeScore(b) - routeScore(a))
      .slice(0, 3);
    if (regionCities.length > 0) return regionCities;
    return [selectedCitySignal()];
  }

  function routeVerdict(index: number, entity: RegionSignal | CitySignal): "Visit first" | "Visit next" | "Monitor" | "Skip" {
    if (index === 0) return "Visit first";
    if (routeScore(entity) >= 74) return "Visit next";
    if (routeScore(entity) >= 58) return "Monitor";
    return "Skip";
  }

  function renderSalesRoute(): void {
    const candidates = routeCandidates();
    salesRouteEl.innerHTML = candidates.map((entity, index) => {
      const score = routeScore(entity);
      const margin = marginMlnPln(entity);
      const verdict = routeVerdict(index, entity);
      return `
        <article class="route-card ${verdict === "Skip" ? "skip" : ""}">
          <strong>${verdict}</strong>
          <div>
            <b>${entity.name}</b>
            <span>Sales ${entity.salesIndex} / events ${entity.eventForecast} / debt ${entity.debtRisk}</span>
          </div>
          <small>${score} route score · margin ${formatMoneyPln(margin)}</small>
        </article>
      `;
    }).join("");
  }

  function eventsLayerActive(): boolean {
    return layerInputs.some((input) => input.dataset.layer === "events" && input.checked);
  }

  function eventFeaturesForScene(): Feature<Point, EventProperties>[] {
    if (state.view === "city") return selectedCityEvents();
    if (state.view === "region") return regionEventPointFeatures.features;
    return eventPointFeatures.features;
  }

  function formatRadius(meters: number): string {
    return meters >= 1000 ? `${Math.round(meters / 1000)} km` : `${meters} m`;
  }

  function renderDetails(): void {
    if (!eventsLayerActive()) {
      detailsEl.innerHTML = `
        <div class="detail-empty">
          Switch on Events to reveal event names, timing, and field detail for this map.
        </div>
      `;
      return;
    }

    detailsEl.innerHTML = eventFeaturesForScene().map((event) => `
      <article class="event-detail">
        <div>
          <b>${event.properties.name}</b>
          <span>${event.properties.window}</span>
        </div>
        <p>${event.properties.detail}</p>
        <small>${event.properties.score}% signal / radius ${formatRadius(event.properties.radiusMeters)}</small>
      </article>
    `).join("");
  }

  function renderAiDefault(): void {
    const rec = state.data.aiRecommendations[0];
    aiPromptEl.innerHTML = `<b>Sales target: ${rec.label}</b><br>${rec.reason}<br><br>${(rec.confidence * 100).toFixed(0)}% confidence. ${rec.recommendedAction}`;
  }

  function removeLegacyStarCanvases(): void {
    document.querySelectorAll(".zabka-star-canvas").forEach((element) => element.remove());
  }

  function removeCityRetailLayer(): void {
    mapFrameEl.classList.remove("city-retail-visible");
    if (cityRetailLayer && map.hasLayer(cityRetailLayer)) map.removeLayer(cityRetailLayer);
    cityRetailLayer = null;
    cityRetailLayerId = null;
    removeLegacyStarCanvases();
  }

  function removeRuntimeGroups(groups: RuntimeLayerGroups): void {
    Object.values(groups).forEach((group) => {
      if (map.hasLayer(group)) map.removeLayer(group);
    });
  }

  function clearRuntimeGroups(groups: RuntimeLayerGroups): void {
    Object.values(groups).forEach((group) => group.clearLayers());
  }

  function offsetLatLng(center: L.LatLng, northKm: number, eastKm: number): L.LatLngExpression {
    const lat = center.lat + northKm / 111;
    const lng = center.lng + eastKm / (111 * Math.max(0.22, Math.cos(center.lat * Math.PI / 180)));
    return [lat, lng];
  }

  function selectedCityContour(): L.LatLngExpression[] {
    const option = cityOptionById(state.selectedCity);
    const city = citySignalForOption(option);
    return createCityContour(L.latLng(option.latLng), option.id, city.population / 1000);
  }

  function selectedCityClipPolygons(): L.LatLngExpression[][] {
    return [selectedCityContour(), ...polandStarClipPolygons];
  }

  function selectedCityBounds(): L.LatLngBounds {
    return L.latLngBounds(selectedCityContour()).pad(0.34);
  }

  function cityEventFeature(id: string, name: string, window: string, detail: string, radiusMeters: number, score: number, latLng: L.LatLngExpression): Feature<Point, EventProperties> {
    const point = L.latLng(latLng);
    return {
      type: "Feature",
      properties: { id, name, window, detail, radiusMeters, score },
      geometry: {
        type: "Point",
        coordinates: [point.lng, point.lat]
      }
    };
  }

  function selectedCityEvents(): Feature<Point, EventProperties>[] {
    const option = cityOptionById(state.selectedCity);
    const city = citySignalForOption(option);
    const center = L.latLng(option.latLng);
    const radius = Math.round(Math.min(17000, Math.max(5600, Math.sqrt(city.population) * 7.2)));
    return [
      cityEventFeature(
        `${city.id}-events-core`,
        `${city.name} demand window`,
        "This month / week 2",
        `Sales should cover the strongest Żabka cluster before the next promo wave. Revenue ${formatMoneyPln(city.revenueMlnPln)}, debt ${formatMoneyPln(city.debtMlnPln)}.`,
        radius,
        city.eventForecast,
        offsetLatLng(center, 0.1, 0.2)
      ),
      cityEventFeature(
        `${city.id}-events-south`,
        `${city.name} evening route`,
        "This month / week 3",
        "Evening footfall cluster: field sales should combine shelf check, cold-chain check, and overdue account review.",
        Math.round(radius * 0.72),
        Math.max(42, city.eventForecast - 12),
        offsetLatLng(center, -4.4, 2.8)
      ),
      cityEventFeature(
        `${city.id}-events-outer`,
        `${city.name} outer sweep`,
        "This month / week 4",
        "Lower certainty but useful route while the team is already in-market.",
        Math.round(radius * 0.62),
        Math.max(34, city.eventForecast - 21),
        offsetLatLng(center, 4.2, -3.6)
      )
    ];
  }

  function addDynamicSignalCircle(
    group: L.LayerGroup,
    center: L.LatLng,
    northKm: number,
    eastKm: number,
    radiusMeters: number,
    fillColor: string,
    className: string,
    opacity = 0.22
  ): void {
    const patchCenter = L.latLng(offsetLatLng(center, northKm, eastKm));
    const radiusKm = radiusMeters / 1000;
    const contourPopulation = Math.max(40, Math.pow(radiusKm / 0.28, 2));
    const patchContour = createCityContour(patchCenter, `${className}-${northKm}-${eastKm}`, contourPopulation);
    L.polygon(patchContour, {
      color: "transparent",
      weight: 0,
      fill: true,
      fillColor,
      fillOpacity: opacity,
      className,
      interactive: false
    }).addTo(group);
  }

  function addDynamicEvents(group: L.LayerGroup): void {
    const clipPolygons = selectedCityClipPolygons();
    selectedCityEvents().forEach((event) => {
      const [lng, lat] = event.geometry.coordinates;
      const latLng = L.latLng(lat, lng);
      if (!isLatLngInsideAllPolygons(latLng, clipPolygons)) return;
      L.marker(latLng, {
        interactive: false,
        pane: "markerPane",
        icon: L.divIcon({
          className: "event-star-icon",
          html: `<span class="event-star" aria-hidden="true"></span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        })
      }).addTo(group);
      L.marker(latLng, {
        interactive: false,
        icon: L.divIcon({
          className: "event-label",
          html: event.properties.name,
          iconSize: [150, 24],
          iconAnchor: [-10, 24]
        })
      }).addTo(group);
    });
  }

  function addRestaurantMarkers(city: CitySignal, center: L.LatLng, contour: L.LatLngExpression[]): void {
    createRestaurantStatuses(city, center, [contour, ...polandStarClipPolygons]).forEach((restaurant) => {
      L.marker(offsetLatLng(center, restaurant.northKm, restaurant.eastKm), {
        interactive: false,
        pane: "markerPane",
        icon: L.divIcon({
          className: `restaurant-marker restaurant-marker-${restaurant.status.toLowerCase()}`,
          html: `<span class="restaurant-star" aria-hidden="true"></span><b>R</b>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
      }).addTo(selectedCityBase);
    });
  }

  function rebuildSelectedCityScene(): void {
    const option = cityOptionById(state.selectedCity);
    const city = citySignalForOption(option);
    const center = L.latLng(option.latLng);
    const contour = createCityContour(center, option.id, city.population / 1000);
    const radiusMeters = Math.min(26000, Math.max(9000, Math.sqrt(city.population) * 12));
    const selectedCityRouteStyle: L.PathOptions = {
      color: "rgba(239, 255, 86, 0.52)",
      weight: 2.5,
      opacity: 1,
      className: "city-route"
    };
    const selectedCityRiverStyle: L.PathOptions = {
      color: "rgba(47, 255, 255, 0.42)",
      weight: 5,
      opacity: 1,
      className: "city-river"
    };
    const selectedCityDistrictStyle: L.PathOptions = {
      color: "rgba(47, 255, 255, 0.68)",
      weight: 1.4,
      opacity: 1,
      dashArray: "4 8",
      className: "district-line"
    };

    selectedCityBase.clearLayers();
    clearRuntimeGroups(selectedCityGroups);

    L.polygon(contour, {
      className: "city-boundary selected-city-boundary",
      color: "rgba(47, 255, 255, 0.92)",
      weight: 2.2,
      opacity: 1,
      fill: true,
      fillColor: "rgba(87, 255, 61, 0.06)",
      fillOpacity: 0.46,
      dashArray: "6 8",
      interactive: false
    }).addTo(selectedCityBase);

    L.polyline([
      offsetLatLng(center, -9, -5.6),
      offsetLatLng(center, -4.2, -1.4),
      offsetLatLng(center, 0.4, 0.1),
      offsetLatLng(center, 4.6, 1.2),
      offsetLatLng(center, 8.4, 4.2)
    ], selectedCityRouteStyle).addTo(selectedCityBase);

    L.polyline([
      offsetLatLng(center, 7.4, -6.2),
      offsetLatLng(center, 2.2, -2.5),
      offsetLatLng(center, -1.8, 2.4),
      offsetLatLng(center, -7.2, 5.4)
    ], selectedCityRiverStyle).addTo(selectedCityBase);

    L.polyline([offsetLatLng(center, 0, -9.2), offsetLatLng(center, 0.2, 9.2)], selectedCityDistrictStyle).addTo(selectedCityBase);
    L.polyline([offsetLatLng(center, -7.2, 0.6), offsetLatLng(center, 7.2, -0.4)], selectedCityDistrictStyle).addTo(selectedCityBase);

    L.marker(center, {
      interactive: false,
      icon: L.divIcon({
        className: "chat-city-lock-label selected-city-label",
        html: `<b>${city.name}</b><span>${regionLabels[city.regionId]}</span>`,
        iconSize: [150, 34],
        iconAnchor: [22, 42]
      })
    }).addTo(selectedCityBase);
    addRestaurantMarkers(city, center, contour);

    addDynamicSignalCircle(selectedCityGroups.revenue, center, 0.2, -0.2, radiusMeters * 0.82, "rgba(87, 255, 61, 0.28)", "revenue-region", 0.2);
    addDynamicSignalCircle(selectedCityGroups.revenue, center, -4.6, 3.2, radiusMeters * 0.54, "rgba(183, 255, 45, 0.22)", "revenue-region", 0.17);
    addDynamicSignalCircle(selectedCityGroups.expenses, center, 3.6, -4.4, radiusMeters * 0.58, "rgba(255, 104, 35, 0.22)", "expenses-region", 0.18);
    addDynamicSignalCircle(selectedCityGroups.expenses, center, -5.4, 2.4, radiusMeters * 0.44, "rgba(255, 174, 52, 0.18)", "expenses-region", 0.15);
    addDynamicSignalCircle(selectedCityGroups.debt, center, 2.8, 4.7, radiusMeters * 0.62, "rgba(255, 35, 77, 0.22)", "debt-region", 0.18);
    addDynamicSignalCircle(selectedCityGroups.stock, center, -3.4, -3.4, radiusMeters * 0.48, "rgba(210, 255, 68, 0.18)", "stock-region", 0.14);
    addDynamicSignalCircle(selectedCityGroups.ai, center, 1.6, 2.4, radiusMeters * 0.68, "rgba(255, 35, 77, 0.16)", "priority-region", 0.14);
    addDynamicEvents(selectedCityGroups.events);

    addDynamicSignalCircle(selectedCityGroups.ai, center, -2.6, -2.2, radiusMeters * 0.46, "rgba(87, 255, 61, 0.12)", "revenue-region", 0.12);
  }

  function applyLayers(): void {
    const sceneGroups = state.view === "city" ? selectedCityGroups : layers.scenes[state.view].groups;
    layerInputs.forEach((input) => {
      const group = sceneGroups[input.dataset.layer as LayerId];
      if (input.checked && !map.hasLayer(group)) map.addLayer(group);
      if (!input.checked && map.hasLayer(group)) map.removeLayer(group);
    });

    const active = layerInputs.filter((input) => input.checked).map((input) => layerNames[input.dataset.layer as LayerId]);
    const sceneNote = state.view === "poland"
      ? "M40 sales auspex: smooth country heat, toxic green sales maxima, red weak-sales fields."
      : state.view === "city"
        ? `${cityZabkaPointCount} sampled Zabka stars plus branded coverage hubs are live on the city scene.`
        : "Major city star nodes stay inside Poland; Zabka coverage is reserved for the city map.";
    readoutEl.textContent = `${active.join(" / ")} active on ${state.view.toUpperCase()} map. ${sceneNote}`;
    renderDetails();
  }

  function syncCityRetailLayer(): void {
    removeLegacyStarCanvases();
    mapFrameEl.classList.remove("city-retail-visible");
    if (state.view === "city") {
      if (map.getZoom() < cityRetailMinZoom) {
        if (cityRetailLayer && map.hasLayer(cityRetailLayer)) map.removeLayer(cityRetailLayer);
        return;
      }
      const city = selectedCitySignal();
      const option = cityOptionById(city.id);
      if (!cityRetailLayer || cityRetailLayerId !== city.id) {
        if (cityRetailLayer && map.hasLayer(cityRetailLayer)) map.removeLayer(cityRetailLayer);
        cityRetailLayer = createZabkaLayer(map, cityZabkaPointCount, "city", {
          center: option.latLng,
          cityId: city.id,
          populationK: city.population / 1000,
          clipPolygons: selectedCityClipPolygons()
        });
        cityRetailLayerId = city.id;
      }
      if (cityRetailLayer && !map.hasLayer(cityRetailLayer)) map.addLayer(cityRetailLayer);
      if (cityRetailLayer && map.hasLayer(cityRetailLayer)) mapFrameEl.classList.add("city-retail-visible");
      return;
    }
    removeCityRetailLayer();
  }

  function removeScene(view: MapScene): void {
    if (view === "city") {
      if (map.hasLayer(selectedCityBase)) map.removeLayer(selectedCityBase);
      removeRuntimeGroups(selectedCityGroups);
      removeCityRetailLayer();
    }
    const scene = layers.scenes[view];
    if (map.hasLayer(scene.base)) map.removeLayer(scene.base);
    Object.values(scene.groups).forEach((group) => {
      if (map.hasLayer(group)) map.removeLayer(group);
    });
  }

  function activateScene(view: MapScene): void {
    sceneOrder.forEach((scene) => {
      if (scene !== view) removeScene(scene);
    });
    if (view === "city") {
      if (!map.hasLayer(selectedCityBase)) map.addLayer(selectedCityBase);
      activeScene = view;
      return;
    }
    const nextScene = layers.scenes[view];
    if (!map.hasLayer(nextScene.base)) map.addLayer(nextScene.base);
    activeScene = view;
  }

  function setView(view: MapScene): void {
    state.focusedCityId = null;
    chatContourLayer.clearLayers();
    state.view = view;
    if (view !== "city") {
      state.selectedZabkaStore = null;
    } else if (state.selectedZabkaStore?.cityId !== selectedCitySignal().id) {
      state.selectedZabkaStore = null;
    }
    navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    const hadScene = activeScene !== null;
    if (view === "city") {
      state.selectedCity = state.selectedCity || "warsaw";
      state.selectedRegion = selectedCitySignal().regionId;
      rebuildSelectedCityScene();
    }
    activateScene(view);

    if (view === "poland") {
      map.flyToBounds(layers.scenes.poland.bounds, { duration: hadScene ? 0.55 : 0, padding: [12, 12] });
      breadcrumbEl.textContent = "Strategic / Poland";
      hintEl.textContent = "M40 country sales auspex";
    }

    if (view === "region") {
      const regionName = regionLabels[state.selectedRegion];
      const regionBounds = state.selectedRegion === "mazowieckie"
        ? layers.scenes.region.bounds
        : selectedCityBounds().pad(2.6);
      map.flyToBounds(regionBounds, { duration: 0.55, padding: [22, 22] });
      breadcrumbEl.textContent = `Operational / ${regionName}`;
      hintEl.textContent = `${regionName} selected from city`;
    }

    if (view === "city") {
      const city = selectedCitySignal();
      map.flyToBounds(selectedCityBounds(), {
        duration: 0.55,
        paddingTopLeft: [24, 96],
        paddingBottomRight: [360, 42]
      });
      breadcrumbEl.textContent = `Retail / ${city.name}`;
      hintEl.textContent = `${regionLabels[city.regionId]} city heat with Zabka stores`;
    }

    syncCityRetailLayer();
    renderStats();
    renderMonthlyChart();
    renderZabkaStatus();
    renderRestaurantStatus();
    renderLegend();
    renderSalesRoute();
    renderDamagePanel();
    applyLayers();
  }

  function focusPriorityRegion(region: PriorityRegion): void {
    state.focusedCityId = null;
    state.selectedZabkaStore = null;
    chatContourLayer.clearLayers();
    state.view = "region";
    state.selectedRegion = region.id;
    navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === "region"));
    activateScene("region");
    map.flyToBounds(layers.scenes.region.bounds, { duration: 0.55, padding: [22, 22] });
    syncCityRetailLayer();
    breadcrumbEl.textContent = `Operational / ${region.label}`;
    hintEl.textContent = "Sales target scan is running";

    const aiToggle = document.querySelector<HTMLInputElement>("[data-layer='ai']")!;
    aiToggle.checked = true;
    const scenePriorityLayer = layers.scenes.region.priorityLayer;
    scenePriorityLayer.clearLayers();
    scenePriorityLayer.addData(getPriorityFeature(state.priorityIndex, "region"));
    scenePriorityLayer.bringToFront();

    const entity = selectedEntity();
    aiPromptEl.innerHTML = `<b>Sales target: ${region.label}</b><br>${region.reason}<br><br>Revenue ${formatMoneyPln(entity.revenueMlnPln)}, expenses ${formatMoneyPln(entity.expensesMlnPln)}, debt ${formatMoneyPln(entity.debtMlnPln)}, margin ${formatMoneyPln(marginMlnPln(entity))}.`;
    renderStats();
    renderMonthlyChart();
    renderZabkaStatus();
    renderRestaurantStatus();
    renderLegend();
    renderSalesRoute();
    renderDamagePanel();
    applyLayers();
    readoutEl.textContent = `Sales route moved to ${region.label}. Click again to scan the next field visit target.`;
  }

  navButtons.forEach((button) => button.addEventListener("click", () => setView(button.dataset.view as MapScene)));
  map.on("zoomstart movestart", () => {
    removeLegacyStarCanvases();
  });
  map.on("zoomend moveend viewreset", syncCityRetailLayer);
  cityChatToggle.addEventListener("click", () => {
    setChatCollapsed(!cityChatEl.classList.contains("collapsed"));
  });
  cityChatHead.addEventListener("pointerdown", startChatDrag);
  cityChatHead.addEventListener("pointermove", moveChatDrag);
  cityChatHead.addEventListener("pointerup", endChatDrag);
  cityChatHead.addEventListener("pointercancel", endChatDrag);
  cityChatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const prompt = cityChatInput.value.trim();
    if (!prompt) return;
    setChatCollapsed(false);
    appendChatMessage("user", "You", escapeHtml(prompt));
    cityChatInput.value = "";

    const focused = focusChatCity(prompt);
    if (focused) {
      const city = focused.city;
      const recommendation = routeVerdict(0, city).toLowerCase();
      appendChatMessage(
        "bot",
        "AI",
        `Opened <strong>${escapeHtml(focused.match.name)}</strong> as City view. ${recommendation}: revenue ${formatMoneyPln(city.revenueMlnPln)}, debt ${formatMoneyPln(city.debtMlnPln)}, margin ${formatMoneyPln(marginMlnPln(city))}. ${focused.synthetic ? "Demo metrics generated from population and region." : "JSON metrics loaded."}`
      );
      return;
    }

    appendChatMessage("bot", "AI", `${explainCurrentRoute()} Ask with a city name when you want me to draw a specific contour.`);
  });
  layerInputs.forEach((input) => input.addEventListener("change", applyLayers));
  document.querySelector<HTMLButtonElement>("#zoomIn")!.addEventListener("click", () => map.zoomIn(0.35));
  document.querySelector<HTMLButtonElement>("#zoomOut")!.addEventListener("click", () => map.zoomOut(0.35));
  document.querySelector<HTMLButtonElement>("#runAi")!.addEventListener("click", () => {
    state.priorityIndex = (state.priorityIndex + 1) % tacticalEdicts.length;
    focusPriorityRegion(tacticalEdicts[state.priorityIndex]);
  });

  map.on("business-city-click", (event) => {
    state.focusedCityId = null;
    state.selectedZabkaStore = null;
    chatContourLayer.clearLayers();
    const payload = event as L.LeafletEvent & BusinessCityClickPayload;
    const option = ensureCityOptionFromClick(payload);
    if (!option) return;
    const city = citySignalForOption(option);
    state.selectedCity = option.id;
    state.selectedRegion = city.regionId;
    setView("city");
  });

  map.on("zabka-store-click", (event) => {
    if (state.view !== "city") return;
    const payload = event as L.LeafletEvent & ZabkaStoreClickPayload;
    state.selectedZabkaStore = createSelectedZabkaStore(payload);
    renderStats();
    renderMonthlyChart();
    renderZabkaStatus();
    renderDamagePanel();
    renderLegend();
    readoutEl.textContent = `${payload.label} selected. Store-level revenue, costs, debt, route priority, and 12M bars are now live.`;
  });

  renderAiDefault();
  removeLegacyStarCanvases();
  setView("poland");
}

async function main(): Promise<void> {
  renderShell();
  const data = await loadDemoData();
  const map = initMap();
  const layers = createBusinessMap(map);
  bootInteractions(map, layers, data);
}

void main();
