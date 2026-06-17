import L, { type LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import { createBusinessMap, getPriorityFeature, type BusinessMapLayers, type MapScene } from "./businessMap";
import { loadDemoData } from "./data";
import {
  cityEventPointFeatures,
  eventPointFeatures,
  regionEventPointFeatures,
  type EventProperties
} from "./geoData";
import { createZabkaLayer } from "./zabkaLayer";
import type { Feature, Point } from "geojson";
import type { CitySignal, DemoData, LayerId, PriorityRegion, RegionId, RegionSignal } from "./types";

type MapGeneral = "silver" | "desperados" | "zywiec";

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

const generalProfiles: Record<MapGeneral, GeneralProfile> = {
  silver: {
    label: "Gen. Silver",
    view: "poland",
    layers: ["revenue", "events", "debt", "ai"],
    prompt: "Balanced sales command: protect revenue, watch debt, keep the national route map visible.",
    readout: "Gen. Silver active: balanced Poland command. Revenue, events, debt, and AI priority stay visible."
  },
  desperados: {
    label: "Gen. Desperados",
    view: "region",
    layers: ["expenses", "debt", "stock", "ai"],
    edict: 1,
    prompt: "Desperados assault command: debt, cost burn, and warehouse pressure become the battlefield.",
    readout: "Gen. Desperados active: region assault mode. Debt, costs, stock pressure, and AI target polygon are hot."
  },
  zywiec: {
    label: "Gen. Zywiec",
    view: "city",
    layers: ["revenue", "events", "stock", "ai"],
    edict: 0,
    prompt: "Zywiec freshness command: city demand, events, and Zabka coverage become the route engine.",
    readout: "Gen. Zywiec active: city freshness mode. Revenue, events, stock, and Zabka coverage lead the visit plan."
  }
};

interface AppState {
  view: MapScene;
  selectedGeneral: MapGeneral;
  selectedRegion: RegionId;
  selectedCity: string;
  focusedCityId: string | null;
  priorityIndex: number;
  data: DemoData;
}

interface CityMapOption {
  id: string;
  name: string;
  latLng: L.LatLngExpression;
  populationK?: number;
}

interface GeneralProfile {
  label: string;
  view: MapScene;
  layers: LayerId[];
  edict?: number;
  prompt: string;
  readout: string;
}

function renderShell(): void {
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
    <div class="infinity-stars" aria-hidden="true"></div>
    <div class="screen-fire" aria-hidden="true">
      <i></i><i></i><i></i><i></i><span></span>
    </div>
    <main class="map-frame">
      <div class="imperial-decree" aria-hidden="true">
        <strong>FIELD SALES MANDATE</strong>
        <span>M40.000 / POLAND FRONT</span>
      </div>
      <div class="imperial-mark" aria-hidden="true">
        <span></span>
      </div>
      <div class="death-seal map-death" aria-hidden="true">
        <i></i><span></span><b></b>
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
      <section class="city-chat" aria-label="City command chat">
        <div class="city-chat-head">
          <b>LEFT CHAT</b>
          <span>CITY LOCK</span>
        </div>
        <div class="city-chat-log" id="cityChatLog">
          <b>Command:</b> Warsaw
        </div>
        <form class="city-chat-form" id="cityChatForm">
          <input id="cityChatInput" list="cityChatDatalist" autocomplete="off" spellcheck="false" placeholder="Warsaw / Krakow / Lodz">
          <datalist id="cityChatDatalist"></datalist>
          <button type="submit">Open</button>
        </form>
        <div class="city-chat-suggestions" id="cityChatSuggestions"></div>
      </section>
      <div id="map" aria-label="Offline neon Poland business map"></div>
      <div class="damage-overlay" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
      <div class="ember-corner" aria-hidden="true">
        <i></i><i></i><i></i><span></span>
      </div>
    </main>

    <aside class="hud">
      <div class="hud-head">
        <h1>Imperial<br>Sales Command</h1>
        <span class="status">M40.000</span>
      </div>
      <div class="general-roster" role="group" aria-label="General map mode">
        <button class="general-pick active" type="button" data-general="silver" aria-label="Select General Silver map mode">
          <span class="general-silver-logo hud-general general-silver" aria-hidden="true">
            <i></i><span></span><b></b><em data-label="GEN SILVER"></em>
          </span>
        </button>
        <button class="general-pick" type="button" data-general="desperados" aria-label="Select General Desperados map mode">
          <span class="general-silver-logo hud-general general-desperados" aria-hidden="true">
            <i></i><span></span><b></b><em data-label="GEN DESPERADOS"></em>
          </span>
        </button>
        <button class="general-pick" type="button" data-general="zywiec" aria-label="Select General Zywiec map mode">
          <span class="general-silver-logo hud-general general-zywiec" aria-hidden="true">
            <i></i><span></span><b></b><em data-label="GEN ZYWIEC"></em>
          </span>
        </button>
      </div>
      <div class="mandate-strip">
        <span id="generalModeLabel">Gen. Silver</span>
        <b id="generalModeText">Balanced sales command: protect revenue, watch debt, keep the national route map visible.</b>
      </div>
      <label class="theme-toggle">
        <input type="checkbox" id="acidTheme">
        <span>Acid neon theme</span>
      </label>

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
    minimumFractionDigits: fractionDigits,
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
  return `${formatCompactNumber(Math.round(absolute) * sign)}M pln`;
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

function normalizeCityText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
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
    selectedGeneral: "silver",
    selectedRegion: "mazowieckie",
    selectedCity: "warsaw",
    focusedCityId: null,
    priorityIndex: -1,
    data
  };

  const breadcrumbEl = document.querySelector<HTMLSpanElement>("#breadcrumb")!;
  const hintEl = document.querySelector<HTMLSpanElement>("#hint")!;
  const statsEl = document.querySelector<HTMLDivElement>("#stats")!;
  const salesRouteEl = document.querySelector<HTMLDivElement>("#salesRoute")!;
  const damageEl = document.querySelector<HTMLDivElement>("#damagePanel")!;
  const detailsEl = document.querySelector<HTMLDivElement>("#detailsPanel")!;
  const legendEl = document.querySelector<HTMLDivElement>("#legend")!;
  const readoutEl = document.querySelector<HTMLParagraphElement>("#readout")!;
  const aiPromptEl = document.querySelector<HTMLDivElement>("#aiPrompt")!;
  const generalModeLabel = document.querySelector<HTMLSpanElement>("#generalModeLabel")!;
  const generalModeText = document.querySelector<HTMLElement>("#generalModeText")!;
  const cityChatForm = document.querySelector<HTMLFormElement>("#cityChatForm")!;
  const cityChatInput = document.querySelector<HTMLInputElement>("#cityChatInput")!;
  const cityChatDatalist = document.querySelector<HTMLDataListElement>("#cityChatDatalist")!;
  const cityChatSuggestions = document.querySelector<HTMLDivElement>("#cityChatSuggestions")!;
  const cityChatLog = document.querySelector<HTMLDivElement>("#cityChatLog")!;
  const navButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-view]")];
  const generalButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-general]")];
  const layerInputs = [...document.querySelectorAll<HTMLInputElement>("[data-layer]")];
  const acidThemeInput = document.querySelector<HTMLInputElement>("#acidTheme")!;
  const zabkaLayer = createZabkaLayer(map, 5200, "warsaw");
  const chatContourLayer = L.layerGroup().addTo(map);
  const cityOptions = [...layers.cityById.values()]
    .filter((city, index, allCities) => allCities.findIndex((candidate) => candidate.id === city.id) === index)
    .sort((left, right) => left.name.localeCompare(right.name)) as CityMapOption[];
  const cityAliases = new Map<string, string>([
    ["warszawa", "warsaw"],
    ["krakow", "krakow"],
    ["lodz", "lodz"],
    ["wroclaw", "wroclaw"],
    ["poznan", "poznan"],
    ["gdansk", "gdansk"],
    ["katowice", "katowice"],
    ["radom", "radom"],
    ["plock", "plock"],
    ["bialystok", "bialystok"],
    ["rzeszow", "rzeszow"],
    ["czestochowa", "czestochowa"],
    ["bielskobiala", "bielsko-biala"],
    ["zielonagora", "zielona-gora"],
    ["gorzowwielkopolski", "gorzow"]
  ]);
  cityChatDatalist.innerHTML = cityOptions.map((city) => `<option value="${city.name}"></option>`).join("");

  function selectedLayerSet(general: MapGeneral): Set<LayerId> {
    return new Set(generalProfiles[general].layers);
  }

  function syncGeneralPriority(profile: GeneralProfile): void {
    Object.values(layers.scenes).forEach((scene) => scene.priorityLayer.clearLayers());
    if (profile.edict === undefined) return;
    const scenePriorityLayer = layers.scenes[profile.view].priorityLayer;
    scenePriorityLayer.addData(getPriorityFeature(profile.edict, profile.view));
    scenePriorityLayer.bringToFront();
  }

  function applyGeneralMode(general: MapGeneral, initial = false): void {
    const profile = generalProfiles[general];
    state.selectedGeneral = general;
    state.priorityIndex = profile.edict ?? state.priorityIndex;
    document.body.dataset.general = general;

    generalButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.general === general);
    });

    const activeLayers = selectedLayerSet(general);
    layerInputs.forEach((input) => {
      input.checked = activeLayers.has(input.dataset.layer as LayerId);
    });

    generalModeLabel.textContent = profile.label;
    generalModeText.textContent = profile.prompt;
    aiPromptEl.innerHTML = `<b>${profile.label} command</b><br>${profile.prompt}`;

    if (initial) {
      setView(profile.view);
    } else {
      setView(profile.view);
      map.getContainer().classList.add("general-switch-flash");
      window.setTimeout(() => map.getContainer().classList.remove("general-switch-flash"), 520);
    }

    syncGeneralPriority(profile);
    applyLayers();
    readoutEl.textContent = profile.readout;
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
    if (state.focusedCityId) {
      const focusedCity = state.data.cities.find((city) => city.id === state.focusedCityId);
      if (focusedCity) return focusedCity;
    }
    if (state.view === "poland") return countryEntity();
    if (state.view === "city") {
      return state.data.cities.find((city) => city.id === state.selectedCity) ?? state.data.cities[0];
    }
    return state.data.regions.find((region) => region.id === state.selectedRegion) ?? state.data.regions[0];
  };

  function citySearchNames(city: CityMapOption): string[] {
    return [city.id, city.name, cityAliases.get(normalizeCityText(city.name)) ?? ""]
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

  function matchingCitySuggestions(rawValue: string): CityMapOption[] {
    const query = normalizeCityText(rawValue);
    if (!query) return cityOptions.slice(0, 5);
    return cityOptions
      .map((city) => ({
        city,
        rank: citySearchNames(city).reduce((score, name) => {
          if (name === query) return Math.min(score, 0);
          if (name.startsWith(query)) return Math.min(score, 1);
          if (name.includes(query)) return Math.min(score, 2);
          return Math.min(score, 4 + levenshteinDistance(query, name));
        }, 99)
      }))
      .sort((left, right) => left.rank - right.rank || left.city.name.localeCompare(right.city.name))
      .slice(0, 5)
      .map((entry) => entry.city);
  }

  function renderCitySuggestions(): void {
    cityChatSuggestions.innerHTML = matchingCitySuggestions(cityChatInput.value).map((city) => `
      <button type="button" data-city-id="${city.id}">${city.name}</button>
    `).join("");
  }

  function focusChatCity(rawValue: string): void {
    const match = bestCityMatch(rawValue);
    if (!match) {
      cityChatLog.innerHTML = `<b>No lock:</b> ${rawValue || "empty"}`;
      hintEl.textContent = "City not found in Poland grid";
      return;
    }

    const knownCity = state.data.cities.find((city) => city.id === match.id);
    state.focusedCityId = knownCity?.id ?? null;
    state.selectedCity = match.id;
    if (knownCity) state.selectedRegion = knownCity.regionId;
    state.view = "poland";
    navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === "poland"));
    activateScene("poland");
    syncCityRetailLayer();
    renderStats();
    renderLegend();
    renderSalesRoute();
    renderDamagePanel();
    applyLayers();

    const cityLatLng = L.latLng(match.latLng);
    const contour = createCityContour(cityLatLng, match.id, knownCity ? knownCity.population / 1000 : match.populationK);
    const contourBounds = L.latLngBounds(contour);
    chatContourLayer.clearLayers();
    L.polygon(contour, {
      className: "chat-city-contour",
      color: "rgba(239, 255, 86, 0.96)",
      weight: 2.1,
      opacity: 1,
      fill: true,
      fillColor: "rgba(87, 255, 61, 0.16)",
      fillOpacity: 0.42,
      interactive: false
    }).addTo(chatContourLayer);
    L.marker(cityLatLng, {
      interactive: false,
      icon: L.divIcon({
        className: "chat-city-lock-label",
        html: `<b>${match.name}</b><span>city contour</span>`,
        iconSize: [132, 34],
        iconAnchor: [16, 42]
      })
    }).addTo(chatContourLayer);
    map.flyToBounds(contourBounds.pad(2.8), {
      duration: 0.62,
      paddingTopLeft: [320, 96],
      paddingBottomRight: [80, 96],
      maxZoom: 6.4
    });
    cityChatInput.value = match.name;
    renderCitySuggestions();
    breadcrumbEl.textContent = `City lock / ${match.name}`;
    hintEl.textContent = knownCity ? "Autocomplete corrected; contour drawn" : "Autocomplete corrected; marker contour drawn";
    cityChatLog.innerHTML = `<b>Corrected:</b> ${match.name}<br><span>${knownCity ? `Revenue ${formatMoneyPln(knownCity.revenueMlnPln)} / debt ${formatMoneyPln(knownCity.debtMlnPln)}` : "Marker lock only"}</span>`;
    readoutEl.textContent = `${match.name} is outlined on the Poland map. No city collapse: the command contour marks the field perimeter.`;
  }

  function renderStats(): void {
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
    if (state.view === "city") return [...state.data.cities].sort((a, b) => routeScore(b) - routeScore(a)).slice(0, 3);
    return [...state.data.cities]
      .filter((city) => city.regionId === state.selectedRegion)
      .sort((a, b) => routeScore(b) - routeScore(a))
      .slice(0, 3);
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
    if (state.view === "city") return cityEventPointFeatures.features;
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

  function applyLayers(): void {
    const sceneGroups = layers.scenes[state.view].groups;
    layerInputs.forEach((input) => {
      const group = sceneGroups[input.dataset.layer as LayerId];
      if (input.checked && !map.hasLayer(group)) map.addLayer(group);
      if (!input.checked && map.hasLayer(group)) map.removeLayer(group);
    });

    const active = layerInputs.filter((input) => input.checked).map((input) => layerNames[input.dataset.layer as LayerId]);
    const sceneNote = state.view === "poland"
      ? "M40 sales auspex: smooth country heat, toxic green sales maxima, red weak-sales fields."
      : state.view === "city"
        ? "5200 canvas Zabka points plus branded coverage hubs are live on the city scene."
        : "Major city star nodes stay inside Poland; Zabka coverage is reserved for the city map.";
    readoutEl.textContent = `${generalProfiles[state.selectedGeneral].label}: ${active.join(" / ")} active on ${state.view.toUpperCase()} map. ${sceneNote}`;
    renderDetails();
  }

  function syncCityRetailLayer(): void {
    if (state.view === "city") {
      if (!map.hasLayer(zabkaLayer)) map.addLayer(zabkaLayer);
      return;
    }
    if (map.hasLayer(zabkaLayer)) map.removeLayer(zabkaLayer);
  }

  function removeScene(view: MapScene): void {
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
    const nextScene = layers.scenes[view];
    if (!map.hasLayer(nextScene.base)) map.addLayer(nextScene.base);
    activeScene = view;
  }

  function setView(view: MapScene): void {
    state.focusedCityId = null;
    chatContourLayer.clearLayers();
    state.view = view;
    navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    const hadScene = activeScene !== null;
    activateScene(view);

    if (view === "poland") {
      map.flyToBounds(layers.scenes.poland.bounds, { duration: hadScene ? 0.55 : 0, padding: [12, 12] });
      breadcrumbEl.textContent = "Strategic / Poland";
      hintEl.textContent = "M40 country sales auspex";
    }

    if (view === "region") {
      map.flyToBounds(layers.scenes.region.bounds, { duration: 0.55, padding: [22, 22] });
      breadcrumbEl.textContent = "Operational / Mazowieckie";
      hintEl.textContent = "Region heat auspex";
    }

    if (view === "city") {
      state.selectedCity = state.selectedCity || "warsaw";
      map.flyToBounds(layers.scenes.city.bounds, { duration: 0.55, padding: [20, 20] });
      breadcrumbEl.textContent = "Retail / Warsaw";
      hintEl.textContent = "City heat with Zabka stores";
    }

    syncCityRetailLayer();
    renderStats();
    renderLegend();
    renderSalesRoute();
    renderDamagePanel();
    applyLayers();
  }

  function focusPriorityRegion(region: PriorityRegion): void {
    state.focusedCityId = null;
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
    renderLegend();
    renderSalesRoute();
    renderDamagePanel();
    applyLayers();
    readoutEl.textContent = `Sales route moved to ${region.label}. Click again to scan the next field visit target.`;
  }

  navButtons.forEach((button) => button.addEventListener("click", () => setView(button.dataset.view as MapScene)));
  cityChatInput.addEventListener("input", renderCitySuggestions);
  cityChatSuggestions.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-city-id]");
    if (!button) return;
    const city = cityOptions.find((option) => option.id === button.dataset.cityId);
    if (city) focusChatCity(city.name);
  });
  cityChatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    focusChatCity(cityChatInput.value);
  });
  generalButtons.forEach((button) => {
    button.addEventListener("click", () => applyGeneralMode(button.dataset.general as MapGeneral));
  });
  layerInputs.forEach((input) => input.addEventListener("change", applyLayers));
  acidThemeInput.addEventListener("change", () => {
    document.body.classList.toggle("acid-theme", acidThemeInput.checked);
  });
  document.querySelector<HTMLButtonElement>("#zoomIn")!.addEventListener("click", () => map.zoomIn(0.35));
  document.querySelector<HTMLButtonElement>("#zoomOut")!.addEventListener("click", () => map.zoomOut(0.35));
  document.querySelector<HTMLButtonElement>("#runAi")!.addEventListener("click", () => {
    state.priorityIndex = (state.priorityIndex + 1) % tacticalEdicts.length;
    focusPriorityRegion(tacticalEdicts[state.priorityIndex]);
  });

  map.on("business-city-click", (event) => {
    state.focusedCityId = null;
    chatContourLayer.clearLayers();
    const cityId = (event as L.LeafletEvent & { cityId?: string }).cityId ?? "warsaw";
    state.selectedCity = cityId;
    const city = state.data.cities.find((item) => item.id === cityId);
    if (city) state.selectedRegion = city.regionId;
    if (city) state.selectedCity = city.id;
    setView("city");
  });

  renderAiDefault();
  renderCitySuggestions();
  applyGeneralMode("silver", true);
}

async function main(): Promise<void> {
  renderShell();
  const data = await loadDemoData();
  const map = initMap();
  const layers = createBusinessMap(map);
  bootInteractions(map, layers, data);
}

void main();
