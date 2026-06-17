import L, { type LatLngExpression } from "leaflet";

function toLatLngTuple(point: LatLngExpression): [number, number] {
  const latLng = L.latLng(point);
  return [latLng.lat, latLng.lng];
}

export function isLatLngInsidePolygon(point: LatLngExpression, polygon: LatLngExpression[]): boolean {
  if (polygon.length < 3) return false;

  const [lat, lng] = toLatLngTuple(point);
  const x = lng;
  const y = lat;
  const ring = polygon.map(toLatLngTuple);
  let inside = false;

  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index, index += 1) {
    const [currentLat, currentLng] = ring[index];
    const [previousLat, previousLng] = ring[previousIndex];
    const currentX = currentLng;
    const currentY = currentLat;
    const previousX = previousLng;
    const previousY = previousLat;
    const crossesRay = (currentY > y) !== (previousY > y);

    if (crossesRay) {
      const intersectionX = ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX;
      if (x < intersectionX) inside = !inside;
    }
  }

  return inside;
}

export function isLatLngInsideAllPolygons(point: LatLngExpression, polygons: LatLngExpression[][]): boolean {
  return polygons.every((polygon) => isLatLngInsidePolygon(point, polygon));
}
