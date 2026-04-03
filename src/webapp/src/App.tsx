import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { Agent, Premises, PremisesCamera } from "@vectis/shared";

import { clearStoredSession, getStoredSession, storeSession, type AuthSession } from "./auth";
import { getRuntimeConfig } from "./config";

interface ApiError extends Error {
  status?: number;
}

interface Toast {
  id: number;
  tone: "success" | "error";
  message: string;
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

type Selection =
  | { kind: "premises"; id: string }
  | { kind: "agent"; id: string }
  | { kind: "camera"; id: string }
  | null;

type ModalState =
  | { kind: "premises" }
  | { kind: "agent"; premisesId: string }
  | { kind: "camera"; premisesId: string }
  | null;

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

function createPremisesDraftFromEntity(entity: Premises): PremisesDraft {
  return {
    name: entity.name,
    type: entity.type,
    addressLine1: entity.addressLine1,
    addressLine2: entity.addressLine2 ?? "",
    city: entity.city,
    state: entity.state ?? "",
    postalCode: entity.postalCode ?? "",
    countryCode: entity.countryCode,
    notes: entity.notes ?? ""
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

function createAgentDraftFromEntity(entity: Agent): AgentDraft {
  return {
    premisesId: entity.premisesId,
    name: entity.name,
    status: entity.status,
    softwareVersion: entity.softwareVersion ?? "",
    locationDescription: entity.locationDescription ?? "",
    hostName: entity.hostName ?? ""
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

function createCameraDraftFromEntity(entity: PremisesCamera): CameraDraft {
  return {
    name: entity.name,
    streamUrl: entity.streamUrl,
    status: entity.status,
    model: entity.model ?? "",
    serialNumber: entity.serialNumber ?? "",
    locationDescription: entity.locationDescription ?? ""
  };
}

function normalizeOptionalFields<T extends Record<string, string | undefined>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      const trimmed = value?.trim();
      return [key, trimmed ? trimmed : undefined];
    })
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
      // ignore JSON parse failures for error payloads
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

function ToastRegion({
  toasts,
  onDismiss
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="toast-region" role="status" aria-label="Notification center">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`}>
          <span>{toast.message}</span>
          <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
            Close
          </button>
        </div>
      ))}
    </div>
  );
}

function CreationModal({
  modalState,
  premisesDraft,
  setPremisesDraft,
  agentDraft,
  setAgentDraft,
  cameraDraft,
  setCameraDraft,
  onClose,
  onSubmit
}: {
  modalState: ModalState;
  premisesDraft: PremisesDraft;
  setPremisesDraft: Dispatch<SetStateAction<PremisesDraft>>;
  agentDraft: AgentDraft;
  setAgentDraft: Dispatch<SetStateAction<AgentDraft>>;
  cameraDraft: CameraDraft;
  setCameraDraft: Dispatch<SetStateAction<CameraDraft>>;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!modalState) {
    return null;
  }

  const title =
    modalState.kind === "premises"
      ? "Create premises"
      : modalState.kind === "agent"
        ? "Create agent"
        : "Create camera";

  return (
    <div className="modal-backdrop">
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <div>
            <p className="section-kicker">Create</p>
            <h2>{title}</h2>
          </div>
          <button type="button" className="text-button" onClick={onClose}>
            Close
          </button>
        </div>

        {modalState.kind === "premises" ? (
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <label>
              <span>Premises name</span>
              <input
                value={premisesDraft.name}
                onChange={(event) =>
                  setPremisesDraft((current) => ({ ...current, name: event.target.value }))
                }
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
            <label className="form-span-2">
              <span>Address line 1</span>
              <input
                value={premisesDraft.addressLine1}
                onChange={(event) =>
                  setPremisesDraft((current) => ({ ...current, addressLine1: event.target.value }))
                }
                required
              />
            </label>
            <label className="form-span-2">
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
                onChange={(event) =>
                  setPremisesDraft((current) => ({ ...current, city: event.target.value }))
                }
                required
              />
            </label>
            <label>
              <span>State</span>
              <input
                value={premisesDraft.state}
                onChange={(event) =>
                  setPremisesDraft((current) => ({ ...current, state: event.target.value }))
                }
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
            <label className="form-span-2">
              <span>Notes</span>
              <textarea
                rows={4}
                value={premisesDraft.notes}
                onChange={(event) =>
                  setPremisesDraft((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </label>
            <div className="modal-actions form-span-2">
              <button className="primary-button" type="submit">
                Create premises
              </button>
            </div>
          </form>
        ) : null}

        {modalState.kind === "agent" ? (
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
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
            <label className="form-span-2">
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
            <div className="modal-actions form-span-2">
              <button className="primary-button" type="submit">
                Create agent
              </button>
            </div>
          </form>
        ) : null}

        {modalState.kind === "camera" ? (
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
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
            <label className="form-span-2">
              <span>Stream URL</span>
              <input
                value={cameraDraft.streamUrl}
                onChange={(event) =>
                  setCameraDraft((current) => ({ ...current, streamUrl: event.target.value }))
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
                  setCameraDraft((current) => ({ ...current, serialNumber: event.target.value }))
                }
              />
            </label>
            <label className="form-span-2">
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
            <div className="modal-actions form-span-2">
              <button className="primary-button" type="submit">
                Create camera
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function AuthGate({ error }: { error: string | null }) {
  return (
    <div className="auth-shell">
      <section className="auth-card">
        <img src="/vectis-logo-full-color.png" alt="Vectis" className="brand-mark" />
        <p className="section-kicker">Life2 secured workspace</p>
        <h1>Secure operations for distributed sites</h1>
        <p className="section-copy">
          Sign in with the hosted Life2 auth flow to manage premises, field agents, and cameras.
        </p>
        {error ? <p className="auth-copy">{error}</p> : null}
        <a className="primary-button button-link" href={buildSignInUrl()}>
          Sign in with Life2
        </a>
      </section>
    </div>
  );
}

export function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [premises, setPremises] = useState<Premises[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [camerasByPremises, setCamerasByPremises] = useState<Record<string, PremisesCamera[]>>({});
  const [selection, setSelection] = useState<Selection>(null);
  const [activePage, setActivePage] = useState<"home" | "premises" | "configuration">("premises");
  const [modalState, setModalState] = useState<ModalState>(null);
  const [premisesDraft, setPremisesDraft] = useState(createEmptyPremisesDraft());
  const [agentDraft, setAgentDraft] = useState(createEmptyAgentDraft());
  const [cameraDraft, setCameraDraft] = useState(createEmptyCameraDraft());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const selectedPremises = useMemo(() => {
    if (selection?.kind === "premises") {
      return premises.find((item) => item.id === selection.id) ?? null;
    }

    if (selection?.kind === "agent") {
      const agent = agents.find((item) => item.id === selection.id);
      return agent ? premises.find((item) => item.id === agent.premisesId) ?? null : null;
    }

    if (selection?.kind === "camera") {
      const camera = Object.values(camerasByPremises)
        .flat()
        .find((item) => item.id === selection.id);
      return camera ? premises.find((item) => item.id === camera.premisesId) ?? null : null;
    }

    return premises[0] ?? null;
  }, [agents, camerasByPremises, premises, selection]);

  const selectedAgents = useMemo(
    () => agents.filter((item) => item.premisesId === selectedPremises?.id),
    [agents, selectedPremises]
  );

  const selectedCameras = useMemo(
    () => (selectedPremises ? camerasByPremises[selectedPremises.id] ?? [] : []),
    [camerasByPremises, selectedPremises]
  );

  const selectedAgent = selection?.kind === "agent"
    ? agents.find((item) => item.id === selection.id) ?? null
    : null;
  const selectedCamera = selection?.kind === "camera"
    ? Object.values(camerasByPremises)
        .flat()
        .find((item) => item.id === selection.id) ?? null
    : null;

  const editorKind = selection?.kind ?? (selectedPremises ? "premises" : null);

  function pushToast(tone: Toast["tone"], message: string) {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4000);
  }

  function dismissToast(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");

    if (!token) {
      return;
    }

    try {
      const restoredSession = storeSession(token);
      setSession(restoredSession);
      setAuthError(null);
      url.searchParams.delete("token");
      const nextPath = url.pathname === "/auth/callback" ? "/" : `${url.pathname}${url.search}`;
      window.history.replaceState({}, "", nextPath || "/");
    } catch (error) {
      clearStoredSession();
      setSession(null);
      setAuthError(error instanceof Error ? error.message : "Unable to restore the session.");
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

      try {
        const [premisesResponse, agentsResponse] = await Promise.all([
          apiRequest<{ items: Premises[] }>(session, "/premises"),
          apiRequest<{ items: Agent[] }>(session, "/agents")
        ]);

        const cameraEntries = await Promise.all(
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
        setCamerasByPremises(Object.fromEntries(cameraEntries));

        const defaultSelection =
          premisesResponse.items[0] ? { kind: "premises" as const, id: premisesResponse.items[0].id } : null;
        setSelection((current) => current ?? defaultSelection);
      } catch (error) {
        const typedError = error as ApiError;

        if (typedError.status === 401) {
          clearStoredSession();
          setSession(null);
          return;
        }

        pushToast("error", typedError.message);
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
    if (selection?.kind === "premises") {
      const entity = premises.find((item) => item.id === selection.id);
      if (entity) {
        setPremisesDraft(createPremisesDraftFromEntity(entity));
      }
    }

    if (selection?.kind === "agent") {
      const entity = agents.find((item) => item.id === selection.id);
      if (entity) {
        setAgentDraft(createAgentDraftFromEntity(entity));
      }
    }

    if (selection?.kind === "camera") {
      const entity = Object.values(camerasByPremises)
        .flat()
        .find((item) => item.id === selection.id);
      if (entity) {
        setCameraDraft(createCameraDraftFromEntity(entity));
      }
    }
  }, [agents, camerasByPremises, premises, selection]);

  if (!session) {
    return <AuthGate error={authError} />;
  }

  async function handleCreatePremises() {
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

    try {
      const response = await apiRequest<{ premises: Premises }>(session, "/premises", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setPremises((current) => [...current, response.premises]);
      setCamerasByPremises((current) => ({ ...current, [response.premises.id]: [] }));
      setSelection({ kind: "premises", id: response.premises.id });
      setPremisesDraft(createEmptyPremisesDraft());
      setModalState(null);
      pushToast("success", "Premises created");
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Unable to create premises.");
    }
  }

  async function handleCreateAgent() {
    if (!selectedPremises) {
      return;
    }

    try {
      const response = await apiRequest<{ agent: Agent }>(session, "/agents", {
        method: "POST",
        body: JSON.stringify({
          premisesId: selectedPremises.id,
          name: agentDraft.name.trim(),
          status: agentDraft.status,
          ...normalizeOptionalFields({
            softwareVersion: agentDraft.softwareVersion,
            locationDescription: agentDraft.locationDescription,
            hostName: agentDraft.hostName
          })
        })
      });
      setAgents((current) => [...current, response.agent]);
      setSelection({ kind: "agent", id: response.agent.id });
      setAgentDraft(createEmptyAgentDraft(selectedPremises.id));
      setModalState(null);
      pushToast("success", "Agent created");
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Unable to create agent.");
    }
  }

  async function handleCreateCamera() {
    if (!selectedPremises) {
      return;
    }

    try {
      const response = await apiRequest<{ camera: PremisesCamera }>(
        session,
        `/premises/${selectedPremises.id}/cameras`,
        {
          method: "POST",
          body: JSON.stringify({
            name: cameraDraft.name.trim(),
            streamUrl: cameraDraft.streamUrl.trim(),
            status: cameraDraft.status,
            ...normalizeOptionalFields({
              model: cameraDraft.model,
              serialNumber: cameraDraft.serialNumber,
              locationDescription: cameraDraft.locationDescription
            })
          })
        }
      );
      setCamerasByPremises((current) => ({
        ...current,
        [selectedPremises.id]: [...(current[selectedPremises.id] ?? []), response.camera]
      }));
      setSelection({ kind: "camera", id: response.camera.id });
      setCameraDraft(createEmptyCameraDraft());
      setModalState(null);
      pushToast("success", "Camera created");
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Unable to create camera.");
    }
  }

  async function handleSaveSelection() {
    try {
      if (selection?.kind === "premises" && selectedPremises) {
        const response = await apiRequest<{ premises: Premises }>(
          session,
          `/premises/${selectedPremises.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
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
            })
          }
        );
        setPremises((current) =>
          current.map((item) => (item.id === response.premises.id ? response.premises : item))
        );
      }

      if (selection?.kind === "agent" && selectedAgent) {
        const response = await apiRequest<{ agent: Agent }>(session, `/agents/${selectedAgent.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: agentDraft.name.trim(),
            status: agentDraft.status,
            ...normalizeOptionalFields({
              softwareVersion: agentDraft.softwareVersion,
              locationDescription: agentDraft.locationDescription,
              hostName: agentDraft.hostName
            })
          })
        });
        setAgents((current) =>
          current.map((item) => (item.id === response.agent.id ? response.agent : item))
        );
      }

      if (selection?.kind === "camera" && selectedCamera && selectedPremises) {
        const response = await apiRequest<{ camera: PremisesCamera }>(
          session,
          `/premises/${selectedPremises.id}/cameras/${selectedCamera.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              name: cameraDraft.name.trim(),
              streamUrl: cameraDraft.streamUrl.trim(),
              status: cameraDraft.status,
              ...normalizeOptionalFields({
                model: cameraDraft.model,
                serialNumber: cameraDraft.serialNumber,
                locationDescription: cameraDraft.locationDescription
              })
            })
          }
        );
        setCamerasByPremises((current) => ({
          ...current,
          [selectedPremises.id]: (current[selectedPremises.id] ?? []).map((item) =>
            item.id === response.camera.id ? response.camera : item
          )
        }));
      }

      pushToast("success", "Changes saved");
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Unable to save changes.");
    }
  }

  const profileLabel = session.displayName ?? session.email ?? session.userId;

  return (
    <div className="app-shell">
      <ToastRegion toasts={toasts} onDismiss={dismissToast} />

      <CreationModal
        modalState={modalState}
        premisesDraft={premisesDraft}
        setPremisesDraft={setPremisesDraft}
        agentDraft={agentDraft}
        setAgentDraft={setAgentDraft}
        cameraDraft={cameraDraft}
        setCameraDraft={setCameraDraft}
        onClose={() => setModalState(null)}
        onSubmit={() => {
          if (modalState?.kind === "premises") {
            void handleCreatePremises();
          }
          if (modalState?.kind === "agent") {
            void handleCreateAgent();
          }
          if (modalState?.kind === "camera") {
            void handleCreateCamera();
          }
        }}
      />

      <header className="top-nav">
        <div className="brand-lockup">
          <img src="/vectis-logo-icon-color.png" alt="Vectis" className="nav-logo" />
          <span>Vectis</span>
        </div>

        <nav className="nav-actions" aria-label="Main menu">
          <button type="button" className={activePage === "home" ? "nav-pill active" : "nav-pill"} onClick={() => setActivePage("home")}>
            Home
          </button>
          <button type="button" className={activePage === "premises" ? "nav-pill active" : "nav-pill"} onClick={() => setActivePage("premises")}>
            Premises
          </button>
          <button type="button" className={activePage === "configuration" ? "nav-pill active" : "nav-pill"} onClick={() => setActivePage("configuration")}>
            Configuration
          </button>
          {session.isAdmin ? (
            <details className="nav-dropdown">
              <summary className="nav-pill">Admin</summary>
              <div className="dropdown-menu">
                <button type="button">Users</button>
                <button type="button">Audit</button>
              </div>
            </details>
          ) : null}
          <button type="button" className="nav-pill profile-pill">
            {profileLabel}
          </button>
          <button
            type="button"
            className="nav-pill"
            onClick={() => {
              clearStoredSession();
              setSession(null);
            }}
          >
            Sign out
          </button>
        </nav>
      </header>

      {activePage !== "premises" ? (
        <main className="placeholder-shell">
          <section className="placeholder-card">
            <p className="section-kicker">{activePage}</p>
            <h1>{activePage === "home" ? "Home dashboard coming next" : "Configuration workspace coming next"}</h1>
            <p className="section-copy">
              The initial release is centered on premises, agents, and cameras. This section is reserved for the next iteration.
            </p>
          </section>
        </main>
      ) : (
        <main className="workspace">
          <section className="workspace-header">
            <div>
              <p className="section-kicker">Premises management</p>
              <h1>Sites, edge agents, and camera inventory</h1>
              <p className="section-copy">
                Select a premises on the left, inspect its hardware in the middle, and update the current record in the editor.
              </p>
            </div>
            <div className="workspace-meta">
              <span>{loading ? "Refreshing" : "Synced"}</span>
              <strong>{selectedPremises?.name ?? "No premises selected"}</strong>
            </div>
          </section>

          <section className="workspace-grid">
            <aside className="panel rail-panel">
              <div className="panel-head">
                <div>
                  <p className="section-kicker">Premises</p>
                  <h2>All premises</h2>
                </div>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setPremisesDraft(createEmptyPremisesDraft());
                    setModalState({ kind: "premises" });
                  }}
                >
                  + Premises
                </button>
              </div>

              <div className="list-stack">
                {premises.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={
                      selection?.kind === "premises" && selection.id === item.id
                        ? "list-item selected"
                        : "list-item"
                    }
                    onClick={() => setSelection({ kind: "premises", id: item.id })}
                  >
                    <span>{item.name}</span>
                    <small>
                      {item.type} · {item.city}
                    </small>
                  </button>
                ))}
              </div>
            </aside>

            <aside className="panel rail-panel">
              <div className="panel-head">
                <div>
                  <p className="section-kicker">Assets</p>
                  <h2>Agents and cameras</h2>
                </div>
              </div>

              <div className="asset-group">
                <div className="asset-group-head">
                  <h3>Agents</h3>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!selectedPremises}
                    onClick={() => {
                      if (!selectedPremises) {
                        return;
                      }
                      setAgentDraft(createEmptyAgentDraft(selectedPremises.id));
                      setModalState({ kind: "agent", premisesId: selectedPremises.id });
                    }}
                  >
                    + Agent
                  </button>
                </div>

                <div className="list-stack">
                  {selectedAgents.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={
                        selection?.kind === "agent" && selection.id === item.id
                          ? "list-item selected"
                          : "list-item"
                      }
                      onClick={() => setSelection({ kind: "agent", id: item.id })}
                    >
                      <span>{item.name}</span>
                      <small>{item.status}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="asset-group">
                <div className="asset-group-head">
                  <h3>Cameras</h3>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!selectedPremises}
                    onClick={() => {
                      if (!selectedPremises) {
                        return;
                      }
                      setCameraDraft(createEmptyCameraDraft());
                      setModalState({ kind: "camera", premisesId: selectedPremises.id });
                    }}
                  >
                    + Camera
                  </button>
                </div>

                <div className="list-stack">
                  {selectedCameras.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={
                        selection?.kind === "camera" && selection.id === item.id
                          ? "list-item selected"
                          : "list-item"
                      }
                      onClick={() => setSelection({ kind: "camera", id: item.id })}
                    >
                      <span>{item.name}</span>
                      <small>{item.status}</small>
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <section className="panel editor-panel">
              {editorKind === "premises" && selectedPremises ? (
                <>
                  <div className="panel-head">
                    <div>
                      <p className="section-kicker">Editor</p>
                      <h2>Edit premises</h2>
                    </div>
                  </div>

                  <form
                    className="form-grid"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleSaveSelection();
                    }}
                  >
                    <label>
                      <span>Premises name</span>
                      <input
                        value={premisesDraft.name}
                        onChange={(event) =>
                          setPremisesDraft((current) => ({ ...current, name: event.target.value }))
                        }
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
                    <label className="form-span-2">
                      <span>Address line 1</span>
                      <input
                        value={premisesDraft.addressLine1}
                        onChange={(event) =>
                          setPremisesDraft((current) => ({ ...current, addressLine1: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label className="form-span-2">
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
                        onChange={(event) =>
                          setPremisesDraft((current) => ({ ...current, city: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label>
                      <span>State</span>
                      <input
                        value={premisesDraft.state}
                        onChange={(event) =>
                          setPremisesDraft((current) => ({ ...current, state: event.target.value }))
                        }
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
                    <label className="form-span-2">
                      <span>Notes</span>
                      <textarea
                        rows={6}
                        value={premisesDraft.notes}
                        onChange={(event) =>
                          setPremisesDraft((current) => ({ ...current, notes: event.target.value }))
                        }
                      />
                    </label>
                    <div className="editor-actions form-span-2">
                      <button className="primary-button" type="submit">
                        Save changes
                      </button>
                    </div>
                  </form>
                </>
              ) : null}

              {editorKind === "agent" && selectedAgent ? (
                <>
                  <div className="panel-head">
                    <div>
                      <p className="section-kicker">Editor</p>
                      <h2>Edit agent</h2>
                    </div>
                  </div>
                  <form
                    className="form-grid"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleSaveSelection();
                    }}
                  >
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
                    <label className="form-span-2">
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
                    <div className="editor-actions form-span-2">
                      <button className="primary-button" type="submit">
                        Save changes
                      </button>
                    </div>
                  </form>
                </>
              ) : null}

              {editorKind === "camera" && selectedCamera ? (
                <>
                  <div className="panel-head">
                    <div>
                      <p className="section-kicker">Editor</p>
                      <h2>Edit camera</h2>
                    </div>
                  </div>
                  <form
                    className="form-grid"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleSaveSelection();
                    }}
                  >
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
                    <label className="form-span-2">
                      <span>Stream URL</span>
                      <input
                        value={cameraDraft.streamUrl}
                        onChange={(event) =>
                          setCameraDraft((current) => ({ ...current, streamUrl: event.target.value }))
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
                          setCameraDraft((current) => ({ ...current, serialNumber: event.target.value }))
                        }
                      />
                    </label>
                    <label className="form-span-2">
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
                    <div className="editor-actions form-span-2">
                      <button className="primary-button" type="submit">
                        Save changes
                      </button>
                    </div>
                  </form>
                </>
              ) : null}

              {!editorKind ? (
                <div className="empty-editor">
                  <p className="section-kicker">Editor</p>
                  <h2>Select a record to edit</h2>
                  <p className="section-copy">
                    Use the left rail to choose a premises, then pick an agent or camera from the middle rail.
                  </p>
                </div>
              ) : null}
            </section>
          </section>
        </main>
      )}
    </div>
  );
}
