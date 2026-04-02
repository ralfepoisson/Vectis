import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";

const fixedNow = new Date("2026-04-02T10:00:00.000Z");

function createLife2Token(payload: Record<string, unknown>) {
  const header = { alg: "HS256", typ: "JWT" };
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

  return `${encode(header)}.${encode(payload)}.signature`;
}

describe("Vectis webapp", () => {
  const originalFetch = global.fetch;
  const originalConfig = (window as Window & { __VECTIS_CONFIG__?: unknown }).__VECTIS_CONFIG__;

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    (window as Window & { __VECTIS_CONFIG__?: unknown }).__VECTIS_CONFIG__ = {
      apiBaseUrl: "https://api.vectis.test/api/v1",
      authServiceSignInUrl: "https://auth.life-sqrd.com/signIn",
      authServiceApplicationId: "vectis-web",
      appBaseUrl: "http://localhost:4174"
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;

    if (originalConfig === undefined) {
      delete (window as Window & { __VECTIS_CONFIG__?: unknown }).__VECTIS_CONFIG__;
    } else {
      (window as Window & { __VECTIS_CONFIG__?: unknown }).__VECTIS_CONFIG__ = originalConfig;
    }
  });

  it("shows the sign-in handoff when there is no active session", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /secure operations for distributed sites/i
      })
    ).toBeInTheDocument();

    const signInLink = screen.getByRole("link", { name: /sign in with life2/i });
    expect(signInLink).toHaveAttribute(
      "href",
      "https://auth.life-sqrd.com/signIn?applicationId=vectis-web&redirect=http%3A%2F%2Flocalhost%3A4174%2Fauth%2Fcallback"
    );
  });

  it("captures a callback token, restores the session, and loads premises", async () => {
    const token = createLife2Token({
      sub: "user-123",
      accountId: "tenant-123",
      displayName: "Jane Doe",
      email: "jane@example.com",
      exp: Math.floor(new Date("2026-04-09T10:00:00.000Z").getTime() / 1000)
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/premises")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "prem-1",
                tenantId: "tenant-123",
                name: "North Plant",
                type: "factory",
                addressLine1: "12 Industry Way",
                addressLine2: null,
                city: "Grenoble",
                state: null,
                postalCode: "38000",
                countryCode: "FR",
                notes: null,
                createdByUserId: "user-123",
                updatedByUserId: null,
                createdAt: fixedNow.toISOString(),
                updatedAt: fixedNow.toISOString()
              }
            ]
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/agents")) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }

      if (url.endsWith("/premises/prem-1/cameras")) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    global.fetch = fetchMock as typeof global.fetch;
    window.history.replaceState({}, "", `/auth/callback?token=${token}`);

    render(<App />);

    await screen.findByRole("heading", { name: /create premises/i });

    expect(screen.getAllByText(/north plant/i).length).toBeGreaterThan(0);
    expect(localStorage.getItem("vectis.auth.token")).toBe(token);
    expect(window.location.pathname).toBe("/");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("creates, updates, and deletes premises, cameras, and agents from the UI", async () => {
    const token = createLife2Token({
      sub: "user-123",
      accountId: "tenant-123",
      displayName: "Jane Doe",
      email: "jane@example.com",
      exp: Math.floor(new Date("2026-04-09T10:00:00.000Z").getTime() / 1000)
    });

    localStorage.setItem("vectis.auth.token", token);

    const premises = [
      {
        id: "prem-1",
        tenantId: "tenant-123",
        name: "North Plant",
        type: "factory",
        addressLine1: "12 Industry Way",
        addressLine2: null,
        city: "Grenoble",
        state: null,
        postalCode: "38000",
        countryCode: "FR",
        notes: "Main industrial site",
        createdByUserId: "user-123",
        updatedByUserId: null,
        createdAt: fixedNow.toISOString(),
        updatedAt: fixedNow.toISOString()
      }
    ];

    const agents = [
      {
        id: "agent-1",
        tenantId: "tenant-123",
        premisesId: "prem-1",
        name: "Edge Node A",
        status: "online",
        softwareVersion: "1.4.0",
        locationDescription: "Rack 2",
        hostName: "edge-a",
        createdByUserId: "user-123",
        updatedByUserId: null,
        createdAt: fixedNow.toISOString(),
        updatedAt: fixedNow.toISOString()
      }
    ];

    const camerasByPremises = new Map([
      [
        "prem-1",
        [
          {
            id: "cam-1",
            tenantId: "tenant-123",
            premisesId: "prem-1",
            name: "Gate Cam",
            streamUrl: "https://streams.example.com/gate",
            status: "online",
            model: "Axis P1465",
            serialNumber: "AX-100",
            locationDescription: "North gate",
            createdByUserId: "user-123",
            updatedByUserId: null,
            createdAt: fixedNow.toISOString(),
            updatedAt: fixedNow.toISOString()
          }
        ]
      ]
    ]);

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.endsWith("/premises") && method === "GET") {
        return new Response(JSON.stringify({ items: premises }), { status: 200 });
      }

      if (url.endsWith("/agents") && method === "GET") {
        return new Response(JSON.stringify({ items: agents }), { status: 200 });
      }

      if (url.endsWith("/premises/prem-1/cameras") && method === "GET") {
        return new Response(
          JSON.stringify({ items: camerasByPremises.get("prem-1") ?? [] }),
          { status: 200 }
        );
      }

      if (url.endsWith("/premises") && method === "POST") {
        const payload = JSON.parse(String(init?.body));
        const created = {
          id: "prem-2",
          tenantId: "tenant-123",
          createdByUserId: "user-123",
          updatedByUserId: null,
          createdAt: fixedNow.toISOString(),
          updatedAt: fixedNow.toISOString(),
          addressLine2: null,
          state: null,
          postalCode: null,
          notes: null,
          ...payload
        };
        premises.push(created);
        camerasByPremises.set("prem-2", []);
        return new Response(JSON.stringify({ premises: created }), { status: 201 });
      }

      if (url.endsWith("/agents") && method === "POST") {
        const payload = JSON.parse(String(init?.body));
        const created = {
          id: "agent-2",
          tenantId: "tenant-123",
          createdByUserId: "user-123",
          updatedByUserId: null,
          createdAt: fixedNow.toISOString(),
          updatedAt: fixedNow.toISOString(),
          ...payload
        };
        agents.push(created);
        return new Response(JSON.stringify({ agent: created }), { status: 201 });
      }

      if (url.endsWith("/premises/prem-1/cameras") && method === "POST") {
        const payload = JSON.parse(String(init?.body));
        const created = {
          id: "cam-2",
          tenantId: "tenant-123",
          premisesId: "prem-1",
          createdByUserId: "user-123",
          updatedByUserId: null,
          createdAt: fixedNow.toISOString(),
          updatedAt: fixedNow.toISOString(),
          ...payload
        };
        camerasByPremises.set("prem-1", [...(camerasByPremises.get("prem-1") ?? []), created]);
        return new Response(JSON.stringify({ camera: created }), { status: 201 });
      }

      if (url.endsWith("/agents/agent-1") && method === "PATCH") {
        const payload = JSON.parse(String(init?.body));
        agents[0] = { ...agents[0], ...payload };
        return new Response(JSON.stringify({ agent: agents[0] }), { status: 200 });
      }

      if (url.endsWith("/premises/prem-1/cameras/cam-1") && method === "PATCH") {
        const payload = JSON.parse(String(init?.body));
        const updated = { ...(camerasByPremises.get("prem-1") ?? [])[0], ...payload };
        camerasByPremises.set("prem-1", [
          updated,
          ...((camerasByPremises.get("prem-1") ?? []).slice(1))
        ]);
        return new Response(JSON.stringify({ camera: updated }), { status: 200 });
      }

      if (url.endsWith("/agents/agent-1") && method === "DELETE") {
        agents.splice(0, 1);
        return new Response(null, { status: 204 });
      }

      if (url.endsWith("/premises/prem-1/cameras/cam-1") && method === "DELETE") {
        camerasByPremises.set(
          "prem-1",
          (camerasByPremises.get("prem-1") ?? []).filter((camera) => camera.id !== "cam-1")
        );
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected fetch ${method} ${url}`);
    });

    global.fetch = fetchMock as typeof global.fetch;

    render(<App />);

    await screen.findByRole("button", { name: /north plant/i });

    fireEvent.change(screen.getByLabelText(/premises name/i), {
      target: { value: "South Depot" }
    });
    fireEvent.change(screen.getByLabelText(/premises type/i), {
      target: { value: "warehouse" }
    });
    fireEvent.change(screen.getByLabelText(/address line 1/i), {
      target: { value: "42 Storage Park" }
    });
    fireEvent.change(screen.getByLabelText(/^city$/i), {
      target: { value: "Lille" }
    });
    fireEvent.change(screen.getByLabelText(/country code/i), {
      target: { value: "FR" }
    });
    fireEvent.click(screen.getByRole("button", { name: /create premises/i }));

    await screen.findByRole("button", { name: /south depot/i });

    const premisesCard = screen.getByRole("button", { name: /north plant/i });
    fireEvent.click(premisesCard);

    fireEvent.change(screen.getByLabelText(/agent name/i), {
      target: { value: "Edge Node B" }
    });
    fireEvent.change(screen.getByLabelText(/agent status/i), {
      target: { value: "maintenance" }
    });
    fireEvent.change(screen.getByLabelText(/software version/i), {
      target: { value: "1.5.0" }
    });
    fireEvent.click(screen.getByRole("button", { name: /add agent/i }));

    await screen.findByText(/edge node b/i);

    fireEvent.change(screen.getByLabelText(/camera name/i), {
      target: { value: "Loading Bay Cam" }
    });
    fireEvent.change(screen.getByLabelText(/stream url/i), {
      target: { value: "https://streams.example.com/loading-bay" }
    });
    fireEvent.change(screen.getByLabelText(/camera status/i), {
      target: { value: "maintenance" }
    });
    fireEvent.click(screen.getByRole("button", { name: /add camera/i }));

    await screen.findByText(/loading bay cam/i);

    const existingAgent = screen.getByTestId("agent-agent-1");
    fireEvent.click(within(existingAgent).getByRole("button", { name: /edit/i }));
    fireEvent.change(screen.getByLabelText(/agent name/i), {
      target: { value: "Edge Node A Prime" }
    });
    fireEvent.change(screen.getByLabelText(/agent status/i), {
      target: { value: "maintenance" }
    });
    fireEvent.click(screen.getByRole("button", { name: /save agent/i }));

    await screen.findByText(/edge node a prime/i);

    const existingCamera = screen.getByTestId("camera-cam-1");
    fireEvent.click(within(existingCamera).getByRole("button", { name: /edit/i }));
    fireEvent.change(screen.getByLabelText(/camera name/i), {
      target: { value: "Gate Cam West" }
    });
    fireEvent.change(screen.getByLabelText(/camera status/i), {
      target: { value: "offline" }
    });
    fireEvent.click(screen.getByRole("button", { name: /save camera/i }));

    await screen.findByText(/gate cam west/i);

    fireEvent.click(within(screen.getByTestId("agent-agent-1")).getByRole("button", { name: /remove/i }));
    await waitFor(() => expect(screen.queryByText(/edge node a prime/i)).not.toBeInTheDocument());

    fireEvent.click(within(screen.getByTestId("camera-cam-1")).getByRole("button", { name: /remove/i }));
    await waitFor(() => expect(screen.queryByText(/gate cam west/i)).not.toBeInTheDocument());
  });
});
