import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";

const fixedNow = new Date("2026-04-02T10:00:00.000Z");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function createLife2Token(payload: Record<string, unknown>) {
  const header = { alg: "HS256", typ: "JWT" };
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

  return `${encode(header)}.${encode(payload)}.signature`;
}

function seedConfig() {
  (window as Window & { __VECTIS_CONFIG__?: unknown }).__VECTIS_CONFIG__ = {
    apiBaseUrl: "https://api.vectis.test/api/v1",
    authServiceSignInUrl: "https://auth.life-sqrd.com/signIn",
    authServiceApplicationId: "0ccc6f76-09c4-4a8c-3bbf-ee097174ffe8",
    appBaseUrl: "http://localhost:4174"
  };
}

describe("Vectis webapp", () => {
  const originalFetch = global.fetch;
  const originalConfig = (window as Window & { __VECTIS_CONFIG__?: unknown }).__VECTIS_CONFIG__;

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    seedConfig();
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

    expect(screen.getByRole("link", { name: /sign in with life2/i })).toHaveAttribute(
      "href",
      "https://auth.life-sqrd.com/signIn?applicationId=0ccc6f76-09c4-4a8c-3bbf-ee097174ffe8&redirect=http%3A%2F%2Flocalhost%3A4174%2Fauth%2Fcallback"
    );
  });

  it("shows the top navigation and admin menu for an admin user", async () => {
    const token = createLife2Token({
      sub: "user-123",
      accountId: "tenant-123",
      displayName: "Jane Doe",
      email: "jane@example.com",
      role: "admin",
      exp: Math.floor(new Date("2026-04-09T10:00:00.000Z").getTime() / 1000)
    });

    localStorage.setItem("vectis.auth.token", token);
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/premises")) {
        return jsonResponse({ items: [] });
      }

      if (url.endsWith("/agents")) {
        return jsonResponse({ items: [] });
      }

      throw new Error(`Unexpected fetch ${url}`);
    }) as typeof global.fetch;

    render(<App />);

    expect(await screen.findByRole("button", { name: /^home$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^premises$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^configuration$/i })).toBeInTheDocument();
    expect(screen.getByText(/^admin$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /jane doe/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("creates records in modals and edits the selected record in the main content area", async () => {
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
        return jsonResponse({ items: premises });
      }

      if (url.endsWith("/agents") && method === "GET") {
        return jsonResponse({ items: agents });
      }

      if (url.endsWith("/premises/prem-1/cameras") && method === "GET") {
        return jsonResponse({ items: camerasByPremises.get("prem-1") ?? [] });
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
        return jsonResponse({ premises: created }, 201);
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
        return jsonResponse({ agent: created }, 201);
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
        return jsonResponse({ camera: created }, 201);
      }

      if (url.endsWith("/premises/prem-1") && method === "PATCH") {
        const payload = JSON.parse(String(init?.body));
        premises[0] = { ...premises[0], ...payload };
        return jsonResponse({ premises: premises[0] });
      }

      throw new Error(`Unexpected fetch ${method} ${url}`);
    });

    global.fetch = fetchMock as typeof global.fetch;

    render(<App />);

    expect(await screen.findByRole("heading", { name: /edit premises/i })).toBeInTheDocument();

    expect(screen.queryByRole("dialog", { name: /create premises/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /\+ premises/i }));
    const premisesDialog = await screen.findByRole("dialog", { name: /create premises/i });
    fireEvent.change(within(premisesDialog).getByLabelText(/premises name/i), {
      target: { value: "South Depot" }
    });
    fireEvent.change(within(premisesDialog).getByLabelText(/premises type/i), {
      target: { value: "warehouse" }
    });
    fireEvent.change(within(premisesDialog).getByLabelText(/address line 1/i), {
      target: { value: "42 Storage Park" }
    });
    fireEvent.change(within(premisesDialog).getByLabelText(/^city$/i), {
      target: { value: "Lille" }
    });
    fireEvent.change(within(premisesDialog).getByLabelText(/country code/i), {
      target: { value: "FR" }
    });
    fireEvent.click(within(premisesDialog).getByRole("button", { name: /create premises/i }));

    expect(await screen.findByText(/premises created/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /south depot/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /north plant/i }));

    fireEvent.click(screen.getByRole("button", { name: /\+ agent/i }));
    const agentDialog = await screen.findByRole("dialog", { name: /create agent/i });
    fireEvent.change(within(agentDialog).getByLabelText(/agent name/i), {
      target: { value: "Edge Node B" }
    });
    fireEvent.change(within(agentDialog).getByLabelText(/agent status/i), {
      target: { value: "maintenance" }
    });
    fireEvent.change(within(agentDialog).getByLabelText(/software version/i), {
      target: { value: "1.5.0" }
    });
    fireEvent.click(within(agentDialog).getByRole("button", { name: /create agent/i }));

    expect(await screen.findByText(/agent created/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /edge node b/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /\+ camera/i }));
    const cameraDialog = await screen.findByRole("dialog", { name: /create camera/i });
    fireEvent.change(within(cameraDialog).getByLabelText(/camera name/i), {
      target: { value: "Loading Bay Cam" }
    });
    fireEvent.change(within(cameraDialog).getByLabelText(/stream url/i), {
      target: { value: "https://streams.example.com/loading-bay" }
    });
    fireEvent.click(within(cameraDialog).getByRole("button", { name: /create camera/i }));

    expect(await screen.findByText(/camera created/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /loading bay cam/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /north plant/i }));
    expect(await screen.findByRole("heading", { name: /edit premises/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/premises name/i), {
      target: { value: "North Plant Prime" }
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(screen.getByText(/changes saved/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /north plant prime/i })).toBeInTheDocument();
  });

  it("shows toast notifications for api errors instead of inline errors", async () => {
    const token = createLife2Token({
      sub: "user-123",
      accountId: "tenant-123",
      exp: Math.floor(new Date("2026-04-09T10:00:00.000Z").getTime() / 1000)
    });

    localStorage.setItem("vectis.auth.token", token);
    global.fetch = vi.fn(async () => {
      return new Response("<!doctype html><html></html>", {
        status: 200,
        headers: {
          "content-type": "text/html"
        }
      });
    }) as typeof global.fetch;

    const { container } = render(<App />);

    expect(
      await screen.findByRole("status", {
        name: /notification center/i
      })
    ).toHaveTextContent(/expected json but received html/i);
    expect(container.querySelector(".error-banner")).toBeNull();
  });
});
