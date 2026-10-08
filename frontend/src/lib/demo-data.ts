export type Village = {
  id: string;
  name: string;
  district: string;
  block: string;
  coverage: number;
  pending: number;
  priority: "High" | "Medium";
  services: { name: string; coverage: number }[];
  latitude: number;
  longitude: number;
};

export const villages: Village[] = [
  {
    id: "MAN-BIS-01-002",
    name: "Bishnupur Demo Village 002",
    district: "Bishnupur",
    block: "Bishnupur",
    coverage: 67,
    pending: 5,
    priority: "High",
    services: [
      { name: "Housing", coverage: 72 },
      { name: "Healthcare", coverage: 63 },
      { name: "Drinking water", coverage: 59 },
      { name: "Welfare", coverage: 74 },
    ],
    latitude: 24.63,
    longitude: 93.78,
  },
  {
    id: "MAN-BIS-01-004",
    name: "Bishnupur Demo Village 004",
    district: "Bishnupur",
    block: "Bishnupur",
    coverage: 78,
    pending: 36,
    priority: "High",
    services: [
      { name: "Housing", coverage: 79 },
      { name: "Healthcare", coverage: 75 },
      { name: "Drinking water", coverage: 69 },
      { name: "Welfare", coverage: 89 },
    ],
    latitude: 24.65,
    longitude: 93.8,
  },
  {
    id: "MAN-CCP-02-018",
    name: "Churachandpur Demo Village 018",
    district: "Churachandpur",
    block: "Churachandpur",
    coverage: 61,
    pending: 29,
    priority: "High",
    services: [
      { name: "Housing", coverage: 65 },
      { name: "Healthcare", coverage: 56 },
      { name: "Drinking water", coverage: 49 },
      { name: "Welfare", coverage: 74 },
    ],
    latitude: 24.33,
    longitude: 93.68,
  },
  {
    id: "MAN-IE-03-007",
    name: "Imphal East Demo Village 007",
    district: "Imphal East",
    block: "Keirao",
    coverage: 73,
    pending: 14,
    priority: "Medium",
    services: [
      { name: "Housing", coverage: 78 },
      { name: "Healthcare", coverage: 67 },
      { name: "Drinking water", coverage: 68 },
      { name: "Welfare", coverage: 79 },
    ],
    latitude: 24.82,
    longitude: 93.98,
  },
  {
    id: "MAN-SNP-04-021",
    name: "Senapati Demo Village 021",
    district: "Senapati",
    block: "Saitu",
    coverage: 69,
    pending: 22,
    priority: "Medium",
    services: [
      { name: "Housing", coverage: 76 },
      { name: "Healthcare", coverage: 61 },
      { name: "Drinking water", coverage: 58 },
      { name: "Welfare", coverage: 81 },
    ],
    latitude: 25.28,
    longitude: 94.02,
  },
  {
    id: "MAN-IE-03-012",
    name: "Imphal East Demo Village 012",
    district: "Imphal East",
    block: "Keirao",
    coverage: 82,
    pending: 8,
    priority: "Medium",
    services: [
      { name: "Housing", coverage: 86 },
      { name: "Healthcare", coverage: 78 },
      { name: "Drinking water", coverage: 76 },
      { name: "Welfare", coverage: 88 },
    ],
    latitude: 24.79,
    longitude: 93.94,
  },
];

export const districts = [
  { name: "Churachandpur", coverage: 61, villages: 42, gap: 38 },
  { name: "Senapati", coverage: 66, villages: 36, gap: 32 },
  { name: "Bishnupur", coverage: 69, villages: 31, gap: 28 },
  { name: "Imphal East", coverage: 75, villages: 24, gap: 21 },
];

export const riskAreas = [
  {
    name: "Churachandpur",
    center: [24.33, 93.68] as [number, number],
    radiusMeters: 19000,
    risk: "High" as const,
    coverage: 61,
    villages: 42,
    gap: 38,
    mainGap: "Drinking water",
    pending: 29,
  },
  {
    name: "Senapati",
    center: [25.28, 94.02] as [number, number],
    radiusMeters: 22000,
    risk: "High" as const,
    coverage: 66,
    villages: 36,
    gap: 32,
    mainGap: "Healthcare",
    pending: 22,
  },
  {
    name: "Bishnupur",
    center: [24.64, 93.79] as [number, number],
    radiusMeters: 15000,
    risk: "Moderate" as const,
    coverage: 69,
    villages: 31,
    gap: 28,
    mainGap: "Drinking water",
    pending: 41,
  },
  {
    name: "Imphal East",
    center: [24.81, 93.96] as [number, number],
    radiusMeters: 17000,
    risk: "Lower" as const,
    coverage: 75,
    villages: 24,
    gap: 21,
    mainGap: "Healthcare",
    pending: 22,
  },
];

export const serviceCoverage = [
  { label: "Housing", value: 76, color: "#6274ed" },
  { label: "Healthcare", value: 68, color: "#54a1eb" },
  { label: "Drinking water", value: 59, color: "#3fb6a4" },
  { label: "Welfare", value: 82, color: "#9a7be7" },
];

export const alerts = [
  {
    id: "ALT-2025-041",
    priority: "High",
    category: "Drinking water",
    title: "Low water coverage in Churachandpur",
    description:
      "Sample data indicates drinking water coverage below 50% in 8 monitored villages.",
    location: "Churachandpur · 8 villages",
    time: "2 hours ago",
  },
  {
    id: "ALT-2025-039",
    priority: "High",
    category: "Healthcare",
    title: "Growing number of unresolved health cases",
    description:
      "Pending cases have increased across sample villages in Senapati district.",
    location: "Senapati · 12 villages",
    time: "5 hours ago",
  },
  {
    id: "ALT-2025-035",
    priority: "Medium",
    category: "Welfare",
    title: "Welfare enrollment gap detected",
    description:
      "A potential enrollment gap was detected in the Bishnupur demo snapshot.",
    location: "Bishnupur · 6 villages",
    time: "Yesterday",
  },
];
