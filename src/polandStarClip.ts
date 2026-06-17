import type { LatLngExpression } from "leaflet";
import { polandFeature } from "./geoData";
import { isLatLngInsideAllPolygons } from "./geoClip";

export const polandClipPolygon: LatLngExpression[] = polandFeature.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);

export const polandSouthStarClipPolygon: LatLngExpression[] = [
  [55.6, 13.6],
  [55.6, 24.8],
  [50.72, 24.1],
  [50.48, 23.95],
  [50.3, 23.45],
  [49.78, 22.85],
  [49.28, 22.55],
  [49.18, 21.95],
  [49.34, 21.1],
  [49.2, 20.4],
  [49.34, 19.85],
  [49.48, 19.25],
  [49.58, 18.9],
  [49.92, 18.55],
  [50.05, 17.65],
  [50.35, 16.9],
  [50.2, 16.7],
  [50.45, 16.2],
  [50.72, 15.45],
  [51.12, 14.85],
  [55.6, 13.6]
];

export const polandStarClipPolygons: LatLngExpression[][] = [polandClipPolygon, polandSouthStarClipPolygon];

export function isInsidePolandStarClip(point: LatLngExpression): boolean {
  return isLatLngInsideAllPolygons(point, polandStarClipPolygons);
}
