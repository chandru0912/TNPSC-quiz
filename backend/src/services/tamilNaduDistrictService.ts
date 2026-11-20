export interface TamilNaduDistrictDef {
  id: string;
  name: string;
  aliases: string[];
  lat: number;
  lng: number;
  /** Administrative approximate boundary polygon in [lng, lat] pairs */
  polygon: [number, number][];
}

export interface DistrictDetectionResult {
  districtId: string | null;
  districtName: string | null;
  locationStatus: 'detected' | 'outside_tamil_nadu' | 'inaccurate';
  accuracyCategory: 'high' | 'medium' | 'moderate' | 'low' | null;
}

// Coarse outer polygon covering Tamil Nadu mainland + coastal islands ([lng, lat])
const TAMIL_NADU_STATE_POLYGON: [number, number][] = [
  [76.22, 11.45],
  [76.55, 11.75],
  [77.05, 11.82],
  [77.62, 12.15],
  [77.78, 12.75],
  [78.28, 12.92],
  [78.72, 13.05],
  [79.25, 13.28],
  [79.88, 13.56],
  [80.35, 13.42],
  [80.34, 12.95],
  [80.22, 12.50],
  [80.02, 12.10],
  [79.88, 11.55],
  [79.92, 10.95],
  [79.90, 10.28],
  [79.42, 9.95],
  [79.35, 9.25],
  [78.82, 9.10],
  [78.22, 8.75],
  [78.15, 8.38],
  [77.56, 8.07],
  [77.10, 8.28],
  [77.22, 8.88],
  [77.28, 9.48],
  [77.18, 10.15],
  [76.82, 10.55],
  [76.62, 10.95],
  [76.22, 11.45],
];

// Build a clean hexagonal/octagonal administrative boundary around each district's geographic core
function makeDistrictPolygon(
  lat: number,
  lng: number,
  dLat: number,
  dLng: number
): [number, number][] {
  return [
    [lng - dLng, lat - dLat * 0.45],
    [lng - dLng * 0.45, lat - dLat],
    [lng + dLng * 0.45, lat - dLat],
    [lng + dLng, lat - dLat * 0.45],
    [lng + dLng, lat + dLat * 0.45],
    [lng + dLng * 0.45, lat + dLat],
    [lng - dLng * 0.45, lat + dLat],
    [lng - dLng, lat + dLat * 0.45],
  ];
}

// All 38 official administrative districts of Tamil Nadu
export const TAMIL_NADU_38_DISTRICTS: TamilNaduDistrictDef[] = [
  { id: 'ariyalur', name: 'Ariyalur', aliases: ['ariyalur'], lat: 11.14, lng: 79.08, polygon: makeDistrictPolygon(11.14, 79.08, 0.24, 0.28) },
  { id: 'chengalpattu', name: 'Chengalpattu', aliases: ['chengalpattu', 'chengalpet'], lat: 12.69, lng: 79.98, polygon: makeDistrictPolygon(12.69, 79.98, 0.25, 0.26) },
  { id: 'chennai', name: 'Chennai', aliases: ['chennai', 'madras'], lat: 13.08, lng: 80.27, polygon: makeDistrictPolygon(13.08, 80.27, 0.16, 0.16) },
  { id: 'coimbatore', name: 'Coimbatore', aliases: ['coimbatore', 'kovai'], lat: 11.01, lng: 76.96, polygon: makeDistrictPolygon(11.01, 76.96, 0.34, 0.28) },
  { id: 'cuddalore', name: 'Cuddalore', aliases: ['cuddalore'], lat: 11.75, lng: 79.77, polygon: makeDistrictPolygon(11.75, 79.77, 0.28, 0.30) },
  { id: 'dharmapuri', name: 'Dharmapuri', aliases: ['dharmapuri'], lat: 12.13, lng: 78.16, polygon: makeDistrictPolygon(12.13, 78.16, 0.32, 0.32) },
  { id: 'dindigul', name: 'Dindigul', aliases: ['dindigul'], lat: 10.37, lng: 77.98, polygon: makeDistrictPolygon(10.37, 77.98, 0.34, 0.36) },
  { id: 'erode', name: 'Erode', aliases: ['erode'], lat: 11.34, lng: 77.72, polygon: makeDistrictPolygon(11.34, 77.72, 0.36, 0.36) },
  { id: 'kallakurichi', name: 'Kallakurichi', aliases: ['kallakurichi'], lat: 11.74, lng: 78.96, polygon: makeDistrictPolygon(11.74, 78.96, 0.28, 0.30) },
  { id: 'kancheepuram', name: 'Kancheepuram', aliases: ['kancheepuram', 'kanchipuram'], lat: 12.83, lng: 79.70, polygon: makeDistrictPolygon(12.83, 79.70, 0.22, 0.24) },
  { id: 'kanniyakumari', name: 'Kanniyakumari', aliases: ['kanniyakumari', 'kanyakumari', 'nagercoil'], lat: 8.18, lng: 77.41, polygon: makeDistrictPolygon(8.18, 77.41, 0.22, 0.26) },
  { id: 'karur', name: 'Karur', aliases: ['karur'], lat: 10.96, lng: 78.08, polygon: makeDistrictPolygon(10.96, 78.08, 0.24, 0.28) },
  { id: 'krishnagiri', name: 'Krishnagiri', aliases: ['krishnagiri', 'hosur'], lat: 12.52, lng: 78.21, polygon: makeDistrictPolygon(12.52, 78.21, 0.34, 0.36) },
  { id: 'madurai', name: 'Madurai', aliases: ['madurai'], lat: 9.93, lng: 78.12, polygon: makeDistrictPolygon(9.93, 78.12, 0.26, 0.30) },
  { id: 'mayiladuthurai', name: 'Mayiladuthurai', aliases: ['mayiladuthurai', 'mayavaram'], lat: 11.10, lng: 79.65, polygon: makeDistrictPolygon(11.10, 79.65, 0.20, 0.22) },
  { id: 'nagapattinam', name: 'Nagapattinam', aliases: ['nagapattinam'], lat: 10.77, lng: 79.84, polygon: makeDistrictPolygon(10.77, 79.84, 0.24, 0.20) },
  { id: 'namakkal', name: 'Namakkal', aliases: ['namakkal'], lat: 11.22, lng: 78.17, polygon: makeDistrictPolygon(11.22, 78.17, 0.24, 0.28) },
  { id: 'nilgiris', name: 'Nilgiris', aliases: ['nilgiris', 'the nilgiris', 'ooty', 'udhagamandalam'], lat: 11.41, lng: 76.70, polygon: makeDistrictPolygon(11.41, 76.70, 0.26, 0.30) },
  { id: 'perambalur', name: 'Perambalur', aliases: ['perambalur'], lat: 11.23, lng: 78.88, polygon: makeDistrictPolygon(11.23, 78.88, 0.20, 0.22) },
  { id: 'pudukkottai', name: 'Pudukkottai', aliases: ['pudukkottai', 'pudukottai'], lat: 10.38, lng: 78.82, polygon: makeDistrictPolygon(10.38, 78.82, 0.30, 0.34) },
  { id: 'ramanathapuram', name: 'Ramanathapuram', aliases: ['ramanathapuram', 'ramnad'], lat: 9.37, lng: 78.83, polygon: makeDistrictPolygon(9.37, 78.83, 0.30, 0.42) },
  { id: 'ranipet', name: 'Ranipet', aliases: ['ranipet', 'ranipettai'], lat: 12.93, lng: 79.33, polygon: makeDistrictPolygon(12.93, 79.33, 0.22, 0.22) },
  { id: 'salem', name: 'Salem', aliases: ['salem'], lat: 11.66, lng: 78.15, polygon: makeDistrictPolygon(11.66, 78.15, 0.30, 0.34) },
  { id: 'sivaganga', name: 'Sivaganga', aliases: ['sivaganga', 'sivagangai'], lat: 9.85, lng: 78.48, polygon: makeDistrictPolygon(9.85, 78.48, 0.28, 0.32) },
  { id: 'tenkasi', name: 'Tenkasi', aliases: ['tenkasi'], lat: 8.96, lng: 77.31, polygon: makeDistrictPolygon(8.96, 77.31, 0.26, 0.24) },
  { id: 'thanjavur', name: 'Thanjavur', aliases: ['thanjavur', 'tanjore'], lat: 10.79, lng: 79.14, polygon: makeDistrictPolygon(10.79, 79.14, 0.28, 0.30) },
  { id: 'theni', name: 'Theni', aliases: ['theni'], lat: 10.01, lng: 77.48, polygon: makeDistrictPolygon(10.01, 77.48, 0.28, 0.26) },
  { id: 'thoothukudi', name: 'Thoothukudi', aliases: ['thoothukudi', 'tuticorin'], lat: 8.76, lng: 78.13, polygon: makeDistrictPolygon(8.76, 78.13, 0.34, 0.28) },
  { id: 'tiruchirappalli', name: 'Tiruchirappalli', aliases: ['tiruchirappalli', 'trichy', 'tiruchirapalli'], lat: 10.79, lng: 78.70, polygon: makeDistrictPolygon(10.79, 78.70, 0.30, 0.30) },
  { id: 'tirunelveli', name: 'Tirunelveli', aliases: ['tirunelveli', 'nellai'], lat: 8.71, lng: 77.76, polygon: makeDistrictPolygon(8.71, 77.76, 0.32, 0.30) },
  { id: 'tirupathur', name: 'Tirupathur', aliases: ['tirupathur', 'tirupattur'], lat: 12.50, lng: 78.57, polygon: makeDistrictPolygon(12.50, 78.57, 0.24, 0.24) },
  { id: 'tiruppur', name: 'Tiruppur', aliases: ['tiruppur', 'tirupur'], lat: 11.11, lng: 77.34, polygon: makeDistrictPolygon(11.11, 77.34, 0.30, 0.28) },
  { id: 'tiruvallur', name: 'Tiruvallur', aliases: ['tiruvallur', 'thiruvallur'], lat: 13.14, lng: 79.91, polygon: makeDistrictPolygon(13.14, 79.91, 0.26, 0.28) },
  { id: 'tiruvannamalai', name: 'Tiruvannamalai', aliases: ['tiruvannamalai', 'thiruvannamalai'], lat: 12.23, lng: 79.07, polygon: makeDistrictPolygon(12.23, 79.07, 0.34, 0.34) },
  { id: 'tiruvarur', name: 'Tiruvarur', aliases: ['tiruvarur', 'thiruvarur'], lat: 10.77, lng: 79.64, polygon: makeDistrictPolygon(10.77, 79.64, 0.22, 0.22) },
  { id: 'vellore', name: 'Vellore', aliases: ['vellore'], lat: 12.92, lng: 79.13, polygon: makeDistrictPolygon(12.92, 79.13, 0.22, 0.22) },
  { id: 'viluppuram', name: 'Viluppuram', aliases: ['viluppuram', 'villupuram'], lat: 11.94, lng: 79.49, polygon: makeDistrictPolygon(11.94, 79.49, 0.28, 0.30) },
  { id: 'virudhunagar', name: 'Virudhunagar', aliases: ['virudhunagar', 'sivakasi'], lat: 9.59, lng: 77.96, polygon: makeDistrictPolygon(9.59, 77.96, 0.28, 0.34) },
];

export function isPointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function classifyGpsAccuracy(
  accuracyMeters?: number | null
): 'high' | 'medium' | 'moderate' | 'low' | null {
  if (accuracyMeters === undefined || accuracyMeters === null || Number.isNaN(Number(accuracyMeters))) {
    return null;
  }
  const acc = Number(accuracyMeters);
  if (acc <= 500) return 'high';
  if (acc <= 5000) return 'medium';
  if (acc <= 25000) return 'moderate';
  return 'low';
}

export function normalizeTamilNaduDistrict(raw?: string | null): TamilNaduDistrictDef | null {
  const clean = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\bdistrict\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return null;

  for (const d of TAMIL_NADU_38_DISTRICTS) {
    if (d.id === clean || d.name.toLowerCase() === clean || d.aliases.includes(clean)) {
      return d;
    }
  }
  return null;
}

/**
 * Detects which of the 38 Tamil Nadu districts a GPS coordinate falls inside.
 * - Rejects coarse/inaccurate GPS (> 25 km accuracy) without claiming a district.
 * - Rejects coordinates outside Tamil Nadu state boundary.
 * - Uses polygon containment first; among overlapping boundary polygons, selects closest district centroid.
 */
export function detectTamilNaduDistrict(
  latitude: number,
  longitude: number,
  accuracyMeters?: number | null
): DistrictDetectionResult {
  const accuracyCategory = classifyGpsAccuracy(accuracyMeters);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return {
      districtId: null,
      districtName: null,
      locationStatus: 'inaccurate',
      accuracyCategory: 'low',
    };
  }

  if (accuracyCategory === 'low') {
    return {
      districtId: null,
      districtName: null,
      locationStatus: 'inaccurate',
      accuracyCategory: 'low',
    };
  }

  // Strict outer bounding box + polygon check for Tamil Nadu state
  if (
    latitude < 8.05 ||
    latitude > 13.60 ||
    longitude < 76.20 ||
    longitude > 80.38 ||
    !isPointInPolygon(latitude, longitude, TAMIL_NADU_STATE_POLYGON)
  ) {
    return {
      districtId: null,
      districtName: null,
      locationStatus: 'outside_tamil_nadu',
      accuracyCategory,
    };
  }

  // 1. Check exact district polygon containment
  const containing = TAMIL_NADU_38_DISTRICTS.filter((d) =>
    isPointInPolygon(latitude, longitude, d.polygon)
  );

  if (containing.length === 1) {
    return {
      districtId: containing[0].id,
      districtName: containing[0].name,
      locationStatus: 'detected',
      accuracyCategory,
    };
  }

  // If near a shared boundary or gap inside Tamil Nadu state polygon, resolve to closest district within 65 km
  const candidates = containing.length > 1 ? containing : TAMIL_NADU_38_DISTRICTS;
  let best: TamilNaduDistrictDef | null = null;
  let bestDist = Infinity;
  for (const d of candidates) {
    const dist = haversineKm(latitude, longitude, d.lat, d.lng);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }

  if (best && bestDist <= 65) {
    return {
      districtId: best.id,
      districtName: best.name,
      locationStatus: 'detected',
      accuracyCategory,
    };
  }

  return {
    districtId: null,
    districtName: null,
    locationStatus: 'outside_tamil_nadu',
    accuracyCategory,
  };
}
