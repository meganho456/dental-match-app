export type AvailSlot = 'full' | 'am' | 'pm' | 'off';

export interface MockAvailability {
  MON: AvailSlot; TUE: AvailSlot; WED: AvailSlot; THU: AvailSlot;
  FRI: AvailSlot; SAT: AvailSlot; SUN: AvailSlot;
}

export interface MockJobCard {
  id: string;
  type: 'TEMP' | 'PERMANENT';
  clinicName: string;
  address: string;
  city: string;
  state: string;
  country?: string;
  hourlyRate: number;
  requiredTier: 'RDA' | 'DA' | null;
  software: string[];
  shiftDate?: string;
  shiftHours?: string;
  shiftDuration?: string;
  description: string;
  slots?: number;
  accentColor: string;
}

export interface MockAssistantCard {
  id: string;
  displayName: string;
  initials: string;
  accentColor: string;
  tier: 'RDA' | 'DA';
  yearsExp: number;
  hourlyRate: number;
  travelRadius: number;
  software: string[];
  availability: MockAvailability;
  openToPermanent: boolean;
  bio: string;
}

const SOFTWARE_LABELS: Record<string, string> = {
  OPEN_DENTAL: 'Open Dental',
  DENTRIX: 'Dentrix',
  EAGLESOFT: 'Eaglesoft',
  CURVE_DENTAL: 'Curve',
  CARESTREAM: 'Carestream',
  OTHER: 'Other',
};

export function softwareLabel(s: string) {
  return SOFTWARE_LABELS[s] ?? s;
}

// ── 10 Job Cards (Assistant View) ────────────────────────────────────────────

export const MOCK_JOB_CARDS: MockJobCard[] = [
  {
    id: 'j1',
    type: 'TEMP',
    clinicName: 'Pacific Coast Dental Group',
    address: '4521 Pacific Coast Hwy',
    city: 'Malibu',
    state: 'CA',
    hourlyRate: 32,
    requiredTier: 'RDA',
    software: ['DENTRIX', 'OPEN_DENTAL'],
    shiftDate: 'Sat, Jun 7',
    shiftHours: '8:00 AM – 2:00 PM',
    shiftDuration: '6 hrs',
    description: 'Busy Saturday morning for a high-end cosmetic practice. Chairside assist with veneers & Invisalign.',
    accentColor: '#f97316',
  },
  {
    id: 'j2',
    type: 'PERMANENT',
    clinicName: 'Downtown Smile Studio',
    address: '200 N Michigan Ave, Suite 1400',
    city: 'Chicago',
    state: 'IL',
    hourlyRate: 38,
    requiredTier: 'RDA',
    software: ['OPEN_DENTAL'],
    description: 'Join our award-winning team in the heart of the Loop. Modern facility, strong mentorship, real career growth.',
    accentColor: '#22c55e',
  },
  {
    id: 'j3',
    type: 'TEMP',
    clinicName: "Sunshine Kids Dentistry",
    address: '812 Bowie St',
    city: 'Austin',
    state: 'TX',
    hourlyRate: 28,
    requiredTier: 'DA',
    software: ['EAGLESOFT'],
    shiftDate: 'Sun, Jun 8',
    shiftHours: '9:00 AM – 1:00 PM',
    shiftDuration: '4 hrs',
    description: 'Pediatric clinic needs an energetic DA for a Sunday pop-up. Great with kids? This one is for you.',
    accentColor: '#f97316',
  },
  {
    id: 'j4',
    type: 'PERMANENT',
    clinicName: 'Prestige Oral Surgery',
    address: '500 Park Ave',
    city: 'New York',
    state: 'NY',
    hourlyRate: 48,
    requiredTier: 'RDA',
    software: ['CURVE_DENTAL', 'DENTRIX'],
    description: 'Elite oral surgery group seeking a seasoned RDA. Implants, extractions, full surgical suite. Top-tier comp.',
    accentColor: '#6366f1',
  },
  {
    id: 'j5',
    type: 'TEMP',
    clinicName: 'Bay Area Family Dental',
    address: '1 Ferry Building, Suite 220',
    city: 'San Francisco',
    state: 'CA',
    hourlyRate: 37,
    requiredTier: null,
    software: ['DENTRIX'],
    shiftDate: 'Fri, Jun 6',
    shiftHours: '7:00 AM – 1:00 PM',
    shiftDuration: '6 hrs',
    description: 'Friday morning general coverage. Any tier welcome. Waterfront views from the chair — not a bad way to spend a Friday.',
    accentColor: '#f97316',
  },
  {
    id: 'j6',
    type: 'PERMANENT',
    clinicName: 'Orchard Road Dental Clinic',
    address: '1 Orchard Road, #04-01',
    city: 'Orchard',
    state: '',
    country: 'SG',
    hourlyRate: 42,
    requiredTier: 'RDA',
    software: ['OPEN_DENTAL'],
    description: 'Expanding Singapore practice seeks an RDA for a full-time perm role. Expat package available. Mandarin a plus.',
    accentColor: '#22c55e',
  },
  {
    id: 'j7',
    type: 'TEMP',
    clinicName: 'Rocky Mountain Dental',
    address: '1700 Lincoln St',
    city: 'Denver',
    state: 'CO',
    hourlyRate: 30,
    requiredTier: 'DA',
    software: ['OPEN_DENTAL'],
    shiftDate: 'Sat, Jun 7',
    shiftHours: '2:00 PM – 8:00 PM',
    shiftDuration: '6 hrs',
    description: 'Afternoon/evening temp shift for a growing neighborhood practice. Easy cases, great team energy.',
    accentColor: '#f97316',
  },
  {
    id: 'j8',
    type: 'PERMANENT',
    clinicName: 'Sunshine Orthodontics',
    address: '901 Brickell Ave',
    city: 'Miami',
    state: 'FL',
    hourlyRate: 36,
    requiredTier: 'RDA',
    software: ['DENTRIX'],
    description: 'Fast-growing ortho practice seeking a permanent RDA. Invisalign & traditional braces. Spanish fluency a plus.',
    accentColor: '#22c55e',
  },
  {
    id: 'j9',
    type: 'TEMP',
    clinicName: 'Harbor View Dental',
    address: '1201 Western Ave',
    city: 'Seattle',
    state: 'WA',
    hourlyRate: 34,
    requiredTier: 'RDA',
    software: ['CARESTREAM'],
    shiftDate: 'Thu, Jun 5',
    shiftHours: '9:00 AM – 3:00 PM',
    shiftDuration: '6 hrs',
    description: 'Waterfront practice needs an RDA for Thursday coverage. Digital X-ray experience helpful.',
    accentColor: '#f97316',
  },
  {
    id: 'j10',
    type: 'PERMANENT',
    clinicName: 'Desert Bloom Family Dental',
    address: '2020 E Camelback Rd',
    city: 'Phoenix',
    state: 'AZ',
    hourlyRate: 33,
    requiredTier: 'DA',
    software: ['OPEN_DENTAL', 'EAGLESOFT'],
    description: 'Busy family practice with a welcoming culture. Seeking a reliable DA ready to grow into an RDA role.',
    accentColor: '#22c55e',
  },
];

// ── 10 Assistant Cards (Clinic View) ─────────────────────────────────────────

export const MOCK_ASSISTANT_CARDS: MockAssistantCard[] = [
  {
    id: 'a1',
    displayName: 'Jordan M.',
    initials: 'JM',
    accentColor: '#8b5cf6',
    tier: 'RDA',
    yearsExp: 4,
    hourlyRate: 30,
    travelRadius: 15,
    software: ['OPEN_DENTAL', 'DENTRIX'],
    availability: { MON: 'full', TUE: 'full', WED: 'off', THU: 'full', FRI: 'full', SAT: 'off', SUN: 'off' },
    openToPermanent: true,
    bio: 'Specializes in cosmetic and pediatric chairside work. Known for calm demeanor with anxious patients.',
  },
  {
    id: 'a2',
    displayName: 'Casey L.',
    initials: 'CL',
    accentColor: '#06b6d4',
    tier: 'DA',
    yearsExp: 2,
    hourlyRate: 24,
    travelRadius: 10,
    software: ['EAGLESOFT'],
    availability: { MON: 'am', TUE: 'am', WED: 'am', THU: 'am', FRI: 'am', SAT: 'off', SUN: 'off' },
    openToPermanent: false,
    bio: 'Part-time availability mornings only. Dental school student — meticulous, eager to learn every procedure.',
  },
  {
    id: 'a3',
    displayName: 'Taylor R.',
    initials: 'TR',
    accentColor: '#f43f5e',
    tier: 'RDA',
    yearsExp: 7,
    hourlyRate: 40,
    travelRadius: 20,
    software: ['DENTRIX', 'CARESTREAM', 'CURVE_DENTAL'],
    availability: { MON: 'full', TUE: 'off', WED: 'full', THU: 'off', FRI: 'full', SAT: 'am', SUN: 'off' },
    openToPermanent: true,
    bio: 'Multi-software veteran comfortable in any specialty — ortho, endo, oral surgery. Fast learner, zero drama.',
  },
  {
    id: 'a4',
    displayName: 'Morgan S.',
    initials: 'MS',
    accentColor: '#10b981',
    tier: 'RDA',
    yearsExp: 3,
    hourlyRate: 28,
    travelRadius: 5,
    software: ['OPEN_DENTAL'],
    availability: { MON: 'off', TUE: 'full', WED: 'off', THU: 'full', FRI: 'off', SAT: 'full', SUN: 'off' },
    openToPermanent: false,
    bio: 'Tue/Thu/Sat availability. Prefers general practice, excellent with patients, strong infection control habits.',
  },
  {
    id: 'a5',
    displayName: 'Avery K.',
    initials: 'AK',
    accentColor: '#f59e0b',
    tier: 'DA',
    yearsExp: 1,
    hourlyRate: 22,
    travelRadius: 8,
    software: ['OPEN_DENTAL'],
    availability: { MON: 'full', TUE: 'full', WED: 'full', THU: 'full', FRI: 'full', SAT: 'off', SUN: 'off' },
    openToPermanent: true,
    bio: 'New grad, M–F fully available. Enthusiastic and quick to pick up new workflows. Bilingual: English & Spanish.',
  },
  {
    id: 'a6',
    displayName: 'Riley B.',
    initials: 'RB',
    accentColor: '#6366f1',
    tier: 'RDA',
    yearsExp: 10,
    hourlyRate: 45,
    travelRadius: 25,
    software: ['DENTRIX', 'CURVE_DENTAL', 'OPEN_DENTAL', 'EAGLESOFT'],
    availability: { MON: 'off', TUE: 'off', WED: 'full', THU: 'off', FRI: 'full', SAT: 'am', SUN: 'off' },
    openToPermanent: false,
    bio: 'Decade of experience across 4 platforms. Certified in nitrous and digital impressions. Wed, Fri, Sat AM only.',
  },
  {
    id: 'a7',
    displayName: 'Jamie P.',
    initials: 'JP',
    accentColor: '#0ea5e9',
    tier: 'DA',
    yearsExp: 5,
    hourlyRate: 26,
    travelRadius: 12,
    software: ['EAGLESOFT', 'OPEN_DENTAL'],
    availability: { MON: 'full', TUE: 'full', WED: 'full', THU: 'off', FRI: 'off', SAT: 'off', SUN: 'off' },
    openToPermanent: true,
    bio: 'Monday–Wednesday fully available. Experienced in front/back office crossover. Organized, punctual, reliable.',
  },
  {
    id: 'a8',
    displayName: 'Quinn H.',
    initials: 'QH',
    accentColor: '#ec4899',
    tier: 'RDA',
    yearsExp: 6,
    hourlyRate: 35,
    travelRadius: 30,
    software: ['CARESTREAM', 'DENTRIX'],
    availability: { MON: 'full', TUE: 'full', WED: 'full', THU: 'full', FRI: 'full', SAT: 'off', SUN: 'off' },
    openToPermanent: true,
    bio: 'Full M–F availability, wide travel radius, open to permanent. Experienced in endo and implant assist. Top performer.',
  },
  {
    id: 'a9',
    displayName: 'Alex C.',
    initials: 'AC',
    accentColor: '#14b8a6',
    tier: 'DA',
    yearsExp: 3,
    hourlyRate: 25,
    travelRadius: 7,
    software: ['OPEN_DENTAL'],
    availability: { MON: 'off', TUE: 'full', WED: 'full', THU: 'full', FRI: 'full', SAT: 'off', SUN: 'off' },
    openToPermanent: false,
    bio: 'Tue–Fri availability. Calm under pressure, great tray setup, ready to jump into any GA or pedo practice.',
  },
  {
    id: 'a10',
    displayName: 'Sam W.',
    initials: 'SW',
    accentColor: '#a855f7',
    tier: 'RDA',
    yearsExp: 8,
    hourlyRate: 42,
    travelRadius: 20,
    software: ['OPEN_DENTAL', 'DENTRIX', 'EAGLESOFT', 'CARESTREAM'],
    availability: { MON: 'full', TUE: 'off', WED: 'full', THU: 'full', FRI: 'off', SAT: 'full', SUN: 'off' },
    openToPermanent: true,
    bio: '8-year RDA veteran fluent in 4 platforms. Available Mon/Wed/Thu/Sat. Excellent references, seeks perm home.',
  },
];
