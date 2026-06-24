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

// The list endpoint caps each page at 100; we follow the pagination token
// until the server reports no more results. 50-page safety cap = 5,000 zones.
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

// Fetch one page with its own 30s timeout.
async function fetchZonePage(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
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
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

// Page through EVERY zone, following pagination.nextCursor until hasMore=false.
// A single capped GET only returns the first page (max 100), so accounts with
// more zones silently lose the rest — the cause of "dashboard shows 177 but
// only 100 reach the device". Do this in your own app too, not just here.
async function fetchAllZonePages(): Promise<ApiZone[]> {
  const all: ApiZone[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const sep = BASE_URL.includes('?') ? '&' : '?';
    const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    const url = `${BASE_URL}${sep}limit=${PAGE_SIZE}${cursorParam}`;

    const body = await fetchZonePage(url);

    // Two shapes: a bare array (legacy/unpaginated) or
    // { data: [...], pagination: { hasMore, nextCursor } }.
    if (Array.isArray(body)) {
      all.push(...(body as ApiZone[]));
      break;
    }
    if (
      body &&
      typeof body === 'object' &&
      Array.isArray((body as { data?: unknown }).data)
    ) {
      const wrapped = body as {
        data: ApiZone[];
        pagination?: { hasMore?: boolean; nextCursor?: string | null };
      };
      all.push(...wrapped.data);
      const pagination = wrapped.pagination;
      if (pagination?.hasMore === true && pagination.nextCursor != null) {
        cursor = String(pagination.nextCursor);
        continue;
      }
      break;
    }
    throw new Error('Unexpected API response format');
  }

  return all;
}

export async function fetchActiveZones(): Promise<Zone[]> {
  if (API_KEY.length === 0) {
    throw new Error(
      'POLYFENCE_API_KEY is not set. Copy example/.env.example to example/.env, paste your key, and rebuild. Get a free key at https://polyfence.io.',
    );
  }

  try {
    const zonesJson = await fetchAllZonePages();

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
  }
}
