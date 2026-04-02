import { useEffect, useMemo, useState } from "react";
import type { Agent, Premises, PremisesCamera } from "@vectis/shared";

import { clearStoredSession, getStoredSession, storeSession, type AuthSession } from "./auth";
import { getRuntimeConfig } from "./config";

interface ApiError extends Error {
  status?: number;
}

interface PremisesDraft {
  name: string;
  type: Premises["type"];
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  notes: string;
}

interface AgentDraft {
  premisesId: string;
  name: string;
  status: Agent["status"];
  softwareVersion: string;
  locationDescription: string;
  hostName: string;
}

interface CameraDraft {
  name: string;
  streamUrl: string;
  status: PremisesCamera["status"];
  model: string;
  serialNumber: string;
  locationDescription: string;
}

const premisesTypes: Premises["type"][] = [
  "house",
  "apartment",
  "office",
  "factory",
  "warehouse",
  "retail",
  "other"
];

const agentStatuses: Agent["status"][] = ["online", "offline", "maintenance"];
const cameraStatuses: PremisesCamera["status"][] = [
  "online",
  "degraded",
  "offline",
  "maintenance"
];

function createEmptyPremisesDraft(): PremisesDraft {
  return {
    name: "",
    type: "house",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    countryCode: "FR",
    notes: ""
  };
}

function createEmptyAgentDraft(premisesId = ""): AgentDraft {
  return {
    premisesId,
    name: "",
    status: "offline",
    softwareVersion: "",
    locationDescription: "",
    hostName: ""
  };
}

function createEmptyCameraDraft(): CameraDraft {
  return {
    name: "",
    streamUrl: "",
    status: "offline",
    model: "",
    serialNumber: "",
    locationDescription: ""
  };
}

function isPresent(value: string) {
  return value.trim().length > 0;
}

function normalizeOptionalFields<T extends Record<string, string | undefined>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, value !== undefined && isPresent(value) ? value.trim() : undefined])
  );
}

async function apiRequest<T>(
  session: AuthSession,
  path: string,
  init?: RequestInit
): Promise<T> {
  const config = getRuntimeConfig();
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.token}`,
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const errorPayload = await response.json();
      if (typeof errorPayload?.message === "string" && errorPayload.message.length > 0) {
        message = errorPayload.message;
      }
    } catch {
      // Ignore response-body parsing failures for non-JSON or empty bodies.
    }

    const error = new Error(message) as ApiError;
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      "The API expected JSON but received HTML or another format. Check that the webapp is pointing at the backend API."
    );
  }

  return response.json() as Promise<T>;
}

function buildSignInUrl() {
  const config = getRuntimeConfig();
  const callbackUrl = new URL("/auth/callback", config.appBaseUrl).toString();
  const params = new URLSearchParams({
    applicationId: config.authServiceApplicationId,
    redirect: callbackUrl
  });

  return `${config.authServiceSignInUrl}?${params.toString()}`;
}

export function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [premises, setPremises] = useState<Premises[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [camerasByPremises, setCamerasByPremises] = useState<Record<string, PremisesCamera[]>>({});
  const [selectedPremisesId, setSelectedPremisesId] = useState<string>("");
  const [premisesDraft, setPremisesDraft] = useState(createEmptyPremisesDraft());
  const [premisesEditId, setPremisesEditId] = useState<string | null>(null);
  const [agentDraft, setAgentDraft] = useState(createEmptyAgentDraft());
  const [agentEditId, setAgentEditId] = useState<string | null>(null);
  const [cameraDraft, setCameraDraft] = useState(createEmptyCameraDraft());
  const [cameraEditId, setCameraEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [busyMessage, setBusyMessage] = useState<string>("");

  const selectedPremises = useMemo(
    () => premises.find((item) => item.id === selectedPremisesId) ?? null,
    [premises, selectedPremisesId]
  );
  const selectedAgents = useMemo(
    () => agents.filter((item) => item.premisesId === selectedPremisesId),
    [agents, selectedPremisesId]
  );
  const selectedCameras = camerasByPremises[selectedPremisesId] ?? [];

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");

    if (!token) {
      return;
    }

    try {
      const restoredSession = storeSession(token);
      setSession(restoredSession);
      setError("");
      url.searchParams.delete("token");
      const nextPath = url.pathname === "/auth/callback" ? "/" : `${url.pathname}${url.search}`;
      window.history.replaceState({}, "", nextPath === "" ? "/" : nextPath);
    } catch (sessionError) {
      clearStoredSession();
      setSession(null);
      setError(sessionError instanceof Error ? sessionError.message : "Unable to restore the session.");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [premisesResponse, agentsResponse] = await Promise.all([
          apiRequest<{ items: Premises[] }>(session, "/premises"),
          apiRequest<{ items: Agent[] }>(session, "/agents")
        ]);

        const camerasEntries = await Promise.all(
          premisesResponse.items.map(async (item) => {
            const response = await apiRequest<{ items: PremisesCamera[] }>(
              session,
              `/premises/${item.id}/cameras`
            );

            return [item.id, response.items] as const;
          })
        );

        if (cancelled) {
          return;
        }

        setPremises(premisesResponse.items);
        setAgents(agentsResponse.items);
        setCamerasByPremises(Object.fromEntries(camerasEntries));

        const defaultPremisesId =
          premisesResponse.items.find((item) => item.id === selectedPremisesId)?.id ??
          premisesResponse.items[0]?.id ??
          "";
        setSelectedPremisesId(defaultPremisesId);
        setAgentDraft((current) => createEmptyAgentDraft(defaultPremisesId || current.premisesId));
      } catch (loadError) {
        const typedError = loadError as ApiError;

        if (typedError.status === 401) {
          clearStoredSession();
          setSession(null);
        }

        setError(typedError.message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!selectedPremisesId) {
      setAgentDraft(createEmptyAgentDraft(""));
      return;
    }

    setAgentDraft((current) =>
      current.premisesId === selectedPremisesId
        ? current
        : createEmptyAgentDraft(selectedPremisesId)
    );
  }, [selectedPremisesId]);

  async function handlePremisesSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      return;
    }

    const payload = {
      name: premisesDraft.name.trim(),
      type: premisesDraft.type,
      addressLine1: premisesDraft.addressLine1.trim(),
      city: premisesDraft.city.trim(),
      countryCode: premisesDraft.countryCode.trim().toUpperCase(),
      ...normalizeOptionalFields({
        addressLine2: premisesDraft.addressLine2,
        state: premisesDraft.state,
        postalCode: premisesDraft.postalCode,
        notes: premisesDraft.notes
      })
    };

    setBusyMessage(premisesEditId ? "Saving premises..." : "Creating premises...");
    setError("");

    try {
      if (premisesEditId) {
        const response = await apiRequest<{ premises: Premises }>(
          session,
          `/premises/${premisesEditId}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload)
          }
        );
        setPremises((current) =>
          current.map((item) => (item.id === response.premises.id ? response.premises : item))
        );
      } else {
        const response = await apiRequest<{ premises: Premises }>(session, "/premises", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setPremises((current) => [...current, response.premises]);
        setSelectedPremisesId(response.premises.id);
        setCamerasByPremises((current) => ({ ...current, [response.premises.id]: [] }));
      }

      setPremisesDraft(createEmptyPremisesDraft());
      setPremisesEditId(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save premises.");
    } finally {
      setBusyMessage("");
    }
  }

  async function handleDeletePremises(premisesId: string) {
    if (!session) {
      return;
    }

    setBusyMessage("Removing premises...");
    setError("");

    try {
      await apiRequest(session, `/premises/${premisesId}`, { method: "DELETE" });
      setPremises((current) => current.filter((item) => item.id !== premisesId));
      setAgents((current) => current.filter((item) => item.premisesId !== premisesId));
      setCamerasByPremises((current) => {
        const next = { ...current };
        delete next[premisesId];
        return next;
      });
      setSelectedPremisesId((current) => (current === premisesId ? "" : current));
      if (premisesEditId === premisesId) {
        setPremisesEditId(null);
        setPremisesDraft(createEmptyPremisesDraft());
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to remove premises.");
    } finally {
      setBusyMessage("");
    }
  }

  async function handleAgentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !selectedPremisesId) {
      return;
    }

    const payload = {
      premisesId: selectedPremisesId,
      name: agentDraft.name.trim(),
      status: agentDraft.status,
      ...normalizeOptionalFields({
        softwareVersion: agentDraft.softwareVersion,
        locationDescription: agentDraft.locationDescription,
        hostName: agentDraft.hostName
      })
    };

    setBusyMessage(agentEditId ? "Saving agent..." : "Adding agent...");
    setError("");

    try {
      if (agentEditId) {
        const response = await apiRequest<{ agent: Agent }>(session, `/agents/${agentEditId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: payload.name,
            status: payload.status,
            softwareVersion: payload.softwareVersion,
            locationDescription: payload.locationDescription,
            hostName: payload.hostName
          })
        });
        setAgents((current) =>
          current.map((item) => (item.id === response.agent.id ? response.agent : item))
        );
      } else {
        const response = await apiRequest<{ agent: Agent }>(session, "/agents", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setAgents((current) => [...current, response.agent]);
      }

      setAgentDraft(createEmptyAgentDraft(selectedPremisesId));
      setAgentEditId(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save agent.");
    } finally {
      setBusyMessage("");
    }
  }

  async function handleDeleteAgent(agentId: string) {
    if (!session) {
      return;
    }

    setBusyMessage("Removing agent...");
    setError("");

    try {
      await apiRequest(session, `/agents/${agentId}`, { method: "DELETE" });
      setAgents((current) => current.filter((item) => item.id !== agentId));
      if (agentEditId === agentId) {
        setAgentEditId(null);
        setAgentDraft(createEmptyAgentDraft(selectedPremisesId));
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to remove agent.");
    } finally {
      setBusyMessage("");
    }
  }

  async function handleCameraSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !selectedPremisesId) {
      return;
    }

    const payload = {
      name: cameraDraft.name.trim(),
      streamUrl: cameraDraft.streamUrl.trim(),
      status: cameraDraft.status,
      ...normalizeOptionalFields({
        model: cameraDraft.model,
        serialNumber: cameraDraft.serialNumber,
        locationDescription: cameraDraft.locationDescription
      })
    };

    setBusyMessage(cameraEditId ? "Saving camera..." : "Adding camera...");
    setError("");

    try {
      if (cameraEditId) {
        const response = await apiRequest<{ camera: PremisesCamera }>(
          session,
          `/premises/${selectedPremisesId}/cameras/${cameraEditId}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload)
          }
        );
        setCamerasByPremises((current) => ({
          ...current,
          [selectedPremisesId]: (current[selectedPremisesId] ?? []).map((item) =>
            item.id === response.camera.id ? response.camera : item
          )
        }));
      } else {
        const response = await apiRequest<{ camera: PremisesCamera }>(
          session,
          `/premises/${selectedPremisesId}/cameras`,
          {
            method: "POST",
            body: JSON.stringify(payload)
          }
        );
        setCamerasByPremises((current) => ({
          ...current,
          [selectedPremisesId]: [...(current[selectedPremisesId] ?? []), response.camera]
        }));
      }

      setCameraDraft(createEmptyCameraDraft());
      setCameraEditId(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save camera.");
    } finally {
      setBusyMessage("");
    }
  }

  async function handleDeleteCamera(cameraId: string) {
    if (!session || !selectedPremisesId) {
      return;
    }

    setBusyMessage("Removing camera...");
    setError("");

    try {
      await apiRequest(session, `/premises/${selectedPremisesId}/cameras/${cameraId}`, {
        method: "DELETE"
      });
      setCamerasByPremises((current) => ({
        ...current,
        [selectedPremisesId]: (current[selectedPremisesId] ?? []).filter((item) => item.id !== cameraId)
      }));
      if (cameraEditId === cameraId) {
        setCameraEditId(null);
        setCameraDraft(createEmptyCameraDraft());
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to remove camera.");
    } finally {
      setBusyMessage("");
    }
  }

  function signOut() {
    clearStoredSession();
    setSession(null);
    setPremises([]);
    setAgents([]);
    setCamerasByPremises({});
    setSelectedPremisesId("");
    setPremisesDraft(createEmptyPremisesDraft());
    setAgentDraft(createEmptyAgentDraft());
    setCameraDraft(createEmptyCameraDraft());
  }

  if (!session) {
    return (
      <div className="auth-shell">
        <section className="auth-card">
          <img src="/vectis-logo-full-color.png" alt="Vectis" className="brand-mark" />
          <p className="eyebrow">Life2 secured workspace</p>
          <h1>Secure operations for distributed sites</h1>
          <p className="lead">
            Sign in with the hosted Life2 auth flow, then manage premises and the field hardware attached to each site.
          </p>
          {error ? <p className="error-banner">{error}</p> : null}
          <a className="primary-link" href={buildSignInUrl()}>
            Sign in with Life2
          </a>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <img src="/vectis-logo-icon-color.png" alt="Vectis" className="sidebar-logo" />
          <p className="eyebrow">Operations console</p>
          <h1>Premises control</h1>
          <p className="sidebar-copy">
            Tenant: <strong>{session.tenantId}</strong>
          </p>
          <p className="sidebar-copy">
            Operator: <strong>{session.displayName ?? session.email ?? session.userId}</strong>
          </p>
        </div>

        <div className="sidebar-stats">
          <div className="stat-card">
            <span>Premises</span>
            <strong>{premises.length}</strong>
          </div>
          <div className="stat-card">
            <span>Agents</span>
            <strong>{agents.length}</strong>
          </div>
          <div className="stat-card">
            <span>Cameras</span>
            <strong>{Object.values(camerasByPremises).flat().length}</strong>
          </div>
        </div>

        <button className="ghost-button" type="button" onClick={signOut}>
          Sign out
        </button>
      </aside>

      <main className="workspace">
        <section className="hero">
          <div>
            <p className="eyebrow">Deployment inventory</p>
            <h2>Premises, agents, and cameras in one place</h2>
            <p className="lead">
              Start with a premises, then attach the agents and cameras that belong to that location.
            </p>
          </div>
          <div className="hero-status">
            <span>{loading ? "Refreshing data..." : "Data synced"}</span>
            <strong>{busyMessage || "Ready for updates"}</strong>
          </div>
        </section>

        {error ? <p className="error-banner">{error}</p> : null}

        <section className="content-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Premises</p>
                <h3>{premisesEditId ? "Update premises" : "Create premises"}</h3>
              </div>
            </div>
            <form className="form-grid" onSubmit={handlePremisesSubmit}>
              <label>
                <span>Premises name</span>
                <input
                  value={premisesDraft.name}
                  onChange={(event) => setPremisesDraft((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Premises type</span>
                <select
                  value={premisesDraft.type}
                  onChange={(event) =>
                    setPremisesDraft((current) => ({
                      ...current,
                      type: event.target.value as Premises["type"]
                    }))
                  }
                >
                  {premisesTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full-span">
                <span>Address line 1</span>
                <input
                  value={premisesDraft.addressLine1}
                  onChange={(event) =>
                    setPremisesDraft((current) => ({ ...current, addressLine1: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="full-span">
                <span>Address line 2</span>
                <input
                  value={premisesDraft.addressLine2}
                  onChange={(event) =>
                    setPremisesDraft((current) => ({ ...current, addressLine2: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>City</span>
                <input
                  value={premisesDraft.city}
                  onChange={(event) => setPremisesDraft((current) => ({ ...current, city: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span>State</span>
                <input
                  value={premisesDraft.state}
                  onChange={(event) => setPremisesDraft((current) => ({ ...current, state: event.target.value }))}
                />
              </label>
              <label>
                <span>Postal code</span>
                <input
                  value={premisesDraft.postalCode}
                  onChange={(event) =>
                    setPremisesDraft((current) => ({ ...current, postalCode: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Country code</span>
                <input
                  value={premisesDraft.countryCode}
                  onChange={(event) =>
                    setPremisesDraft((current) => ({ ...current, countryCode: event.target.value }))
                  }
                  maxLength={2}
                  required
                />
              </label>
              <label className="full-span">
                <span>Notes</span>
                <textarea
                  value={premisesDraft.notes}
                  onChange={(event) => setPremisesDraft((current) => ({ ...current, notes: event.target.value }))}
                  rows={3}
                />
              </label>
              <div className="form-actions full-span">
                <button className="primary-button" type="submit">
                  {premisesEditId ? "Save premises" : "Create premises"}
                </button>
                {premisesEditId ? (
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setPremisesEditId(null);
                      setPremisesDraft(createEmptyPremisesDraft());
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>

            <div className="stack-list">
              {premises.map((item) => (
                <div key={item.id} className={`list-card ${item.id === selectedPremisesId ? "selected" : ""}`}>
                  <button type="button" className="card-select" onClick={() => setSelectedPremisesId(item.id)}>
                    <span>{item.name}</span>
                    <small>
                      {item.type} · {item.city}, {item.countryCode}
                    </small>
                  </button>
                  <div className="inline-actions">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => {
                        setSelectedPremisesId(item.id);
                        setPremisesEditId(item.id);
                        setPremisesDraft({
                          name: item.name,
                          type: item.type,
                          addressLine1: item.addressLine1,
                          addressLine2: item.addressLine2 ?? "",
                          city: item.city,
                          state: item.state ?? "",
                          postalCode: item.postalCode ?? "",
                          countryCode: item.countryCode,
                          notes: item.notes ?? ""
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button className="danger-button" type="button" onClick={() => void handleDeletePremises(item.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel detail-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Selected premises</p>
                <h3>{selectedPremises?.name ?? "Choose a premises"}</h3>
              </div>
              {selectedPremises ? (
                <span className="pill">
                  {selectedAgents.length} agents · {selectedCameras.length} cameras
                </span>
              ) : null}
            </div>

            {selectedPremises ? (
              <>
                <div className="detail-summary">
                  <p>{selectedPremises.addressLine1}</p>
                  <p>
                    {selectedPremises.city}
                    {selectedPremises.state ? `, ${selectedPremises.state}` : ""} {selectedPremises.postalCode ?? ""}
                  </p>
                  {selectedPremises.notes ? <p>{selectedPremises.notes}</p> : null}
                </div>

                <div className="nested-grid">
                  <section className="nested-panel">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Agents</p>
                        <h4>{agentEditId ? "Update agent" : "Add agent"}</h4>
                      </div>
                    </div>
                    <form className="form-grid" onSubmit={handleAgentSubmit}>
                      <label>
                        <span>Agent name</span>
                        <input
                          value={agentDraft.name}
                          onChange={(event) =>
                            setAgentDraft((current) => ({ ...current, name: event.target.value }))
                          }
                          required
                        />
                      </label>
                      <label>
                        <span>Agent status</span>
                        <select
                          value={agentDraft.status}
                          onChange={(event) =>
                            setAgentDraft((current) => ({
                              ...current,
                              status: event.target.value as Agent["status"]
                            }))
                          }
                        >
                          {agentStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Software version</span>
                        <input
                          value={agentDraft.softwareVersion}
                          onChange={(event) =>
                            setAgentDraft((current) => ({
                              ...current,
                              softwareVersion: event.target.value
                            }))
                          }
                        />
                      </label>
                      <label>
                        <span>Host name</span>
                        <input
                          value={agentDraft.hostName}
                          onChange={(event) =>
                            setAgentDraft((current) => ({ ...current, hostName: event.target.value }))
                          }
                        />
                      </label>
                      <label className="full-span">
                        <span>Location description</span>
                        <input
                          value={agentDraft.locationDescription}
                          onChange={(event) =>
                            setAgentDraft((current) => ({
                              ...current,
                              locationDescription: event.target.value
                            }))
                          }
                        />
                      </label>
                      <div className="form-actions full-span">
                        <button className="primary-button" type="submit">
                          {agentEditId ? "Save agent" : "Add agent"}
                        </button>
                        {agentEditId ? (
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => {
                              setAgentEditId(null);
                              setAgentDraft(createEmptyAgentDraft(selectedPremisesId));
                            }}
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </form>

                    <div className="stack-list">
                      {selectedAgents.map((item) => (
                        <div key={item.id} className="list-card compact" data-testid={`agent-${item.id}`}>
                          <div>
                            <span>{item.name}</span>
                            <small>
                              {item.status}
                              {item.softwareVersion ? ` · ${item.softwareVersion}` : ""}
                            </small>
                          </div>
                          <div className="inline-actions">
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => {
                                setAgentEditId(item.id);
                                setAgentDraft({
                                  premisesId: item.premisesId,
                                  name: item.name,
                                  status: item.status,
                                  softwareVersion: item.softwareVersion ?? "",
                                  locationDescription: item.locationDescription ?? "",
                                  hostName: item.hostName ?? ""
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button className="danger-button" type="button" onClick={() => void handleDeleteAgent(item.id)}>
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="nested-panel">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Cameras</p>
                        <h4>{cameraEditId ? "Update camera" : "Add camera"}</h4>
                      </div>
                    </div>
                    <form className="form-grid" onSubmit={handleCameraSubmit}>
                      <label>
                        <span>Camera name</span>
                        <input
                          value={cameraDraft.name}
                          onChange={(event) =>
                            setCameraDraft((current) => ({ ...current, name: event.target.value }))
                          }
                          required
                        />
                      </label>
                      <label>
                        <span>Camera status</span>
                        <select
                          value={cameraDraft.status}
                          onChange={(event) =>
                            setCameraDraft((current) => ({
                              ...current,
                              status: event.target.value as PremisesCamera["status"]
                            }))
                          }
                        >
                          {cameraStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="full-span">
                        <span>Stream URL</span>
                        <input
                          value={cameraDraft.streamUrl}
                          onChange={(event) =>
                            setCameraDraft((current) => ({
                              ...current,
                              streamUrl: event.target.value
                            }))
                          }
                          required
                        />
                      </label>
                      <label>
                        <span>Model</span>
                        <input
                          value={cameraDraft.model}
                          onChange={(event) =>
                            setCameraDraft((current) => ({ ...current, model: event.target.value }))
                          }
                        />
                      </label>
                      <label>
                        <span>Serial number</span>
                        <input
                          value={cameraDraft.serialNumber}
                          onChange={(event) =>
                            setCameraDraft((current) => ({
                              ...current,
                              serialNumber: event.target.value
                            }))
                          }
                        />
                      </label>
                      <label className="full-span">
                        <span>Location description</span>
                        <input
                          value={cameraDraft.locationDescription}
                          onChange={(event) =>
                            setCameraDraft((current) => ({
                              ...current,
                              locationDescription: event.target.value
                            }))
                          }
                        />
                      </label>
                      <div className="form-actions full-span">
                        <button className="primary-button" type="submit">
                          {cameraEditId ? "Save camera" : "Add camera"}
                        </button>
                        {cameraEditId ? (
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => {
                              setCameraEditId(null);
                              setCameraDraft(createEmptyCameraDraft());
                            }}
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </form>

                    <div className="stack-list">
                      {selectedCameras.map((item) => (
                        <div key={item.id} className="list-card compact" data-testid={`camera-${item.id}`}>
                          <div>
                            <span>{item.name}</span>
                            <small>
                              {item.status}
                              {item.locationDescription ? ` · ${item.locationDescription}` : ""}
                            </small>
                          </div>
                          <div className="inline-actions">
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => {
                                setCameraEditId(item.id);
                                setCameraDraft({
                                  name: item.name,
                                  streamUrl: item.streamUrl,
                                  status: item.status,
                                  model: item.model ?? "",
                                  serialNumber: item.serialNumber ?? "",
                                  locationDescription: item.locationDescription ?? ""
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button className="danger-button" type="button" onClick={() => void handleDeleteCamera(item.id)}>
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <p className="empty-state">Create a premises or select one from the list to manage its agents and cameras.</p>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}
