export type RegionId =
  | "mazowieckie"
  | "lodzkie"
  | "wielkopolskie"
  | "malopolskie"
  | "slaskie"
  | "pomorskie"
  | "dolnoslaskie"
  | "kujawsko-pomorskie"
  | "lubelskie"
  | "lubuskie"
  | "opolskie"
  | "podkarpackie"
  | "podlaskie"
  | "swietokrzyskie"
  | "warminsko-mazurskie"
  | "zachodniopomorskie";

export type LayerId = "revenue" | "expenses" | "events" | "debt" | "stock" | "ai";

export interface RegionSignal {
  id: RegionId;
  name: string;
  population: number;
  revenueMlnPln: number;
  expensesMlnPln: number;
  debtMlnPln: number;
  salesIndex: number;
  debtRisk: number;
  warehouseOverstock: number;
  eventForecast: number;
}

export interface CitySignal {
  id: string;
  name: string;
  regionId: RegionId;
  population: number;
  revenueMlnPln: number;
  expensesMlnPln: number;
  debtMlnPln: number;
  salesIndex: number;
  debtRisk: number;
  warehouseOverstock: number;
  eventForecast: number;
  trailScore: number;
}

export interface AiRecommendation {
  id: string;
  label: string;
  regionId: RegionId;
  reason: string;
  confidence: number;
  recommendedAction: string;
}

export interface DemoData {
  regions: RegionSignal[];
  cities: CitySignal[];
  aiRecommendations: AiRecommendation[];
}

export interface PriorityRegion {
  id: RegionId;
  label: string;
  center: [number, number];
  zoom: number;
  polygon: string;
  reason: string;
}
