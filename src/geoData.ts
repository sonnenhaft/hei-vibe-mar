import type { Feature, FeatureCollection, LineString, Point, Polygon, Position } from "geojson";
import type { LatLngExpression } from "leaflet";

export type CountryKind = "poland";
export type SignalKind = "revenue" | "expenses" | "debt" | "stock";

export interface CountryProperties {
  id: string;
  name: string;
  kind: CountryKind;
}

export interface LineProperties {
  id: string;
  name: string;
  kind: "admin" | "motorway";
}

export interface SignalProperties {
  id: string;
  name: string;
  kind: SignalKind;
  regionId?: string;
  score?: number;
}

export interface EventProperties {
  id: string;
  name: string;
  window: string;
  detail: string;
  radiusMeters: number;
  score: number;
}

export interface CityProperties {
  id: string;
  name: string;
  capital?: boolean;
  millionSignal?: boolean;
  starSignal?: boolean;
  populationK?: number;
}

function polygonFeature<P>(
  properties: P,
  coordinates: Position[]
): Feature<Polygon, P> {
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "Polygon",
      coordinates: [coordinates]
    }
  };
}

function lineFeature<P>(
  properties: P,
  coordinates: Position[]
): Feature<LineString, P> {
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "LineString",
      coordinates
    }
  };
}

function pointFeature<P>(
  properties: P,
  coordinates: Position
): Feature<Point, P> {
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "Point",
      coordinates
    }
  };
}

export const polandFeature = polygonFeature<CountryProperties>(
  { id: "poland", name: "Poland", kind: "poland" },
  // Source: johan/world.geo.json countries/POL.geo.json (standard GeoJSON country outline).
  [
    [15.016996, 51.106674], [14.607098, 51.745188], [14.685026, 52.089947],
    [14.4376, 52.62485], [14.074521, 52.981263], [14.353315, 53.248171],
    [14.119686, 53.757029], [14.8029, 54.050706], [16.363477, 54.513159],
    [17.622832, 54.851536], [18.620859, 54.682606], [18.696255, 54.438719],
    [19.66064, 54.426084], [20.892245, 54.312525], [22.731099, 54.327537],
    [23.243987, 54.220567], [23.484128, 53.912498], [23.527536, 53.470122],
    [23.804935, 53.089731], [23.799199, 52.691099], [23.199494, 52.486977],
    [23.508002, 52.023647], [23.527071, 51.578454], [24.029986, 50.705407],
    [23.922757, 50.424881], [23.426508, 50.308506], [22.51845, 49.476774],
    [22.776419, 49.027395], [22.558138, 49.085738], [21.607808, 49.470107],
    [20.887955, 49.328772], [20.415839, 49.431453], [19.825023, 49.217125],
    [19.320713, 49.571574], [18.909575, 49.435846], [18.853144, 49.49623],
    [18.392914, 49.988629], [17.649445, 50.049038], [17.554567, 50.362146],
    [16.868769, 50.473974], [16.719476, 50.215747], [16.176253, 50.422607],
    [16.238627, 50.697733], [15.490972, 50.78473], [15.016996, 51.106674]
  ]
);

export const adminBoundaryFeatures: FeatureCollection<LineString, LineProperties> = {
  type: "FeatureCollection",
  features: [
    lineFeature({ id: "admin-west", name: "West voivodeship boundary", kind: "admin" }, [[16.0, 54.3], [16.2, 53.6], [16.5, 52.8], [16.2, 52.0], [15.3, 51.1]]),
    lineFeature({ id: "admin-midwest", name: "Mid-west voivodeship boundary", kind: "admin" }, [[18.8, 54.4], [18.6, 53.7], [18.2, 53.2], [18.0, 52.5], [18.2, 51.8], [17.7, 50.7]]),
    lineFeature({ id: "admin-mideast", name: "Mid-east voivodeship boundary", kind: "admin" }, [[21.8, 54.2], [21.2, 53.5], [21.0, 52.8], [21.1, 52.1], [21.0, 51.3], [20.4, 50.3]]),
    lineFeature({ id: "admin-east", name: "East voivodeship boundary", kind: "admin" }, [[23.0, 53.6], [22.2, 53.0], [22.1, 52.4], [22.4, 51.7], [23.3, 50.9]]),
    lineFeature({ id: "admin-north", name: "Northern voivodeship boundary", kind: "admin" }, [[14.5, 52.9], [15.5, 52.7], [16.5, 52.5], [17.6, 52.4], [18.4, 52.3], [19.2, 52.2], [20.3, 52.2], [21.5, 52.3], [22.6, 52.4], [23.4, 52.7]]),
    lineFeature({ id: "admin-center", name: "Central voivodeship boundary", kind: "admin" }, [[14.9, 51.2], [16.0, 51.6], [17.4, 51.5], [18.6, 51.6], [19.7, 51.7], [20.9, 51.7], [22.1, 51.6], [23.6, 51.4]]),
    lineFeature({ id: "admin-south", name: "Southern voivodeship boundary", kind: "admin" }, [[15.4, 50.5], [16.4, 50.7], [17.4, 50.5], [18.4, 50.4], [19.5, 50.3], [20.6, 50.1], [21.8, 50.1], [23.2, 50.2]]),
    lineFeature({ id: "admin-kujawy", name: "Kujawy split", kind: "admin" }, [[17.4, 53.7], [17.8, 53.1], [18.0, 52.4], [18.6, 51.7]]),
    lineFeature({ id: "admin-mazowsze", name: "Mazowsze split", kind: "admin" }, [[19.2, 53.2], [19.8, 52.7], [20.3, 52.2], [20.9, 51.7]]),
    lineFeature({ id: "admin-silesia", name: "Silesia split", kind: "admin" }, [[17.0, 51.0], [17.6, 50.4], [18.2, 50.0], [19.0, 49.7]]),
    lineFeature({ id: "admin-malopolska", name: "Malopolska split", kind: "admin" }, [[19.3, 50.6], [20.2, 50.2], [21.2, 49.8], [22.2, 49.4]])
  ]
};

export const transportFeatures: FeatureCollection<LineString, LineProperties> = {
  type: "FeatureCollection",
  features: [
    lineFeature({ id: "a2-a4-spine", name: "A2/A4 business spine", kind: "motorway" }, [[21.01, 52.23], [19.45, 52.03], [19.46, 51.77], [17.03, 51.11], [19.94, 50.06]]),
    lineFeature({ id: "warsaw-lublin", name: "Warsaw-Lublin route", kind: "motorway" }, [[21.01, 52.23], [22.57, 51.25], [22.0, 50.04]]),
    lineFeature({ id: "warsaw-poznan", name: "Warsaw-Poznan route", kind: "motorway" }, [[21.01, 52.23], [16.93, 52.41], [15.5, 51.94]]),
    lineFeature({ id: "gdansk-silesia", name: "Gdansk-Silesia route", kind: "motorway" }, [[18.65, 54.35], [18.0, 53.12], [21.01, 52.23], [19.02, 50.26]]),
    lineFeature({ id: "western-logistics", name: "Western logistics route", kind: "motorway" }, [[14.55, 53.43], [16.93, 52.41], [17.03, 51.11], [19.02, 50.26], [19.04, 49.82]])
  ]
};

const expenseFeatures: Feature<Polygon, SignalProperties>[] = [
  polygonFeature({ id: "expenses-nw", name: "North-west cost leak", kind: "expenses", score: 54 }, [[14.9, 53.72], [15.72, 53.58], [15.92, 53.08], [15.25, 52.84], [14.68, 53.2], [14.9, 53.72]]),
  polygonFeature({ id: "expenses-north", name: "Northern logistics drag", kind: "expenses", score: 61 }, [[19.66, 54.14], [20.56, 54.02], [20.76, 53.42], [19.9, 53.18], [19.38, 53.62], [19.66, 54.14]]),
  polygonFeature({ id: "expenses-sw", name: "South-west operating burn", kind: "expenses", score: 57 }, [[15.38, 51.06], [16.2, 50.72], [16.06, 50.16], [15.28, 50.06], [14.98, 50.58], [15.38, 51.06]]),
  polygonFeature({ id: "expenses-east", name: "Eastern route cost leak", kind: "expenses", score: 49 }, [[23.02, 52.02], [23.72, 51.58], [23.34, 51.1], [22.58, 51.24], [22.34, 51.78], [23.02, 52.02]])
];

export const hotRegionFeatures: Feature<Polygon, SignalProperties>[] = [
  polygonFeature({ id: "revenue-mazowieckie", name: "Mazowieckie revenue furnace", kind: "revenue", regionId: "mazowieckie", score: 92 }, [[20.2, 52.78], [21.55, 52.55], [22.05, 52.02], [21.55, 51.45], [20.4, 51.35], [19.82, 51.92], [19.84, 52.55], [20.2, 52.78]]),
  polygonFeature({ id: "revenue-silesia", name: "Silesia revenue forge", kind: "revenue", regionId: "slaskie", score: 84 }, [[18.55, 51.04], [19.58, 50.58], [20.12, 49.86], [19.18, 49.48], [18.26, 49.92], [18.55, 51.04]]),
  polygonFeature({ id: "revenue-southeast", name: "South-east revenue march", kind: "revenue", regionId: "podkarpackie", score: 76 }, [[21.1, 50.48], [22.7, 50.2], [22.84, 49.42], [21.38, 49.18], [20.62, 49.72], [21.1, 50.48]]),
  polygonFeature({ id: "revenue-west", name: "Western revenue corridor", kind: "revenue", regionId: "wielkopolskie", score: 71 }, [[16.25, 52.78], [17.36, 52.6], [17.9, 52.0], [16.95, 51.55], [15.92, 51.86], [16.25, 52.78]])
];

const debtFeatures: Feature<Polygon, SignalProperties>[] = [
  polygonFeature({ id: "debt-mazowieckie", name: "Mazowieckie debt pressure", kind: "debt", regionId: "mazowieckie", score: 72 }, [[20.35, 52.52], [21.42, 52.42], [21.72, 51.82], [20.72, 51.54], [20.18, 52.0], [20.35, 52.52]]),
  polygonFeature({ id: "debt-slaskie", name: "Silesia debt pressure", kind: "debt", regionId: "slaskie", score: 62 }, [[18.76, 50.58], [19.72, 50.44], [19.92, 49.94], [18.98, 49.72], [18.48, 50.12], [18.76, 50.58]])
];

const stockFeatures: Feature<Polygon, SignalProperties>[] = [
  polygonFeature({ id: "stock-lodz", name: "Lodz warehouse pressure", kind: "stock", regionId: "lodzkie", score: 66 }, [[19.15, 51.98], [19.82, 52.08], [20.02, 51.62], [19.38, 51.42], [19.15, 51.98]]),
  polygonFeature({ id: "stock-warsaw", name: "Warsaw warehouse pressure", kind: "stock", regionId: "mazowieckie", score: 58 }, [[20.78, 52.5], [21.42, 52.55], [21.62, 52.08], [20.92, 51.98], [20.78, 52.5]])
];

export const signalPolygonFeatures: FeatureCollection<Polygon, SignalProperties> = {
  type: "FeatureCollection",
  features: [...expenseFeatures, ...hotRegionFeatures, ...debtFeatures, ...stockFeatures]
};

export const eventPointFeatures: FeatureCollection<Point, EventProperties> = {
  type: "FeatureCollection",
  features: [
    pointFeature({ id: "events-warsaw", name: "Warsaw events forecast", window: "Fri-Sun, 21-23 Jun", detail: "National demand surge around stadium, expo, and nightlife corridors.", radiusMeters: 105000, score: 91 }, [21.01, 52.23]),
    pointFeature({ id: "events-krakow", name: "Krakow events forecast", window: "Sat, 22 Jun", detail: "Tourism peak and old-town venue density lift premium SKU velocity.", radiusMeters: 70000, score: 82 }, [19.94, 50.06]),
    pointFeature({ id: "events-katowice", name: "Katowice events forecast", window: "Thu-Fri, 20-21 Jun", detail: "Arena cluster plus Silesia commute flow creates short replenishment window.", radiusMeters: 76000, score: 74 }, [19.02, 50.26]),
    pointFeature({ id: "events-poznan", name: "Poznan events forecast", window: "Sun, 23 Jun", detail: "Fairground footfall and western retail route need fast field coverage.", radiusMeters: 64000, score: 62 }, [16.93, 52.41])
  ]
};

export const mazowieckieRegionFeature = polygonFeature<CountryProperties>(
  { id: "mazowieckie-scene", name: "Mazowieckie Region", kind: "poland" },
  [[19.25, 52.9], [20.25, 53.05], [21.55, 52.8], [22.55, 52.28], [22.35, 51.4], [21.35, 50.98], [20.2, 51.18], [19.35, 51.85], [19.25, 52.9]]
);

export const regionSignalPolygonFeatures: FeatureCollection<Polygon, SignalProperties> = {
  type: "FeatureCollection",
  features: [
    polygonFeature({ id: "region-revenue-warsaw", name: "Warsaw revenue core", kind: "revenue", regionId: "mazowieckie", score: 95 }, [[20.55, 52.48], [21.28, 52.42], [21.46, 51.98], [20.88, 51.78], [20.42, 52.05], [20.55, 52.48]]),
    polygonFeature({ id: "region-revenue-radom", name: "Radom recovery pocket", kind: "revenue", regionId: "mazowieckie", score: 62 }, [[20.7, 51.62], [21.45, 51.48], [21.35, 51.05], [20.72, 51.0], [20.48, 51.34], [20.7, 51.62]]),
    polygonFeature({ id: "region-expenses-west", name: "Western logistics burn", kind: "expenses", regionId: "mazowieckie", score: 68 }, [[19.55, 52.72], [20.42, 52.58], [20.35, 52.05], [19.52, 51.92], [19.28, 52.38], [19.55, 52.72]]),
    polygonFeature({ id: "region-expenses-east", name: "Eastern route drag", kind: "expenses", regionId: "mazowieckie", score: 57 }, [[21.42, 52.66], [22.35, 52.2], [22.16, 51.62], [21.38, 51.72], [21.2, 52.18], [21.42, 52.66]]),
    polygonFeature({ id: "region-debt-south", name: "Southern debt belt", kind: "debt", regionId: "mazowieckie", score: 76 }, [[20.2, 51.88], [21.46, 51.76], [21.72, 51.22], [20.8, 50.98], [20.05, 51.3], [20.2, 51.88]]),
    polygonFeature({ id: "region-stock-north", name: "Northern warehouse drag", kind: "stock", regionId: "mazowieckie", score: 59 }, [[20.15, 52.98], [21.22, 52.9], [21.12, 52.48], [20.18, 52.48], [19.94, 52.72], [20.15, 52.98]])
  ]
};

export const regionTransportFeatures: FeatureCollection<LineString, LineProperties> = {
  type: "FeatureCollection",
  features: [
    lineFeature({ id: "region-a2", name: "A2 revenue corridor", kind: "motorway" }, [[19.45, 52.28], [20.15, 52.22], [21.01, 52.23], [21.72, 52.12], [22.35, 52.05]]),
    lineFeature({ id: "region-s7", name: "S7 cost corridor", kind: "motorway" }, [[20.72, 53.02], [20.98, 52.52], [21.01, 52.23], [21.1, 51.82], [21.15, 51.4]]),
    lineFeature({ id: "region-s8", name: "S8 west-east chain", kind: "motorway" }, [[19.58, 52.08], [20.38, 52.16], [21.01, 52.23], [21.76, 52.34]])
  ]
};

export const regionEventPointFeatures: FeatureCollection<Point, EventProperties> = {
  type: "FeatureCollection",
  features: [
    pointFeature({ id: "region-events-warsaw", name: "Warsaw demand wave", window: "Fri evening, 21 Jun", detail: "Sales should cover central chains before debt follow-up starts Monday.", radiusMeters: 54000, score: 91 }, [21.01, 52.23]),
    pointFeature({ id: "region-events-radom", name: "Radom field run", window: "Sat, 22 Jun", detail: "Secondary city pull; combine merchandising visit with overdue account checks.", radiusMeters: 32000, score: 61 }, [21.15, 51.4]),
    pointFeature({ id: "region-events-plock", name: "Plock outlet pressure", window: "Sun morning, 23 Jun", detail: "Low-score but useful northern sweep while warehouse stock remains high.", radiusMeters: 28000, score: 52 }, [19.7, 52.55])
  ]
};

export const regionCityPointFeatures: FeatureCollection<Point, CityProperties> = {
  type: "FeatureCollection",
  features: [
    pointFeature({ id: "warsaw", name: "Warsaw", capital: true, millionSignal: true, populationK: 1860 }, [21.01, 52.23]),
    pointFeature({ id: "radom", name: "Radom", starSignal: true, populationK: 198 }, [21.15, 51.4]),
    pointFeature({ id: "plock", name: "Plock", starSignal: true, populationK: 116 }, [19.7, 52.55]),
    pointFeature({ id: "siedlce", name: "Siedlce", starSignal: true, populationK: 76 }, [22.27, 52.17]),
    pointFeature({ id: "ostroleka", name: "Ostroleka", starSignal: true, populationK: 51 }, [21.57, 53.08])
  ]
};

export const warsawBoundaryFeature = polygonFeature<CountryProperties>(
  { id: "warsaw-scene", name: "Warsaw City", kind: "poland" },
  [[20.78, 52.39], [21.06, 52.43], [21.32, 52.3], [21.35, 52.08], [21.14, 51.96], [20.84, 51.98], [20.68, 52.18], [20.78, 52.39]]
);

export const warsawDistrictLineFeatures: FeatureCollection<LineString, LineProperties> = {
  type: "FeatureCollection",
  features: [
    lineFeature({ id: "city-north-south", name: "North-south city split", kind: "admin" }, [[21.01, 52.43], [21.04, 52.3], [21.03, 52.18], [21.02, 51.98]]),
    lineFeature({ id: "city-west-east", name: "West-east city split", kind: "admin" }, [[20.68, 52.22], [20.88, 52.24], [21.08, 52.23], [21.35, 52.2]]),
    lineFeature({ id: "city-inner-ring", name: "Inner commerce ring", kind: "admin" }, [[20.86, 52.3], [20.98, 52.35], [21.14, 52.31], [21.18, 52.18], [21.05, 52.1], [20.9, 52.13], [20.86, 52.3]])
  ]
};

export const citySignalPolygonFeatures: FeatureCollection<Polygon, SignalProperties> = {
  type: "FeatureCollection",
  features: [
    polygonFeature({ id: "city-revenue-center", name: "Central revenue shrine", kind: "revenue", score: 96 }, [[20.92, 52.32], [21.1, 52.32], [21.14, 52.2], [21.02, 52.12], [20.88, 52.18], [20.92, 52.32]]),
    polygonFeature({ id: "city-revenue-south", name: "Southern store chain", kind: "revenue", score: 72 }, [[20.92, 52.15], [21.18, 52.14], [21.22, 52.02], [20.98, 51.98], [20.82, 52.06], [20.92, 52.15]]),
    polygonFeature({ id: "city-expenses-west", name: "West service cost", kind: "expenses", score: 66 }, [[20.72, 52.34], [20.94, 52.32], [20.9, 52.14], [20.72, 52.1], [20.64, 52.24], [20.72, 52.34]]),
    polygonFeature({ id: "city-debt-east", name: "East receivables wound", kind: "debt", score: 78 }, [[21.1, 52.34], [21.34, 52.28], [21.28, 52.1], [21.08, 52.12], [21.04, 52.24], [21.1, 52.34]]),
    polygonFeature({ id: "city-stock-north", name: "North stock pressure", kind: "stock", score: 59 }, [[20.84, 52.42], [21.08, 52.42], [21.12, 52.32], [20.88, 52.3], [20.78, 52.36], [20.84, 52.42]])
  ]
};

export const cityTransportFeatures: FeatureCollection<LineString, LineProperties> = {
  type: "FeatureCollection",
  features: [
    lineFeature({ id: "city-vistula", name: "Vistula axis", kind: "admin" }, [[21.08, 52.39], [21.06, 52.3], [21.04, 52.22], [21.06, 52.1], [21.1, 51.98]]),
    lineFeature({ id: "city-retail-ring", name: "Retail ring", kind: "motorway" }, [[20.78, 52.34], [20.96, 52.4], [21.2, 52.33], [21.28, 52.17], [21.08, 52.0], [20.82, 52.06], [20.7, 52.22], [20.78, 52.34]]),
    lineFeature({ id: "city-center-spine", name: "Center spine", kind: "motorway" }, [[20.82, 52.22], [20.96, 52.22], [21.08, 52.22], [21.26, 52.22]])
  ]
};

export const cityEventPointFeatures: FeatureCollection<Point, EventProperties> = {
  type: "FeatureCollection",
  features: [
    pointFeature({ id: "city-events-center", name: "Central event pulse", window: "Fri 18:00-01:00", detail: "Highest night demand; prioritize fresh stock around central Zabka clusters.", radiusMeters: 10500, score: 91 }, [21.01, 52.23]),
    pointFeature({ id: "city-events-mokotow", name: "Mokotow evening wave", window: "Sat 17:00-23:00", detail: "Office-to-residential evening move; watch cold chain and promo gaps.", radiusMeters: 8000, score: 74 }, [21.02, 52.18]),
    pointFeature({ id: "city-events-praga", name: "Praga recovery wave", window: "Sun 12:00-20:00", detail: "Useful recovery route with moderate debt pressure east of the river.", radiusMeters: 7200, score: 68 }, [21.08, 52.25])
  ]
};

export const cityPointFeatures: FeatureCollection<Point, CityProperties> = {
  type: "FeatureCollection",
  features: [
    pointFeature({ id: "warsaw", name: "Warsaw", capital: true, millionSignal: true, populationK: 1860 }, [21.01, 52.23]),
    pointFeature({ id: "krakow", name: "Krakow", millionSignal: true, populationK: 803 }, [19.94, 50.06]),
    pointFeature({ id: "lodz", name: "Lodz", millionSignal: true, populationK: 655 }, [19.46, 51.77]),
    pointFeature({ id: "wroclaw", name: "Wroclaw", millionSignal: true, populationK: 674 }, [17.03, 51.11]),
    pointFeature({ id: "poznan", name: "Poznan", millionSignal: true, populationK: 540 }, [16.93, 52.41]),
    pointFeature({ id: "gdansk", name: "Gdansk", millionSignal: true, populationK: 486 }, [18.65, 54.35]),
    pointFeature({ id: "katowice", name: "Katowice", millionSignal: true, populationK: 279 }, [19.02, 50.26]),
    pointFeature({ id: "radom", name: "Radom", starSignal: true, populationK: 198 }, [21.15, 51.4]),
    pointFeature({ id: "szczecin", name: "Szczecin", starSignal: true, populationK: 390 }, [14.55, 53.43]),
    pointFeature({ id: "bydgoszcz", name: "Bydgoszcz", starSignal: true, populationK: 330 }, [18.01, 53.12]),
    pointFeature({ id: "torun", name: "Torun", starSignal: true, populationK: 196 }, [18.6, 53.01]),
    pointFeature({ id: "lublin", name: "Lublin", starSignal: true, populationK: 332 }, [22.57, 51.25]),
    pointFeature({ id: "bialystok", name: "Bialystok", starSignal: true, populationK: 293 }, [23.17, 53.13]),
    pointFeature({ id: "rzeszow", name: "Rzeszow", starSignal: true, populationK: 197 }, [22.0, 50.04]),
    pointFeature({ id: "kielce", name: "Kielce", starSignal: true, populationK: 188 }, [20.63, 50.87]),
    pointFeature({ id: "olsztyn", name: "Olsztyn", starSignal: true, populationK: 168 }, [20.48, 53.78]),
    pointFeature({ id: "opole", name: "Opole", starSignal: true, populationK: 126 }, [17.92, 50.68]),
    pointFeature({ id: "zielona-gora", name: "Zielona Gora", starSignal: true, populationK: 139 }, [15.51, 51.94]),
    pointFeature({ id: "gorzow", name: "Gorzow Wielkopolski", starSignal: true, populationK: 122 }, [15.24, 52.74]),
    pointFeature({ id: "gdynia", name: "Gdynia", starSignal: true, populationK: 244 }, [18.53, 54.52]),
    pointFeature({ id: "czestochowa", name: "Czestochowa", starSignal: true, populationK: 208 }, [19.12, 50.81]),
    pointFeature({ id: "bielsko-biala", name: "Bielsko-Biala", starSignal: true, populationK: 168 }, [19.04, 49.82]),
    pointFeature({ id: "gliwice", name: "Gliwice", starSignal: true, populationK: 171 }, [18.67, 50.29]),
    pointFeature({ id: "elblag", name: "Elblag", starSignal: true, populationK: 116 }, [19.41, 54.15]),
    pointFeature({ id: "koszalin", name: "Koszalin", starSignal: true, populationK: 105 }, [16.17, 54.19]),
    pointFeature({ id: "kalisz", name: "Kalisz", starSignal: true, populationK: 97 }, [18.09, 51.76]),
    pointFeature({ id: "plock", name: "Plock", starSignal: true, populationK: 116 }, [19.71, 52.55]),
    pointFeature({ id: "tarnow", name: "Tarnow", starSignal: true, populationK: 105 }, [20.99, 50.01])
  ]
};

export const majorCities = cityPointFeatures.features.map((feature) => {
  const [lng, lat] = feature.geometry.coordinates;
  return {
    ...feature.properties,
    latLng: [lat, lng] as LatLngExpression
  };
});
