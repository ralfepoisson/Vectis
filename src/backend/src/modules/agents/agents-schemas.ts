import { z } from "zod";

import { cameraStatusValues } from "../premises/premises-schemas";

export const agentStatusValues = ["online", "offline", "maintenance"] as const;

const optionalTrimmedString = z.string().trim().min(1).optional();

export const createAgentSchema = z.object({
  premisesId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  status: z.enum(agentStatusValues).default("offline"),
  softwareVersion: optionalTrimmedString,
  locationDescription: optionalTrimmedString,
  hostName: optionalTrimmedString
});

export const updateAgentSchema = createAgentSchema
  .omit({ premisesId: true })
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one agent field must be provided."
  });

export const createCameraHealthReportSchema = z.object({
  cameraId: z.string().trim().min(1),
  status: z.enum(cameraStatusValues),
  temperatureCelsius: z.number().finite().optional(),
  uptimeSeconds: z.number().int().nonnegative().optional(),
  ipAddress: optionalTrimmedString,
  reportedAt: z.string().datetime()
});

export const ingestFramesSchema = z.object({
  frames: z.array(
    z.object({
      cameraId: z.string().trim().min(1),
      timestamp: z.string().datetime(),
      contentType: z.enum(["image/jpeg", "image/png"]),
      dataBase64: z.string().min(1)
    })
  ).min(1)
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type CreateCameraHealthReportInput = z.infer<typeof createCameraHealthReportSchema>;
export type IngestFramesInput = z.infer<typeof ingestFramesSchema>;
