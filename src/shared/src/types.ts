export type EventType =
  | "person_detected"
  | "motion_detected"
  | "queue_growing"
  | "safety_violation";

export interface CameraSource {
  id: string;
  name: string;
  location: string;
  status: "online" | "degraded" | "offline";
  fps: number;
}

export interface VisionEvent {
  id: string;
  timestamp: string;
  source: string;
  eventType: EventType;
  confidence: number;
  severity: "low" | "medium" | "high";
  summary: string;
}

export interface RuleSummary {
  id: string;
  name: string;
  condition: string;
  action: string;
  enabled: boolean;
}

export interface PlatformOverview {
  tagline: string;
  valueProposition: string;
  mvpFocus: string[];
  captureToAction: string[];
}
