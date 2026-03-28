import type {
  CameraSource,
  PlatformOverview,
  RuleSummary,
  VisionEvent
} from "./types";

export const platformOverview: PlatformOverview = {
  tagline: "Intelligent Vision Platform",
  valueProposition:
    "Vectis turns camera streams into structured events, automation decisions, and operator-ready insight.",
  mvpFocus: [
    "Single-camera ingestion",
    "Event-first detection pipeline",
    "Operator dashboard",
    "Rules-driven actions"
  ],
  captureToAction: [
    "Capture",
    "Interpret",
    "Structure",
    "Decide",
    "Act"
  ]
};

export const cameraSources: CameraSource[] = [
  {
    id: "cam-entrance-01",
    name: "Entrance North",
    location: "Primary access gate",
    status: "online",
    fps: 24
  },
  {
    id: "cam-yard-02",
    name: "Operations Yard",
    location: "Loading and equipment zone",
    status: "degraded",
    fps: 18
  },
  {
    id: "cam-substation-03",
    name: "Substation Corridor",
    location: "High-value industrial asset lane",
    status: "online",
    fps: 30
  }
];

export const visionEvents: VisionEvent[] = [
  {
    id: "evt-1001",
    timestamp: "2026-03-28T08:45:12Z",
    source: "cam-entrance-01",
    eventType: "person_detected",
    confidence: 0.97,
    severity: "medium",
    summary: "Single person entering through the north gate."
  },
  {
    id: "evt-1002",
    timestamp: "2026-03-28T08:49:01Z",
    source: "cam-yard-02",
    eventType: "queue_growing",
    confidence: 0.88,
    severity: "low",
    summary: "Vehicle queue reached threshold in the operations yard."
  },
  {
    id: "evt-1003",
    timestamp: "2026-03-28T08:53:44Z",
    source: "cam-substation-03",
    eventType: "safety_violation",
    confidence: 0.92,
    severity: "high",
    summary: "Protective helmet missing inside the substation corridor."
  }
];

export const automationRules: RuleSummary[] = [
  {
    id: "rule-quiet-hours",
    name: "Quiet Hours Security Sweep",
    condition: "If motion is detected after 22:00",
    action: "Notify duty team and create an incident",
    enabled: true
  },
  {
    id: "rule-queue-alert",
    name: "Queue Threshold Alert",
    condition: "If queue_growing persists for 5 minutes",
    action: "Post to operations Slack channel",
    enabled: true
  },
  {
    id: "rule-ppe",
    name: "PPE Compliance Escalation",
    condition: "If safety_violation confidence exceeds 0.9",
    action: "Open supervisor review workflow",
    enabled: true
  }
];
