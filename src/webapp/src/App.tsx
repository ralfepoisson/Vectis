import {
  automationRules,
  cameraSources,
  platformOverview,
  visionEvents
} from "@vectis/shared";

const statusTone: Record<string, string> = {
  online: "Online",
  degraded: "Degraded",
  offline: "Offline"
};

export function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <img
            className="sidebar-logo"
            src="/vectis-logo-icon-color.png"
            alt="Vectis"
          />
          <p className="sidebar-eyebrow">Vectis</p>
          <h1>Control Center</h1>
          <p className="sidebar-copy">
            {platformOverview.valueProposition}
          </p>
        </div>
        <nav className="sidebar-nav">
          <a href="#overview">Overview</a>
          <a href="#cameras">Cameras</a>
          <a href="#events">Events</a>
          <a href="#rules">Rules</a>
        </nav>
        <div className="capture-flow">
          {platformOverview.captureToAction.map((step) => (
            <span key={step}>{step}</span>
          ))}
        </div>
      </aside>

      <main className="dashboard">
        <section className="top-panel" id="overview">
          <div>
            <p className="section-eyebrow">Mission status</p>
            <h2>Operator-ready visual intelligence</h2>
            <p className="section-copy">
              A first-pass dashboard for the MVP: live sources, event feed, and
              rules that can turn detections into meaningful actions.
            </p>
          </div>
          <div className="metric-grid">
            <article className="metric-card">
              <span>Active cameras</span>
              <strong>{cameraSources.filter((camera) => camera.status !== "offline").length}</strong>
            </article>
            <article className="metric-card">
              <span>High-severity events</span>
              <strong>{visionEvents.filter((event) => event.severity === "high").length}</strong>
            </article>
            <article className="metric-card">
              <span>Enabled rules</span>
              <strong>{automationRules.filter((rule) => rule.enabled).length}</strong>
            </article>
          </div>
        </section>

        <section className="content-grid">
          <article className="panel" id="cameras">
            <div className="panel-header">
              <div>
                <p className="section-eyebrow">Camera health</p>
                <h3>Ingress and industrial coverage</h3>
              </div>
              <span className="panel-badge">3 connected feeds</span>
            </div>
            <div className="camera-list">
              {cameraSources.map((camera) => (
                <div key={camera.id} className="camera-row">
                  <div>
                    <p className="camera-name">{camera.name}</p>
                    <p className="camera-meta">{camera.location}</p>
                  </div>
                  <div className="camera-state">
                    <span className={`status-pill status-${camera.status}`}>
                      {statusTone[camera.status]}
                    </span>
                    <span>{camera.fps} FPS</span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel emphasis-panel" id="events">
            <div className="panel-header">
              <div>
                <p className="section-eyebrow">Event feed</p>
                <h3>Structured observations</h3>
              </div>
              <span className="panel-badge">Live sample data</span>
            </div>
            <div className="event-list">
              {visionEvents.map((event) => (
                <div key={event.id} className="event-row">
                  <div>
                    <p className="event-type">{event.eventType.replace("_", " ")}</p>
                    <p className="event-summary">{event.summary}</p>
                  </div>
                  <div className="event-meta">
                    <span>{event.source}</span>
                    <span>{Math.round(event.confidence * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel" id="rules">
            <div className="panel-header">
              <div>
                <p className="section-eyebrow">Automation</p>
                <h3>Rules and downstream actions</h3>
              </div>
              <span className="panel-badge">Decision layer</span>
            </div>
            <div className="rule-list">
              {automationRules.map((rule) => (
                <div key={rule.id} className="rule-card">
                  <p className="rule-title">{rule.name}</p>
                  <p className="rule-condition">{rule.condition}</p>
                  <p className="rule-result">{rule.action}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
