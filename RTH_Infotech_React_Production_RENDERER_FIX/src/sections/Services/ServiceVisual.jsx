// Per-service animated illustrations, restored from the original static build
// (existing-original/index-original.html: the "sd-visual vis-*" templates rendered by
// the live requestOpenService flow). Markup mirrors that source 1:1 per service.visual
// key; styling lives in src/styles/serviceVisuals.css.
function AiVisual() {
  return (
    <div className="vis-ai">
      <div className="ai-orbit" />
      <div className="ai-orbit" />
      <div className="ai-core" />
      <i className="ai-node n1" />
      <i className="ai-node n2" />
      <i className="ai-node n3" />
      <i className="ai-node n4" />
    </div>
  );
}

function WebVisual() {
  return (
    <div className="vis-web">
      <div className="browser svx-glass">
        <div className="browser-top"><i /><i /><i /></div>
        <div className="browser-body">
          <div className="web-nav" />
          <div className="web-content">
            <div className="web-hero" />
            <div className="web-grid">
              <div className="web-card" /><div className="web-card" /><div className="web-card" /><div className="web-card" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileVisual() {
  return (
    <div className="vis-mobile">
      <div className="phone ghost svx-glass">
        <div className="notch" />
        <div className="screen"><div className="m-hero" /><div className="m-row" /><div className="m-row" /></div>
      </div>
      <div className="phone svx-glass">
        <div className="notch" />
        <div className="screen"><div className="m-hero" /><div className="m-row" /><div className="m-row" /><div className="m-row" /></div>
      </div>
    </div>
  );
}

function EnterpriseVisual() {
  return (
    <div className="vis-enterprise">
      <div className="ent-ring" />
      <div className="ent-mod e1 svx-glass">CRM</div>
      <div className="ent-mod e2 svx-glass">HRMS</div>
      <div className="ent-mod e3 svx-glass">BILLING</div>
      <div className="ent-mod e4 svx-glass">ERP</div>
      <div className="ent-hub svx-glass">RTH CORE</div>
    </div>
  );
}

function CloudVisual() {
  return (
    <div className="vis-cloud">
      <div className="server s1 svx-glass" />
      <div className="server s2 svx-glass" />
      <div className="cloud-core svx-glass">CLOUD CORE</div>
      <i className="svx-packet cp1" />
      <i className="svx-packet cp2" />
    </div>
  );
}

function DataVisual() {
  return (
    <div className="vis-data">
      <div className="data-source ds1">CRM</div>
      <div className="data-source ds2">ERP</div>
      <div className="data-source ds3">SALES</div>
      <div className="data-stream"><i /><i /><i /><i /></div>
      <div className="chart svx-glass">
        <div className="chart-grid" />
        <i className="bar" style={{ "--h": "42%" }} />
        <i className="bar" style={{ "--h": "61%" }} />
        <i className="bar" style={{ "--h": "48%" }} />
        <i className="bar" style={{ "--h": "78%" }} />
        <i className="bar" style={{ "--h": "91%" }} />
        <div className="trend"><i className="trend-pulse" /></div>
        <span className="data-metric dm1">+34%</span>
        <span className="data-metric dm2">87% PREDICTION</span>
      </div>
    </div>
  );
}

function ApiVisual() {
  return (
    <div className="vis-api">
      <div className="endpoint left svx-glass"><span className="api-code">{"{ SYSTEM A }"}</span></div>
      <div className="bridge" />
      <i className="svx-packet api-p1" />
      <i className="svx-packet api-p2" />
      <div className="endpoint right svx-glass"><span className="api-code">{"{ SYSTEM B }"}</span></div>
    </div>
  );
}

function UiUxVisual() {
  return (
    <div className="vis-uiux">
      <div className="ux-frame wire svx-glass">
        <div className="ux-top" /><div className="ux-hero" />
        <div className="ux-grid"><div className="ux-card" /><div className="ux-card" /></div>
      </div>
      <div className="ux-arrow">→</div>
      <div className="ux-frame polished svx-glass">
        <div className="ux-top" /><div className="ux-hero" />
        <div className="ux-grid"><div className="ux-card" /><div className="ux-card" /></div>
      </div>
      <i className="cursor-dot" />
    </div>
  );
}

function DevopsVisual() {
  const stages = [["CODE", "01"], ["BUILD", "02"], ["TEST", "03"], ["DEPLOY", "04"], ["MONITOR", "05"]];
  const pipeNodes = [["p1", "BUILD"], ["p2", "TEST"], ["p3", "DEPLOY"], ["p4", "MONITOR"], ["p5", "CODE"]];
  return (
    <div className="vis-devops">
      <div className="devops-track">
        {stages.map(([label, n]) => (
          <div className="dev-stage" key={label}><b>{label}</b><small>{n}</small></div>
        ))}
        <div className="dev-flow-line" />
        <i className="dev-packet" />
      </div>
      <div className="pipe-ring">
        {pipeNodes.map(([cls, label]) => (
          <div className={`pipe-node ${cls}`} key={cls}>{label}</div>
        ))}
      </div>
      <div className="pipe-core svx-glass">CI / CD</div>
    </div>
  );
}

function SecurityVisual() {
  return (
    <div className="vis-security">
      <div className="sec-ring"><i /><i /><i /></div>
      <div className="security-request sr1">REQUEST</div>
      <div className="security-request sr2">API</div>
      <div className="security-request sr3">USER</div>
      <i className="security-packet sp1" />
      <i className="security-packet sp2" />
      <i className="security-packet threat-packet" />
      <div className="shield"><div className="scan" /><span className="shield-lock">✓</span></div>
      <div className="security-status">VERIFYING</div>
    </div>
  );
}

function QaVisual() {
  const rows = ["Functional validation", "API verification", "Regression suite", "Performance checks", "Release confidence"];
  return (
    <div className="vis-qa">
      <div className="qa-panel svx-glass">
        <div className="qa-head"><b>RTH TEST ENGINE</b><span className="qa-counter">0 / 5</span></div>
        {rows.map((label) => (
          <div className="qa-row" key={label}>
            <span className="qa-check" />
            <b>{label}</b>
            <em>PENDING</em>
          </div>
        ))}
        <div className="qa-progress"><i /></div>
      </div>
    </div>
  );
}

function DigitalVisual() {
  return (
    <div className="vis-digital">
      <div className="legacy svx-glass"><div className="d-block" /><div className="d-block" /><div className="d-block" /><div className="d-block" /></div>
      <div className="d-arrow">→</div>
      <i className="svx-packet d-packet" />
      <div className="smart svx-glass"><div className="d-block" /><div className="d-block" /><div className="d-block" /><div className="d-block" /></div>
    </div>
  );
}

const VISUALS = {
  ai: AiVisual,
  web: WebVisual,
  mobile: MobileVisual,
  enterprise: EnterpriseVisual,
  cloud: CloudVisual,
  data: DataVisual,
  api: ApiVisual,
  uiux: UiUxVisual,
  devops: DevopsVisual,
  security: SecurityVisual,
  qa: QaVisual,
  digital: DigitalVisual,
};

export default function ServiceVisual({ service }) {
  const Visual = VISUALS[service.visual] || DigitalVisual;
  return (
    <div className="sd-visual" aria-hidden="true">
      <Visual />
    </div>
  );
}
