import { z } from "zod";

export const premisesTypeValues = [
  "house",
  "apartment",
  "office",
  "factory",
  "warehouse",
  "retail",
  "other"
] as const;

export const cameraStatusValues = ["online", "degraded", "offline", "maintenance"] as const;

const optionalTrimmedString = z.string().trim().min(1).optional();

export const createPremisesSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(premisesTypeValues),
  addressLine1: z.string().trim().min(1),
  addressLine2: optionalTrimmedString,
  city: z.string().trim().min(1),
  state: optionalTrimmedString,
  postalCode: optionalTrimmedString,
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  notes: optionalTrimmedString
});

export const updatePremisesSchema = createPremisesSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  {
    message: "At least one premises field must be provided."
  }
);

export const createCameraSchema = z.object({
  name: z.string().trim().min(1),
  streamUrl: z.string().trim().url(),
  status: z.enum(cameraStatusValues).default("offline"),
  model: optionalTrimmedString,
  serialNumber: optionalTrimmedString,
  locationDescription: optionalTrimmedString
});

export const updateCameraSchema = createCameraSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  {
    message: "At least one camera field must be provided."
  }
);

export type CreatePremisesInput = z.infer<typeof createPremisesSchema>;
export type UpdatePremisesInput = z.infer<typeof updatePremisesSchema>;
export type CreateCameraInput = z.infer<typeof createCameraSchema>;
export type UpdateCameraInput = z.infer<typeof updateCameraSchema>;
