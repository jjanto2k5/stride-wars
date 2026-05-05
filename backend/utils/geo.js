/**
 * Geo utilities for Stride Wars
 * All coordinates: [longitude, latitude] (GeoJSON standard)
 */

const EARTH_RADIUS_M = 6371000;

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Haversine distance between two lat/lng points in meters
 */
export const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Shoelace formula — approximate polygon area in sq meters
 * coords: [[lng, lat], ...] (closed ring)
 */
export const polygonArea = (coords) => {
  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n - 1; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    area += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((area * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
};

/**
 * Bounding box of a LineString
 * returns [minLng, minLat, maxLng, maxLat]
 */
export const computeBbox = (coordinates) => {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coordinates) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
};

/**
 * Ray-casting point-in-polygon
 * point: [lng, lat], polygon: [[lng, lat], ...]
 */
export const pointInPolygon = (point, polygon) => {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

/**
 * Check if a run route (LineString) passes through a territory polygon
 * runCoords: [[lng, lat], ...], territoryRing: [[lng, lat], ...]
 */
export const runIntersectsTerritory = (runCoords, territoryRing) => {
  return runCoords.some((point) => pointInPolygon(point, territoryRing));
};