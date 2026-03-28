import { automationRules, platformOverview } from "@vectis/shared";

const platformPillars = [
  {
    title: "Perception Pipeline",
    description:
      "Ingest RTSP streams, uploads, and edge captures into a unified event-first flow."
  },
  {
    title: "Rules and Agents",
    description:
      "Turn detection output into notifications, workflows, and AI-assisted operational decisions."
  },
  {
    title: "Operator Visibility",
    description:
      "Give teams a live command surface with timelines, health signals, and accountable automation."
  }
];

export function App() {
  return (
    <div className="site-shell">
      <header className="hero">
        <nav className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">
              <span />
            </div>
            <div>
              <p className="brand-name">Vectis</p>
              <p className="brand-tagline">{platformOverview.tagline}</p>
            </div>
          </div>
          <div className="nav-actions">
            <a href="#platform">Platform</a>
            <a href="#use-cases">Use Cases</a>
            <a className="cta-link" href="#launch">
              View Launch Story
            </a>
          </div>
        </nav>

        <section className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Camera streams with operational intent</p>
            <h1>From visual signals to confident action.</h1>
            <p className="hero-text">{platformOverview.valueProposition}</p>
            <div className="hero-actions">
              <a className="primary-button" href="#launch">
                Explore the MVP
              </a>
              <a className="secondary-button" href="#platform">
                See the pipeline
              </a>
            </div>
            <ul className="hero-stats" aria-label="Vectis MVP focus">
              {platformOverview.mvpFocus.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="radar-core">
              <div className="radar-ring ring-a" />
              <div className="radar-ring ring-b" />
              <div className="radar-ring ring-c" />
              <div className="radar-dot dot-a" />
              <div className="radar-dot dot-b" />
            </div>
            <div className="vector vector-a">Capture</div>
            <div className="vector vector-b">Interpret</div>
            <div className="vector vector-c">Act</div>
          </div>
        </section>
      </header>

      <main>
        <section className="section" id="platform">
          <div className="section-heading">
            <p className="eyebrow">Platform model</p>
            <h2>{platformOverview.captureToAction.join(" -> ")}</h2>
            <p>
              Vectis is designed as a visual perception layer between cameras,
              structured events, and downstream workflows.
            </p>
          </div>
          <div className="pillar-grid">
            {platformPillars.map((pillar) => (
              <article key={pillar.title} className="info-card">
                <h3>{pillar.title}</h3>
                <p>{pillar.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section accent-section" id="use-cases">
          <div className="section-heading">
            <p className="eyebrow">Use cases</p>
            <h2>Built for security, operations, and industrial awareness.</h2>
          </div>
          <div className="use-case-grid">
            <article className="story-card">
              <h3>Security Monitoring</h3>
              <p>
                Detect unusual movement, after-hours intrusion, and safety
                deviations from a single operator console.
              </p>
            </article>
            <article className="story-card">
              <h3>Retail and Queue Analytics</h3>
              <p>
                Track flow, detect bottlenecks, and route operational follow-up
                before customer experience degrades.
              </p>
            </article>
            <article className="story-card">
              <h3>Industrial Oversight</h3>
              <p>
                Monitor substations, plants, and yards with structured
                observations that connect directly into response workflows.
              </p>
            </article>
          </div>
        </section>

        <section className="section launch-section" id="launch">
          <div className="section-heading">
            <p className="eyebrow">Automation examples</p>
            <h2>Launch with workflows that make the events useful on day one.</h2>
          </div>
          <div className="rules-preview">
            {automationRules.map((rule) => (
              <article key={rule.id} className="rule-row">
                <div>
                  <p className="rule-name">{rule.name}</p>
                  <p>{rule.condition}</p>
                </div>
                <p className="rule-action">{rule.action}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
