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

export type PremisesType =
  | "house"
  | "apartment"
  | "office"
  | "factory"
  | "warehouse"
  | "retail"
  | "other";

export type CameraStatus = "online" | "degraded" | "offline" | "maintenance";
export type AgentStatus = "online" | "offline" | "maintenance";

export interface Premises {
  id: string;
  tenantId: string;
  name: string;
  type: PremisesType;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  countryCode: string;
  notes: string | null;
  createdByUserId: string;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PremisesCamera {
  id: string;
  tenantId: string;
  premisesId: string;
  name: string;
  streamUrl: string;
  status: CameraStatus;
  model: string | null;
  serialNumber: string | null;
  locationDescription: string | null;
  createdByUserId: string;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  tenantId: string;
  premisesId: string;
  name: string;
  status: AgentStatus;
  softwareVersion: string | null;
  locationDescription: string | null;
  hostName: string | null;
  createdByUserId: string;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CameraHealthReport {
  id: string;
  tenantId: string;
  agentId: string;
  cameraId: string;
  status: CameraStatus;
  temperatureCelsius: number | null;
  uptimeSeconds: number | null;
  ipAddress: string | null;
  reportedAt: string;
  receivedAt: string;
}

export interface CameraFrame {
  id: string;
  tenantId: string;
  agentId: string;
  cameraId: string;
  storagePath: string;
  contentType: string;
  byteSize: number;
  capturedAt: string;
  receivedAt: string;
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
