import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";

describe("Vectis backend", () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves health and platform overview endpoints", async () => {
    const health = await app.inject({
      method: "GET",
      url: "/health"
    });
    const overview = await app.inject({
      method: "GET",
      url: "/api/v1/platform/overview"
    });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok" });
    expect(overview.statusCode).toBe(200);
    expect(overview.json().overview.captureToAction).toHaveLength(5);
  });

  it("returns seeded dashboard resources for cameras, rules, and events", async () => {
    const [events, cameras, rules] = await Promise.all([
      app.inject({ method: "GET", url: "/api/v1/events" }),
      app.inject({ method: "GET", url: "/api/v1/cameras" }),
      app.inject({ method: "GET", url: "/api/v1/rules" })
    ]);

    expect(events.json().items).toHaveLength(3);
    expect(cameras.json().items[1].status).toBe("degraded");
    expect(rules.json().items[0].enabled).toBe(true);
  });
});
