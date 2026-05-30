import type { LatLng } from '../types';

const EARTH_RADIUS_M = 6371000;
const DEG_TO_RAD = Math.PI / 180;

/** Haversine distance between two points in meters. */
export function haversine(a: LatLng, b: LatLng): number {
  const lat1 = a.latitude * DEG_TO_RAD;
  const lat2 = b.latitude * DEG_TO_RAD;
  const dLat = (b.latitude - a.latitude) * DEG_TO_RAD;
  const dLon = (b.longitude - a.longitude) * DEG_TO_RAD;

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Ray-casting point-in-polygon test. */
export function isPointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.longitude;
    const yi = polygon[i]!.latitude;
    const xj = polygon[j]!.longitude;
    const yj = polygon[j]!.latitude;

    const denominator = yj - yi === 0 ? 1e-12 : yj - yi;
    const intersect =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / denominator + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

/** Distance from a point to a line segment (haversine-approximate). */
function distanceToSegment(point: LatLng, start: LatLng, end: LatLng): number {
  const latDiff = end.latitude - start.latitude;
  const lonDiff = end.longitude - start.longitude;

  if (latDiff === 0 && lonDiff === 0) {
    return haversine(point, start);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.longitude - start.longitude) * lonDiff +
        (point.latitude - start.latitude) * latDiff) /
        (lonDiff * lonDiff + latDiff * latDiff),
    ),
  );

  const projection: LatLng = {
    latitude: start.latitude + t * latDiff,
    longitude: start.longitude + t * lonDiff,
  };

  return haversine(point, projection);
}

/** Minimum distance from point to polygon boundary. */
export function distanceToPolygon(point: LatLng, polygon: LatLng[]): number {
  let min = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const start = polygon[i]!;
    const end = polygon[(i + 1) % polygon.length]!;
    const d = distanceToSegment(point, start, end);
    if (d < min) min = d;
  }
  return min;
}

/** Distance from a point to a zone (0 if inside). */
export function distanceToZone(
  point: LatLng,
  zone: { type: 'circle' | 'polygon'; center?: LatLng; radius?: number; polygon?: LatLng[] },
): number | undefined {
  if (zone.type === 'circle' && zone.center && zone.radius != null) {
    const d = haversine(point, zone.center);
    return d <= zone.radius ? 0 : d - zone.radius;
  }

  if (zone.type === 'polygon' && zone.polygon && zone.polygon.length >= 3) {
    if (isPointInPolygon(point, zone.polygon)) return 0;
    return distanceToPolygon(point, zone.polygon);
  }

  return undefined;
}

/** Format distance for display: "250m", "1.2km", or "—". */
export function formatDistance(meters: number | undefined): string {
  if (meters == null) return '—';
  if (meters === 0) return 'Inside';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}
