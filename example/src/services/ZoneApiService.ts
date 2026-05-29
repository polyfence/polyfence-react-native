import type { Zone, Coordinate } from 'polyfence-react-native';
import Config from 'react-native-config';

const BASE_URL = Config.POLYFENCE_API_URL ?? 'https://polyfence.io/api/zones';
const API_KEY = (Config.POLYFENCE_API_KEY ?? '').trim();

interface ApiZone {
  id: string | number;
  name: string;
  type: string;
  is_active: boolean;
  center_lat?: number | string;
  center_lng?: number | string;
  radius_meters?: number | string;
  polygon?: string | Array<{ lat: number | string; lng: number | string }>;
}

function parseDouble(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function parsePolygonPoints(
  polygonData: unknown,
): Coordinate[] {
  const points: Coordinate[] = [];

  let polygonArray: Array<{ lat: number | string; lng: number | string }>;
  if (typeof polygonData === 'string') {
    try {
      polygonArray = JSON.parse(polygonData);
    } catch {
      return points;
    }
  } else if (Array.isArray(polygonData)) {
    polygonArray = polygonData;
  } else {
    return points;
  }

  for (const point of polygonArray) {
    const lat = parseDouble(point.lat);
    const lng = parseDouble(point.lng);
    if (lat != null && lng != null) {
      points.push({ latitude: lat, longitude: lng });
    }
  }

  return points;
}

function convertApiZone(data: ApiZone): Zone | null {
  const id = String(data.id);
  const name = data.name ?? 'Unknown Zone';
  const type = data.type ?? 'circle';

  if (type === 'circle') {
    const lat = parseDouble(data.center_lat);
    const lng = parseDouble(data.center_lng);
    const radius = parseDouble(data.radius_meters);
    if (lat == null || lng == null || radius == null) return null;
    return {
      id,
      name,
      type: 'circle',
      center: { latitude: lat, longitude: lng },
      radius,
    };
  }

  if (type === 'polygon') {
    const points = parsePolygonPoints(data.polygon);
    if (points.length < 3) return null;
    return { id, name, type: 'polygon', polygon: points };
  }

  return null;
}

export async function fetchActiveZones(): Promise<Zone[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    // The Polyfence list endpoint paginates with a default page size of 50.
    // Without `limit=`, accounts with > 50 zones silently lose everything past
    // page 1 — including zones that are active and that the user has just
    // verified in the dashboard. `limit=200` covers the QA-app's foreseeable
    // zone count; revisit with proper pagination if accounts ever exceed that.
    if (API_KEY.length === 0) {
      throw new Error(
        'POLYFENCE_API_KEY is not set. Copy example/.env.example to example/.env, paste your key, and rebuild. Get a free key at https://polyfence.io.',
      );
    }

    const url = `${BASE_URL}${BASE_URL.includes('?') ? '&' : '?'}limit=200`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to load zones. Status: ${response.status}. ${body}`,
      );
    }

    const responseBody = await response.json();

    let zonesJson: ApiZone[];
    if (Array.isArray(responseBody)) {
      zonesJson = responseBody;
    } else if (responseBody?.data && Array.isArray(responseBody.data)) {
      zonesJson = responseBody.data;
    } else {
      throw new Error('Unexpected API response format');
    }

    const zones: Zone[] = [];
    for (const apiZone of zonesJson) {
      if (apiZone.is_active !== true) continue;
      const zone = convertApiZone(apiZone);
      if (zone) zones.push(zone);
    }

    return zones;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. The server may be slow or unreachable.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
