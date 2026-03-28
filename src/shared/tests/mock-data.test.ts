import { describe, expect, it } from "vitest";

import { automationRules, cameraSources, platformOverview, visionEvents } from "../src";

describe("shared Vectis seed data", () => {
  it("describes the core capture-to-action pipeline", () => {
    expect(platformOverview.captureToAction).toEqual([
      "Capture",
      "Interpret",
      "Structure",
      "Decide",
      "Act"
    ]);
  });

  it("exposes seeded camera, rule, and event data for the MVP surfaces", () => {
    expect(cameraSources).toHaveLength(3);
    expect(visionEvents.some((event) => event.severity === "high")).toBe(true);
    expect(automationRules.every((rule) => rule.enabled)).toBe(true);
  });
});
