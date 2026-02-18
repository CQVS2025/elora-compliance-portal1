// Dummy data for Washout Compliance Demo - BORAL QLD only

export const BORAL_QLD_VEHICLES = [
  {
    vehicleId: 'AGI-147',
    driver: 'M. Thompson',
    site: 'Coopers Plains',
    lastWashout: '2026-02-16T06:42:00',
    wesScore: 94,
    waterVolume: 340,
    drumRPM: 10.2,
    endNTU: 32,
    buildupRisk: 'Low',
    dedagETA: null,
    status: 'Compliant',
    rfidTag: '06038804529e85',
    internalId: '147',
    vehicleReference: '2020081500847265S1',
    washesThisMonth: 14,
    targetWashes: 16,
    progress: 87.5,
    avgTemp: 28.5,
    avgDuration: 92,
    avgWESScore: 92.3,
    estimatedBuildup: null,
    monthlyBuildupRate: null,
    estimatedCost: null,
    washHistory: [
      {
        date: '2026-02-16T06:42:00',
        site: 'Coopers Plains',
        device: 'BOR-QLD-CP',
        waterL: 340,
        drumRPM: 10.2,
        duration: '95s',
        endNTU: 32,
        wesScore: 94,
        mixType: '32 MPa',
        status: 'Excellent'
      },
      {
        date: '2026-02-15T05:18:00',
        site: 'Coopers Plains',
        device: 'BOR-QLD-CP',
        waterL: 340,
        drumRPM: 10.5,
        duration: '93s',
        endNTU: 28,
        wesScore: 95,
        mixType: '25 MPa',
        status: 'Excellent'
      },
      {
        date: '2026-02-14T07:22:00',
        site: 'Coopers Plains',
        device: 'BOR-QLD-CP',
        waterL: 340,
        drumRPM: 9.8,
        duration: '89s',
        endNTU: 38,
        wesScore: 91,
        mixType: '40 MPa',
        status: 'Excellent'
      }
    ]
  },
  {
    vehicleId: 'AGI-203',
    driver: 'S. Williams',
    site: 'Murarrie',
    lastWashout: '2026-02-16T05:18:00',
    wesScore: 78,
    waterVolume: 340,
    drumRPM: 9.4,
    endNTU: 88,
    buildupRisk: 'Med',
    dedagETA: '6+ mo',
    status: 'Acceptable',
    rfidTag: '06038804529e03',
    internalId: '203',
    vehicleReference: '2020081500847203S1',
    washesThisMonth: 12,
    targetWashes: 16,
    progress: 75,
    avgTemp: 29.2,
    avgDuration: 85,
    avgWESScore: 79.1,
    estimatedBuildup: 180,
    monthlyBuildupRate: 15,
    estimatedCost: null,
    washHistory: [
      {
        date: '2026-02-16T05:18:00',
        site: 'Murarrie',
        device: 'BOR-QLD-MUR',
        waterL: 340,
        drumRPM: 9.4,
        duration: '82s',
        endNTU: 88,
        wesScore: 78,
        mixType: '32 MPa',
        status: 'Acceptable'
      },
      {
        date: '2026-02-15T06:45:00',
        site: 'Murarrie',
        device: 'BOR-QLD-MUR',
        waterL: 340,
        drumRPM: 9.1,
        duration: '84s',
        endNTU: 92,
        wesScore: 76,
        mixType: '25 MPa',
        status: 'Acceptable'
      }
    ]
  },
  {
    vehicleId: 'AGI-156',
    driver: 'R. Patel',
    site: 'Bundall',
    lastWashout: '2026-02-16T04:55:00',
    wesScore: 91,
    waterVolume: 340,
    drumRPM: 11.0,
    endNTU: 28,
    buildupRisk: 'Low',
    dedagETA: null,
    status: 'Compliant',
    rfidTag: '06038804529e56',
    internalId: '156',
    vehicleReference: '2020081500847156S1',
    washesThisMonth: 15,
    targetWashes: 16,
    progress: 93.75,
    avgTemp: 27.8,
    avgDuration: 94,
    avgWESScore: 90.8,
    estimatedBuildup: null,
    monthlyBuildupRate: null,
    estimatedCost: null,
    washHistory: [
      {
        date: '2026-02-16T04:55:00',
        site: 'Bundall',
        device: 'BOR-QLD-BUN',
        waterL: 340,
        drumRPM: 11.0,
        duration: '96s',
        endNTU: 28,
        wesScore: 91,
        mixType: '25 MPa',
        status: 'Excellent'
      }
    ]
  },
  {
    vehicleId: 'AGI-089',
    driver: 'D. Brown',
    site: 'Biggera Waters',
    lastWashout: '2026-02-15T17:03:00',
    wesScore: 54,
    waterVolume: 340,
    drumRPM: 6.1,
    endNTU: 340,
    buildupRisk: 'High',
    dedagETA: '23 days',
    status: 'Marginal',
    rfidTag: '06038804529e89',
    internalId: '89',
    vehicleReference: '2020081500847089S1',
    washesThisMonth: 8,
    targetWashes: 16,
    progress: 50,
    avgTemp: 31.4,
    avgDuration: 68,
    avgWESScore: 54.2,
    estimatedBuildup: 420,
    monthlyBuildupRate: 52,
    estimatedCost: 8600,
    washHistory: [
      {
        date: '2026-02-15T17:03:00',
        site: 'Biggera Waters',
        device: 'BOR-QLD-BGW',
        waterL: 340,
        drumRPM: 6.1,
        duration: '48s',
        endNTU: 340,
        wesScore: 54,
        mixType: '40 MPa',
        status: 'Marginal'
      },
      {
        date: '2026-02-14T16:12:00',
        site: 'Biggera Waters',
        device: 'BOR-QLD-BGW',
        waterL: 340,
        drumRPM: 8.2,
        duration: '72s',
        endNTU: 210,
        wesScore: 61,
        mixType: '32 MPa',
        status: 'Marginal'
      },
      {
        date: '2026-02-13T15:48:00',
        site: 'Biggera Waters',
        device: 'BOR-QLD-BGW',
        waterL: 340,
        drumRPM: 9.0,
        duration: '85s',
        endNTU: 145,
        wesScore: 71,
        mixType: '25 MPa',
        status: 'Acceptable'
      },
      {
        date: '2026-02-12T16:30:00',
        site: 'Biggera Waters',
        device: 'BOR-QLD-BGW',
        waterL: 340,
        drumRPM: 10.1,
        duration: '95s',
        endNTU: 62,
        wesScore: 78,
        mixType: '20 MPa',
        status: 'Acceptable'
      }
    ]
  },
  {
    vehicleId: 'AGI-445',
    driver: 'T. Nguyen',
    site: 'Narangba',
    lastWashout: '2026-02-15T16:20:00',
    wesScore: 58,
    waterVolume: 340,
    drumRPM: 7.2,
    endNTU: 280,
    buildupRisk: 'High',
    dedagETA: '30 days',
    status: 'Marginal',
    rfidTag: '06038804529e45',
    internalId: '445',
    vehicleReference: '2020081500847445S1',
    washesThisMonth: 9,
    targetWashes: 16,
    progress: 56.25,
    avgTemp: 32.1,
    avgDuration: 65,
    avgWESScore: 57.8,
    estimatedBuildup: 380,
    monthlyBuildupRate: 48,
    estimatedCost: 8600,
    washHistory: [
      {
        date: '2026-02-15T16:20:00',
        site: 'Narangba',
        device: 'BOR-QLD-NAR',
        waterL: 340,
        drumRPM: 7.2,
        duration: '62s',
        endNTU: 280,
        wesScore: 58,
        mixType: '40 MPa',
        status: 'Marginal'
      },
      {
        date: '2026-02-14T15:35:00',
        site: 'Narangba',
        device: 'BOR-QLD-NAR',
        waterL: 340,
        drumRPM: 7.5,
        duration: '68s',
        endNTU: 265,
        wesScore: 60,
        mixType: '32 MPa',
        status: 'Marginal'
      }
    ]
  },
  {
    vehicleId: 'AGI-312',
    driver: 'K. Chen',
    site: 'Narangba',
    lastWashout: '2026-02-13T09:22:00',
    wesScore: 31,
    waterVolume: 340,
    drumRPM: 0,
    endNTU: 1820,
    buildupRisk: 'Critical',
    dedagETA: '8 days',
    status: 'Non-Compliant',
    rfidTag: '06038804529e12',
    internalId: '312',
    vehicleReference: '2020081500847312S1',
    washesThisMonth: 3,
    targetWashes: 16,
    progress: 18.75,
    avgTemp: 33.2,
    avgDuration: 15,
    avgWESScore: 31.0,
    estimatedBuildup: 870,
    monthlyBuildupRate: 87,
    estimatedCost: 8600,
    anomaly: 'water_flow_no_rotation',
    washHistory: [
      {
        date: '2026-02-13T09:22:00',
        site: 'Narangba',
        device: 'BOR-QLD-NAR',
        waterL: 340,
        drumRPM: 0,
        duration: '12s',
        endNTU: 1820,
        wesScore: 31,
        mixType: '50 MPa',
        status: 'Poor'
      },
      {
        date: '2026-02-10T08:15:00',
        site: 'Narangba',
        device: 'BOR-QLD-NAR',
        waterL: 340,
        drumRPM: 0,
        duration: '18s',
        endNTU: 1750,
        wesScore: 28,
        mixType: '40 MPa',
        status: 'Poor'
      }
    ]
  },
  {
    vehicleId: 'AGI-221',
    driver: 'J. Martinez',
    site: 'Ipswich',
    lastWashout: '2026-02-16T03:30:00',
    wesScore: 68,
    waterVolume: 340,
    drumRPM: 8.5,
    endNTU: 145,
    buildupRisk: 'Med',
    dedagETA: '4+ mo',
    status: 'Acceptable',
    rfidTag: '06038804529e21',
    internalId: '221',
    vehicleReference: '2020081500847221S1',
    washesThisMonth: 11,
    targetWashes: 16,
    progress: 68.75,
    avgTemp: 30.5,
    avgDuration: 78,
    avgWESScore: 69.2,
    estimatedBuildup: 240,
    monthlyBuildupRate: 22,
    estimatedCost: null,
    washHistory: [
      {
        date: '2026-02-16T03:30:00',
        site: 'Ipswich',
        device: 'BOR-QLD-IPS',
        waterL: 340,
        drumRPM: 8.5,
        duration: '76s',
        endNTU: 145,
        wesScore: 68,
        mixType: '32 MPa',
        status: 'Acceptable'
      }
    ]
  },
  {
    vehicleId: 'AGI-334',
    driver: 'L. Anderson',
    site: 'Coopers Plains',
    lastWashout: '2026-02-16T07:15:00',
    wesScore: 88,
    waterVolume: 340,
    drumRPM: 10.8,
    endNTU: 42,
    buildupRisk: 'Low',
    dedagETA: null,
    status: 'Compliant',
    rfidTag: '06038804529e34',
    internalId: '334',
    vehicleReference: '2020081500847334S1',
    washesThisMonth: 13,
    targetWashes: 16,
    progress: 81.25,
    avgTemp: 28.9,
    avgDuration: 88,
    avgWESScore: 87.5,
    estimatedBuildup: null,
    monthlyBuildupRate: null,
    estimatedCost: null,
    washHistory: [
      {
        date: '2026-02-16T07:15:00',
        site: 'Coopers Plains',
        device: 'BOR-QLD-CP',
        waterL: 340,
        drumRPM: 10.8,
        duration: '91s',
        endNTU: 42,
        wesScore: 88,
        mixType: '25 MPa',
        status: 'Excellent'
      }
    ]
  },
  {
    vehicleId: 'AGI-278',
    driver: 'P. Johnson',
    site: 'Bundall',
    lastWashout: '2026-02-16T06:00:00',
    wesScore: 85,
    waterVolume: 340,
    drumRPM: 10.1,
    endNTU: 58,
    buildupRisk: 'Low',
    dedagETA: null,
    status: 'Compliant',
    rfidTag: '06038804529e78',
    internalId: '278',
    vehicleReference: '2020081500847278S1',
    washesThisMonth: 14,
    targetWashes: 16,
    progress: 87.5,
    avgTemp: 27.5,
    avgDuration: 86,
    avgWESScore: 84.8,
    estimatedBuildup: null,
    monthlyBuildupRate: null,
    estimatedCost: null,
    washHistory: [
      {
        date: '2026-02-16T06:00:00',
        site: 'Bundall',
        device: 'BOR-QLD-BUN',
        waterL: 340,
        drumRPM: 10.1,
        duration: '88s',
        endNTU: 58,
        wesScore: 85,
        mixType: '32 MPa',
        status: 'Excellent'
      }
    ]
  },
  {
    vehicleId: 'AGI-412',
    driver: 'M. Davis',
    site: 'Murarrie',
    lastWashout: '2026-02-15T14:22:00',
    wesScore: 72,
    waterVolume: 340,
    drumRPM: 8.9,
    endNTU: 112,
    buildupRisk: 'Med',
    dedagETA: '5+ mo',
    status: 'Acceptable',
    rfidTag: '06038804529e12',
    internalId: '412',
    vehicleReference: '2020081500847412S1',
    washesThisMonth: 10,
    targetWashes: 16,
    progress: 62.5,
    avgTemp: 29.8,
    avgDuration: 81,
    avgWESScore: 73.4,
    estimatedBuildup: 210,
    monthlyBuildupRate: 19,
    estimatedCost: null,
    washHistory: [
      {
        date: '2026-02-15T14:22:00',
        site: 'Murarrie',
        device: 'BOR-QLD-MUR',
        waterL: 340,
        drumRPM: 8.9,
        duration: '79s',
        endNTU: 112,
        wesScore: 72,
        mixType: '32 MPa',
        status: 'Acceptable'
      }
    ]
  },
  {
    vehicleId: 'AGI-567',
    driver: 'R. Wilson',
    site: 'Biggera Waters',
    lastWashout: '2026-02-15T18:45:00',
    wesScore: 62,
    waterVolume: 340,
    drumRPM: 7.8,
    endNTU: 195,
    buildupRisk: 'Med',
    dedagETA: '3+ mo',
    status: 'Marginal',
    rfidTag: '06038804529e67',
    internalId: '567',
    vehicleReference: '2020081500847567S1',
    washesThisMonth: 9,
    targetWashes: 16,
    progress: 56.25,
    avgTemp: 31.8,
    avgDuration: 72,
    avgWESScore: 63.5,
    estimatedBuildup: 310,
    monthlyBuildupRate: 35,
    estimatedCost: null,
    washHistory: [
      {
        date: '2026-02-15T18:45:00',
        site: 'Biggera Waters',
        device: 'BOR-QLD-BGW',
        waterL: 340,
        drumRPM: 7.8,
        duration: '70s',
        endNTU: 195,
        wesScore: 62,
        mixType: '40 MPa',
        status: 'Marginal'
      }
    ]
  },
  {
    vehicleId: 'AGI-189',
    driver: 'C. Taylor',
    site: 'Ipswich',
    lastWashout: '2026-02-16T04:10:00',
    wesScore: 75,
    waterVolume: 340,
    drumRPM: 9.2,
    endNTU: 95,
    buildupRisk: 'Low',
    dedagETA: null,
    status: 'Acceptable',
    rfidTag: '06038804529e89',
    internalId: '189',
    vehicleReference: '2020081500847189S1',
    washesThisMonth: 12,
    targetWashes: 16,
    progress: 75,
    avgTemp: 30.2,
    avgDuration: 83,
    avgWESScore: 76.1,
    estimatedBuildup: 165,
    monthlyBuildupRate: 14,
    estimatedCost: null,
    washHistory: [
      {
        date: '2026-02-16T04:10:00',
        site: 'Ipswich',
        device: 'BOR-QLD-IPS',
        waterL: 340,
        drumRPM: 9.2,
        duration: '81s',
        endNTU: 95,
        wesScore: 75,
        mixType: '25 MPa',
        status: 'Acceptable'
      }
    ]
  }
];

export const SITE_COMPLIANCE = [
  { site: 'Coopers Plains', wesAvg: 91, percentage: 91 },
  { site: 'Bundall', wesAvg: 88, percentage: 88 },
  { site: 'Murarrie', wesAvg: 84, percentage: 84 },
  { site: 'Biggera Waters', wesAvg: 79, percentage: 79 },
  { site: 'Narangba', wesAvg: 72, percentage: 72 },
  { site: 'Ipswich', wesAvg: 64, percentage: 64 },
];

export const WES_DISTRIBUTION = [
  { range: 'Excellent (90-100)', count: 28, color: 'bg-primary' },
  { range: 'Good (70-89)', count: 14, color: 'bg-chart-low' },
  { range: 'Marginal (50-69)', count: 5, color: 'bg-chart-medium' },
  { range: 'Poor (<50)', count: 3, color: 'bg-chart-critical' },
];

export const FLEET_METRICS = {
  fleetCompliance: 87.3,
  weeklyTarget: 90,
  change: 4.2,
  avgWESScore: 76.4,
  wesChange: 2.1,
  vehiclesAtRisk: 12,
  riskChange: 3,
  washoutsThisWeek: 342,
  washoutChange: 18,
  estSavings: 127000,
  savingsChange: 14000,
};

export const AI_SUMMARY = {
  title: '12 vehicles need attention — 3 approaching dedagging threshold',
  description: 'Fleet washout compliance is at 87.3% this week. AGI-089, AGI-312, and AGI-445 have declining WES trends and are predicted to require dedagging within 21–35 days. Estimated cost if not addressed: $25,800–$55,500. AGI-312 flagged for card-tap fraud (zero drum rotation). Recommend driver coaching for 4 operators.',
  confidence: 95
};

export const PRIORITY_ACTIONS = [
  {
    vehicleId: 'AGI-312',
    severity: 'CRITICAL',
    site: 'Narangba',
    driver: 'K. Chen',
    wesScore: 31,
    issue: 'Full 340L water dispensed but zero drum rotation detected — driver tapped card but did not engage drum. NTU remained at 1,820 (no concrete removed). Buildup rate 87 kg/month. Dedagging predicted within 8 days (~$8,600 cost).',
    recommendation: '⚠ Immediate driver coaching required. Inspect drum within 48 hours.',
    confidence: 100,
    anomaly: 'Anomaly detected: water flow without drum rotation'
  },
  {
    vehicleId: 'AGI-089',
    severity: 'HIGH',
    site: 'Biggera Waters',
    driver: 'D. Brown',
    wesScore: 54,
    issue: '30-day avg WES declining from 78→54. Receives full 340L dispense but drum RPM consistently low (avg 6.1 vs 8–12 target) and short duration (avg 48s vs 90s target). End NTU averaging 285 — concrete not being adequately removed. Estimated buildup ~420 kg, dedagging in 23 days.',
    recommendation: '⚠ Schedule driver coaching. Enforce full 90-second drum rotation cycle.',
    confidence: 92,
    anomaly: 'Trend analysis over 30 washout events'
  },
  {
    vehicleId: 'AGI-445',
    severity: 'HIGH',
    site: 'Narangba',
    driver: 'T. Nguyen',
    wesScore: 58,
    issue: 'Declining WES trend from 72→58 over 30 days. Drum RPM below target (avg 7.2 vs 8–12). End NTU consistently high (avg 280). Estimated buildup ~380 kg, dedagging predicted in 30 days (~$8,600 cost).',
    recommendation: '⚠ Driver coaching recommended. Monitor next 5 washout events closely.',
    confidence: 88,
    anomaly: 'Declining performance trend detected'
  }
];

// WES Score trend data for AGI-089 (30 days)
export const WES_TREND_AGI_089 = [
  { date: '2026-01-17', score: 78 },
  { date: '2026-01-18', score: 76 },
  { date: '2026-01-19', score: 79 },
  { date: '2026-01-20', score: 77 },
  { date: '2026-01-21', score: 75 },
  { date: '2026-01-22', score: 74 },
  { date: '2026-01-23', score: 72 },
  { date: '2026-01-24', score: 73 },
  { date: '2026-01-25', score: 71 },
  { date: '2026-01-26', score: 69 },
  { date: '2026-01-27', score: 70 },
  { date: '2026-01-28', score: 68 },
  { date: '2026-01-29', score: 67 },
  { date: '2026-01-30', score: 65 },
  { date: '2026-01-31', score: 64 },
  { date: '2026-02-01', score: 63 },
  { date: '2026-02-02', score: 62 },
  { date: '2026-02-03', score: 61 },
  { date: '2026-02-04', score: 60 },
  { date: '2026-02-05', score: 59 },
  { date: '2026-02-06', score: 58 },
  { date: '2026-02-07', score: 57 },
  { date: '2026-02-08', score: 56 },
  { date: '2026-02-09', score: 55 },
  { date: '2026-02-10', score: 56 },
  { date: '2026-02-11', score: 55 },
  { date: '2026-02-12', score: 78 },
  { date: '2026-02-13', score: 71 },
  { date: '2026-02-14', score: 61 },
  { date: '2026-02-15', score: 54 },
];

export const SENSOR_DATA_SOURCES = [
  {
    name: 'Flow Meter',
    model: 'ifm SM8000',
    description: 'Measures exact water volume per washout in litres. G1" BSP inline mount. Accuracy ±2%.',
    status: 'Live',
    icon: 'Droplets'
  },
  {
    name: 'RFID Reader',
    model: 'Existing ELORA scan cards',
    description: 'Driver identity verification. Triggers solenoid valve open and starts event recording.',
    status: 'Live',
    icon: 'CreditCard'
  },
  {
    name: 'Drum Rotation Sensor',
    model: 'Dingtek DZ300',
    description: 'Measures RPM and direction via BLE to edge computer. Confirms drum actually spinning during wash.',
    status: 'Live',
    icon: 'RotateCw'
  },
  {
    name: 'Turbidity Sensor',
    model: 'Turtle Tough TT-NTU',
    description: 'Measures discharge water clarity (NTU). Confirms concrete is being removed. Self-cleaning wiper.',
    status: 'Live',
    icon: 'Waves'
  },
  {
    name: 'Temperature',
    model: 'Built into SM8000 flow meter',
    description: 'Water temperature indicates urgency. Ambient temp from site weather station.',
    status: 'Live',
    icon: 'Thermometer'
  },
  {
    name: 'Edge Computer',
    model: 'MyPi Industrial CM4',
    description: 'Aggregates all sensor data, runs WES scoring locally, transmits via MQTT to cloud.',
    status: 'Live',
    icon: 'Cpu'
  }
];

export const EXTERNAL_INTEGRATIONS = [
  {
    name: 'Command Alkon (Batching)',
    description: 'Provides mix type, grade (MPa), load size (m³), batch time, dispatch time, admixtures. Critical for context-aware WES scoring — a 50 MPa load in 35°C needs different washout than 20 MPa at 15°C.',
    status: 'Live',
    impact: 'Higher MPa = more aggressive set → tighter washout window, higher WES weight',
    icon: 'Package'
  },
  {
    name: 'Teletrac Navman (Telematics)',
    description: 'GPS position verification (geofencing confirms truck at washout bay). PTO status confirms drum rotation independently. Return-to-plant timestamp for washout window calculation.',
    status: 'Planned',
    impact: 'Geofencing confirms truck at washout bay (not just card tap somewhere else)',
    icon: 'MapPin'
  },
  {
    name: 'Volvo Connect (OEM Telematics)',
    description: 'Boral runs Mack trucks (Volvo Group). OEM telematics provides engine hours, fuel consumption, and can correlate weight changes with buildup estimates.',
    status: 'Future',
    impact: 'Correlate weight changes with buildup estimates. Independent verification',
    icon: 'Truck'
  },
  {
    name: 'Auto Allocations (Boral Dispatch)',
    description: "Boral's proprietary digital dispatch system. Would provide real-time delivery schedules for optimal wash window calculations. Requires partnership agreement.",
    status: 'Future',
    impact: 'Optimal wash window recommendations based on upcoming delivery gaps',
    icon: 'Calendar'
  }
];

export const DATA_PIPELINE_STEPS = [
  { label: 'Sensors', icon: 'Settings' },
  { label: 'Edge Computer', icon: 'Cpu' },
  { label: 'MQTT', icon: 'Radio' },
  { label: 'AWS IoT Core', icon: 'Cloud' },
  { label: 'Timestream DB', icon: 'Database' },
  { label: 'WES Scoring', icon: 'Brain' },
  { label: 'ELORA Portal', icon: 'Monitor' }
];

// Risk Predictions tab: risk summary + dedagging table
export const RISK_SUMMARY = {
  vehiclesAtRisk: 12,
  riskLabel: 'Next 48 hours',
  predictedCompliance: 73,
  predictedLabel: 'End of week forecast',
  critical24h: 3,
  criticalLabel: 'Require immediate action',
  high48h: 4,
  highLabel: 'Trending poorly',
  medium72h: 5,
  mediumLabel: 'Monitor closely',
};

export const DEDAGGING_RISK_ROWS = [
  { vehicleId: 'AGI-312', driver: 'K. Chen', site: 'Narangba', estBuildup: '462 kg', monthlyRate: '87 kg/mo', predictedDedag: '8 days', riskLevel: 'Critical', estCost: 8600, action: 'Escalate' },
  { vehicleId: 'AGI-089', driver: 'D. Brown', site: 'Biggera Waters', estBuildup: '~420 kg', monthlyRate: '52 kg/mo', predictedDedag: '23 days', riskLevel: 'High', estCost: 8600, action: 'Coach' },
  { vehicleId: 'AGI-445', driver: 'T. Nguyen', site: 'Narangba', estBuildup: '~380 kg', monthlyRate: '45 kg/mo', predictedDedag: '30 days', riskLevel: 'High', estCost: 8600, action: 'Coach' },
  { vehicleId: 'AGI-678', driver: "L. O'Brien", site: 'Ipswich', estBuildup: '~310 kg', monthlyRate: '38 kg/mo', predictedDedag: '~2 months', riskLevel: 'Medium', estCost: null, action: 'Monitor' },
];

export const COMBINED_RISK_MESSAGE = 'These 3 critical/high vehicles represent $25,800–$55,500 in potential dedagging costs over the next 30 days. ELORA intervention can prevent 84.4% of this buildup.';

// Recommendations tab: donut chart, summary, wash windows, driver insights
export const RECOMMENDATIONS_BY_PRIORITY = [
  { name: 'Critical', value: 8, fill: 'hsl(var(--chart-critical))' },
  { name: 'High', value: 12, fill: 'hsl(var(--chart-high))' },
  { name: 'Medium', value: 10, fill: 'hsl(var(--chart-medium))' },
];

export const RECOMMENDATIONS_SUMMARY = {
  total: 30,
  highPriority: 20,
  complianceGain: 51,
};

export const OPTIMAL_WASH_WINDOWS = [
  { time: '06:00 – 06:30', label: 'Before first deliveries', vehicles: 3, utilization: 23 },
  { time: '11:30 – 12:00', label: 'Lunch break gap', vehicles: 5, utilization: 45 },
  { time: '15:00 – 16:00', label: 'Post-peak delivery lull', vehicles: 8, utilization: 67 },
];

export const DRIVER_INSIGHTS = [
  { vehicleId: 'AGI-089', text: 'Tends to skip washes on Fridays and Mondays. Consider mandatory Friday wash slot.', confidence: 87, topPerformer: false },
  { vehicleId: 'AGI-147', text: 'Responds best to SMS reminders sent at 5:30am. +34% compliance after reminders.', confidence: 95, topPerformer: true },
  { vehicleId: 'AGI-156', text: 'Consistently washes between 5–6am. Top performer — 6/6 target. WES avg 91.', confidence: 95, topPerformer: true },
];

// Patterns tab
export const PATTERNS_METRICS = {
  peakWashHour: '2:15 PM',
  peakWashLabel: 'Avg 62 washes/hour',
  lowestDay: 'Sunday',
  lowestDayLabel: '98% below average',
  bestSite: 'Coopers Plns',
  bestSiteLabel: '91% compliance',
  topDriver: 'AGI-156',
  topDriverLabel: '100% target hit',
};

export const POSITIVE_PATTERNS = [
  { text: 'Morning washers hit targets 73% more often', confidence: '92%' },
  { text: 'Vehicles at Coopers Plains have highest compliance', confidence: '91%' },
  { text: 'SMS reminders improve compliance by 34%', confidence: '85%' },
  { text: '2-cycle washouts reduce NTU by 94% vs single', confidence: '97%' },
];

export const AREAS_OF_CONCERN = [
  { text: 'Friday compliance 98% below average', confidence: '94%' },
  { text: 'Narangba site trending downward', confidence: '87%' },
  { text: 'Afternoon wash slots severely underutilized', confidence: '91%' },
  { text: 'High-temp days (>35°C) show 40% more poor scores', confidence: '89%' },
];
