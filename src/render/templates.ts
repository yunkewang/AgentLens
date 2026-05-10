import type { AgentFile, DocHeading, Manifest, Risk, SecurityFinding, Warning } from '../core/types';

// ── Utilities ─────────────────────────────────────────────────────────────────

function esc(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2).replace(/<\//g, '<\\/');
}

function fileUid(path: string): string {
  return 'f-' + path.replace(/[^a-z0-9]/gi, '-');
}

function sevColor(s: string): string {
  return s === 'high' ? '#DC2626' : s === 'medium' ? '#D97706' : s === 'low' ? '#2563EB' : '#64748B';
}

function sevBg(s: string): string {
  return s === 'high' ? '#FEF2F2' : s === 'medium' ? '#FFFBEB' : s === 'low' ? '#EFF6FF' : '#F8FAFC';
}

function totalFindings(security: Manifest['security']): number {
  return security.findingsCount.high + security.findingsCount.medium + security.findingsCount.low + security.findingsCount.info;
}

function readinessLabel(score: number): string {
  return score >= 75 ? 'Complete' : score >= 50 ? 'Partial' : 'Incomplete';
}

function readinessColor(score: number, findingCount = 0): string {
  if (score < 50) return '#DC2626';
  if (score < 75) return '#D97706';
  return findingCount > 0 ? '#2563EB' : '#16A34A';
}

function postureColor(posture: string): string {
  const m: Record<string, string> = {
    needs_review: '#DC2626',
    caution: '#D97706',
    clean: '#16A34A',
  };
  return m[posture] ?? '#16A34A';
}

function postureLabel(posture: string): string {
  const m: Record<string, string> = {
    needs_review: 'Needs Review',
    caution: 'Caution',
    clean: 'Clean',
  };
  return m[posture] ?? 'Clean';
}

function shortText(text: string | undefined, max = 120): string {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

function typeColor(t: string): string {
  const m: Record<string, string> = {
    generic_instruction: '#2563EB', rule: '#7C3AED', skill: '#0D9488',
    mcp_config: '#EA580C', prompt: '#334155', project_doc: '#475569',
  };
  return m[t] ?? '#64748B';
}

function typeLabel(t: string): string {
  const m: Record<string, string> = {
    generic_instruction: 'Instruction', rule: 'Rule', skill: 'Skill',
    mcp_config: 'MCP', prompt: 'Prompt', project_doc: 'Doc',
  };
  return m[t] ?? t;
}

function badge(text: string, bg: string): string {
  return `<span class="badge" style="background:${bg}">${esc(text)}</span>`;
}

function typeBadge(type: string): string {
  return badge(typeLabel(type), typeColor(type));
}

function sevBadge(sev: string): string {
  return badge(sev.toUpperCase(), sevColor(sev));
}

function postureChip(posture: string): string {
  return `<span class="posture-chip" style="background:${postureColor(posture)}">${esc(postureLabel(posture))}</span>`;
}

// ── Fix prompt templates ──────────────────────────────────────────────────────

const FIX_PROMPTS: Record<string, string> = {
  missing_security_guidance:
    'Add a security boundary section to AGENTS.md. It should instruct coding agents not to expose secrets, credentials, tokens, customer data, internal URLs, or private environment details. It should also require approval before destructive commands, broad filesystem access, or external uploads. Keep the language concise and project-neutral.',
  possible_secret:
    'Remove any secret, API key, token, or credential material from this instruction file. Replace references to secrets with secure secret-management guidance. For example: "Do not expose secrets or credentials. Use environment variables or a secrets manager. Never include API keys, tokens, passwords, or private keys in instruction files."',
  dangerous_command:
    'Remove or gate the dangerous shell command from this instruction file. If the command is required, add an explicit requirement for human approval before the agent executes it. Replace broad destructive commands with scoped, reviewed alternatives.',
  weak_boundary:
    'Narrow the agent permission language in this instruction file. Define explicitly: which directories the agent may access, which commands it may run, what requires human approval, and what is off-limits. Avoid language like "read all files", "run any command", or "delete anything".',
  instruction_override:
    'Remove language that instructs agents to bypass higher-priority instructions, policies, or safety boundaries. Agent instruction files should work within the safety policies of the AI coding product, not attempt to override them.',
  data_exfiltration:
    'Remove or review instructions that direct agents to upload, send, or post repository content or data to external endpoints. If external data movement is required, add explicit human approval requirements and document approved destinations.',
  private_environment:
    'Redact or remove private network addresses, internal URLs, and internal environment identifiers from this instruction file before sharing it externally. Replace specifics with generic placeholders where possible.',
  mcp_exposure:
    'Review this MCP server configuration for least-privilege access. Restrict filesystem paths to the minimum project directory. Avoid registering shell or terminal MCP servers. Ensure external SaaS and cloud MCP servers use scoped API tokens with minimum required permissions. Document which MCP servers are approved for use.',
};

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #F8FAFC; color: #1E293B; line-height: 1.6; font-size: 14px;
}
a { color: #2563EB; text-decoration: none; }
a:hover { text-decoration: underline; }
code { font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace; font-size: 0.875em; background: #F1F5F9; padding: 1px 5px; border-radius: 3px; }
pre { font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace; }

/* Header */
.header { background: #0F172A; color: #fff; padding: 26px 0; border-bottom: 1px solid rgba(148,163,184,0.18); }
.header-inner { max-width: 1100px; margin: 0 auto; padding: 0 24px; display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
.logo { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #fff; }
.tagline { font-size: 13px; color: #94A3B8; margin-top: 2px; }
.repo-meta { font-size: 12px; color: #94A3B8; margin-top: 6px; }
.repo-meta code { background: rgba(255,255,255,0.1); color: #CBD5E1; }
.header-right { flex-shrink: 0; display: grid; grid-template-columns: repeat(2, minmax(148px, 1fr)); gap: 10px; align-items: stretch; max-width: 380px; }
.header-metric { background: rgba(15,23,42,0.72); border: 1px solid rgba(148,163,184,0.24); border-radius: 8px; padding: 12px 14px; text-align: left; }
.header-score { text-align: left; }
.header-score-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #94A3B8; margin-bottom: 4px; }
.score-num-large { font-size: 31px; font-weight: 800; line-height: 1; }
.score-suffix { font-size: 16px; font-weight: 400; color: #94A3B8; }
.header-posture { text-align: left; }
.header-posture-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #94A3B8; margin-bottom: 4px; }
.header-finding-count { font-size: 12px; color: #94A3B8; margin-top: 6px; }
.header-metric-note { font-size: 11px; color: #94A3B8; margin-top: 6px; line-height: 1.4; }

/* Tab nav */
.tab-nav { background: #1E293B; border-bottom: 1px solid #0F172A; position: sticky; top: 0; z-index: 100; overflow-x: auto; }
.tab-nav-inner { max-width: 1100px; margin: 0 auto; padding: 0 24px; display: flex; }
.tab-btn { background: none; border: none; color: #94A3B8; font-size: 13px; font-weight: 500; padding: 12px 16px; cursor: pointer; white-space: nowrap; border-bottom: 2px solid transparent; transition: color 0.15s, border-color 0.15s; }
.tab-btn:hover { color: #F1F5F9; }
.tab-btn.active { color: #fff; border-bottom-color: #3B82F6; }

/* Layout */
.main { max-width: 1100px; margin: 0 auto; padding: 28px 24px; }
.tab-panel { display: none; }
.tab-panel.active { display: block; }

/* Section title */
.section-title { font-size: 18px; font-weight: 700; color: #0F172A; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #E2E8F0; }
.section-desc { font-size: 13px; color: #64748B; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 10px 14px; margin-bottom: 20px; line-height: 1.6; }

/* Cards */
.card { background: #fff; border: 1px solid #E2E8F0; border-radius: 8px; padding: 18px; margin-bottom: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.card-title { font-size: 16px; font-weight: 600; color: #0F172A; }
.card-path { font-size: 12px; color: #64748B; margin-top: 2px; font-family: 'SFMono-Regular', Consolas, monospace; }
.card-desc { font-size: 13px; color: #475569; margin: 8px 0; }

/* Summary grid */
.summary-grid { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
.summary-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 18px; min-width: 85px; text-align: center; flex: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.summary-card.emphasis { border-color: #CBD5E1; box-shadow: 0 8px 24px rgba(15,23,42,0.08); }
.summary-num { font-size: 28px; font-weight: 700; line-height: 1.1; }
.summary-label { font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px; }

/* Badges */
.badge { display: inline-block; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.5px; vertical-align: middle; }
.posture-chip { display: inline-block; color: #fff; font-size: 12px; font-weight: 600; padding: 4px 14px; border-radius: 12px; }

/* Findings */
.finding-card { border-left: 4px solid; border-radius: 6px; padding: 14px 16px; margin: 8px 0; }
.finding-title { font-weight: 600; font-size: 15px; margin: 6px 0 4px; color: #0F172A; }
.finding-path { font-size: 12px; color: #64748B; font-family: 'SFMono-Regular', Consolas, monospace; margin-bottom: 6px; }
.finding-message { font-size: 13px; color: #334155; }
.finding-evidence { margin-top: 8px; font-size: 12px; }
.finding-rec { margin-top: 8px; font-size: 13px; color: #64748B; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.06); }
.finding-group { margin-bottom: 24px; }
.finding-group-header { font-size: 14px; font-weight: 700; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }

/* Filter bar */
.filter-bar { background: #fff; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.filter-bar select, .filter-bar input { border: 1px solid #CBD5E1; border-radius: 5px; padding: 6px 10px; font-size: 13px; background: #fff; color: #334155; font-family: inherit; }
.filter-bar input { flex: 1; min-width: 160px; }
.filter-label { font-size: 12px; color: #64748B; font-weight: 600; white-space: nowrap; }
.filter-count { font-size: 12px; color: #94A3B8; white-space: nowrap; }

/* Buttons */
.copy-btn { background: #F1F5F9; border: 1px solid #CBD5E1; border-radius: 5px; padding: 4px 10px; font-size: 12px; cursor: pointer; color: #334155; transition: background 0.15s; font-family: inherit; }
.copy-btn:hover { background: #E2E8F0; }
.copy-btn.copied { background: #DCFCE7; border-color: #BBF7D0; color: #166534; }
.action-btn { background: #2563EB; color: #fff; border: none; border-radius: 5px; padding: 6px 14px; font-size: 13px; cursor: pointer; font-family: inherit; }
.action-btn:hover { background: #1D4ED8; }

/* Meta block */
.meta-block { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 10px 14px; margin: 10px 0; font-size: 13px; }
.meta-row { margin: 3px 0; }
.meta-label { font-weight: 600; color: #475569; display: inline-block; min-width: 110px; }

/* Code blocks */
.code-block { background: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 6px; padding: 14px; font-size: 12.5px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; max-height: 420px; overflow-y: auto; margin: 10px 0; }

/* Rendered markdown */
.rendered-md { font-size: 14px; line-height: 1.7; }
.rendered-md h1, .rendered-md h2, .rendered-md h3 { margin: 12px 0 6px; font-weight: 600; color: #0F172A; }
.rendered-md h1 { font-size: 18px; } .rendered-md h2 { font-size: 16px; } .rendered-md h3 { font-size: 14px; }
.rendered-md p { margin: 6px 0; }
.rendered-md ul, .rendered-md ol { margin: 6px 0 6px 20px; }
.rendered-md li { margin: 2px 0; }
.rendered-md code { background: #F1F5F9; }
.rendered-md pre { background: #F1F5F9; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 8px 0; }
.rendered-md blockquote { border-left: 3px solid #CBD5E1; padding-left: 12px; color: #64748B; margin: 8px 0; }
.rendered-md table { border-collapse: collapse; margin: 8px 0; font-size: 13px; }
.rendered-md th, .rendered-md td { border: 1px solid #E2E8F0; padding: 6px 10px; }
.rendered-md th { background: #F8FAFC; }

/* Collapsible */
.collapsible summary { cursor: pointer; font-size: 13px; color: #64748B; padding: 6px 0; user-select: none; list-style: none; display: flex; align-items: center; gap: 6px; }
.collapsible summary::-webkit-details-marker { display: none; }
.collapsible summary .toggle-icon { font-size: 10px; color: #94A3B8; transition: transform 0.15s; display: inline-block; width: 10px; }
details[open] summary .toggle-icon { transform: rotate(90deg); }
.collapsible summary:hover { color: #2563EB; }
.collapsible summary:hover .toggle-icon { color: #2563EB; }

/* Risk items */
.risk-item { padding: 6px 10px; margin: 4px 0; border-radius: 4px; font-size: 13px; border-left: 3px solid; display: flex; align-items: flex-start; gap: 6px; }

/* Warning cards */
.warning-card { padding: 10px 14px; border-radius: 6px; margin: 6px 0; font-size: 13px; display: flex; align-items: flex-start; gap: 8px; border-left: 4px solid; }

/* Instruction map */
.map-group { margin-bottom: 28px; }
.map-group-title { font-size: 12px; font-weight: 700; color: #94A3B8; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.8px; }
.map-items { display: flex; flex-wrap: wrap; gap: 8px; }
.map-item { background: #fff; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 13px; transition: border-color 0.15s, box-shadow 0.15s; max-width: 400px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.map-item:hover { border-color: #3B82F6; box-shadow: 0 2px 8px rgba(59,130,246,0.12); }
.map-item.has-findings { border-left: 3px solid #D97706; }
.map-item-path { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; color: #334155; word-break: break-all; }
.map-item-warn { color: #D97706; font-size: 13px; margin-left: auto; flex-shrink: 0; }

/* File card header */
.file-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
.file-card-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }

/* Fix prompts */
.fix-prompt-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 8px; padding: 18px; margin-bottom: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.fix-prompt-text { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px; font-size: 13px; line-height: 1.7; color: #334155; margin: 10px 0; white-space: pre-wrap; font-family: inherit; }

/* Overview layout */
.overview-top { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.score-explanation { list-style: none; margin: 10px 0 0; }
.score-explanation li { font-size: 13px; padding: 2px 0; color: #475569; }
.score-explanation li::before { content: '\\2713  '; }

/* Empty state */
.empty-msg { color: #94A3B8; font-size: 14px; padding: 24px 0; }

/* Relative container for copy-on-code */
.code-wrap { position: relative; }
.code-wrap .copy-btn { position: absolute; top: 8px; right: 8px; }

/* Inline row utilities */
.row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* Assessment cards */
.overview-group-label { font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.6px; margin: 6px 0 10px; }
.assess-grid { display: grid; grid-template-columns: 1.12fr 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.assess-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.assess-card.primary-risk { border-color: #CBD5E1; box-shadow: 0 10px 28px rgba(15,23,42,0.08); }
.assess-card-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: #64748B; font-weight: 600; margin-bottom: 10px; }
.assess-card-divider { height: 1px; background: #E2E8F0; margin: 12px 0; }
.assessment-note { font-size: 12px; color: #64748B; line-height: 1.5; margin-top: 8px; }
.severity-breakdown { display: grid; grid-template-columns: repeat(4, minmax(54px, 1fr)); gap: 8px; margin-top: 12px; }
.severity-pill { border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px; background: #F8FAFC; }
.severity-pill-num { font-size: 20px; font-weight: 800; line-height: 1; }
.severity-pill-label { font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
.inventory-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; margin-bottom: 20px; }
.inventory-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 12px; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.inventory-num { font-size: 24px; font-weight: 700; line-height: 1.1; }
.inventory-label { font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }

@media (max-width: 700px) {
  .overview-top { grid-template-columns: 1fr; }
  .assess-grid { grid-template-columns: 1fr; }
  .header-inner { flex-direction: column; }
  .header-right { grid-template-columns: 1fr; width: 100%; max-width: none; }
  .header-score { text-align: left; }
  .summary-card { min-width: 70px; }
  .map-item { max-width: 100%; }
  .inventory-grid { grid-template-columns: repeat(3, 1fr); }
  .severity-breakdown { grid-template-columns: repeat(2, 1fr); }
}
`;

// ── JavaScript ────────────────────────────────────────────────────────────────

const JS = `
(function () {
  /* Tab switching */
  function showTab(name) {
    document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
    document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
    var panel = document.getElementById('tab-' + name);
    if (panel) panel.classList.add('active');
    var btn = document.querySelector('.tab-btn[data-tab="' + name + '"]');
    if (btn) btn.classList.add('active');
    history.replaceState(null, '', '#' + name);
  }
  window.showTab = showTab;

  /* Copy text stored in data-copy attribute (HTML-decoded automatically by browser) */
  function doCopy(btn) {
    var text = btn.getAttribute('data-copy') || '';
    navigator.clipboard.writeText(text).then(function () {
      var orig = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(function () { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
    });
  }
  window.doCopy = doCopy;

  /* Copy text content of an element by ID */
  function copyById(id, btn) {
    var el = document.getElementById(id);
    if (!el) return;
    navigator.clipboard.writeText(el.textContent || '').then(function () {
      if (btn) {
        var orig = btn.textContent;
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(function () { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
      }
    });
  }
  window.copyById = copyById;

  /* Security tab filters */
  function applySecurityFilter() {
    var sev = (document.getElementById('sec-sev') || {}).value || '';
    var cat = (document.getElementById('sec-cat') || {}).value || '';
    var q = ((document.getElementById('sec-q') || {}).value || '').toLowerCase();

    document.querySelectorAll('.finding-card').forEach(function (card) {
      var sevOk = !sev || card.getAttribute('data-severity') === sev;
      var catOk = !cat || card.getAttribute('data-category') === cat;
      var qOk = !q || (card.textContent || '').toLowerCase().includes(q);
      card.style.display = (sevOk && catOk && qOk) ? '' : 'none';
    });

    document.querySelectorAll('.finding-group').forEach(function (grp) {
      var vis = Array.from(grp.querySelectorAll('.finding-card')).some(function (c) { return c.style.display !== 'none'; });
      grp.style.display = vis ? '' : 'none';
    });

    var total = Array.from(document.querySelectorAll('.finding-card')).filter(function (c) { return c.style.display !== 'none'; }).length;
    var counter = document.getElementById('sec-count');
    if (counter) counter.textContent = total + ' finding' + (total !== 1 ? 's' : '');
  }
  window.applySecurityFilter = applySecurityFilter;

  /* Files tab filter */
  function applyFilesFilter() {
    var q = ((document.getElementById('files-q') || {}).value || '').toLowerCase();
    var type = ((document.getElementById('files-type') || {}).value || '');
    document.querySelectorAll('.file-card[data-type]').forEach(function (card) {
      var typeOk = !type || card.getAttribute('data-type') === type;
      var qOk = !q || (card.textContent || '').toLowerCase().includes(q);
      card.style.display = (typeOk && qOk) ? '' : 'none';
    });
  }
  window.applyFilesFilter = applyFilesFilter;

  /* Project Docs tab filter */
  function applyDocsFilter() {
    var q = ((document.getElementById('docs-q') || {}).value || '').toLowerCase();
    var grp = ((document.getElementById('docs-group') || {}).value || '');
    document.querySelectorAll('.doc-card').forEach(function (card) {
      var grpOk = !grp || card.getAttribute('data-group') === grp;
      var qOk = !q || (card.textContent || '').toLowerCase().includes(q);
      card.style.display = (grpOk && qOk) ? '' : 'none';
    });
    document.querySelectorAll('.doc-group').forEach(function (g) {
      var vis = Array.from(g.querySelectorAll('.doc-card')).some(function (c) { return c.style.display !== 'none'; });
      g.style.display = vis ? '' : 'none';
    });
    var visible = Array.from(document.querySelectorAll('.doc-card')).filter(function (c) { return c.style.display !== 'none'; }).length;
    var counter = document.getElementById('docs-count');
    if (counter) counter.textContent = visible + ' doc' + (visible !== 1 ? 's' : '');
  }
  window.applyDocsFilter = applyDocsFilter;

  /* Jump from instruction map to file in Files tab */
  function jumpToFile(path) {
    showTab('files');
    var uid = 'f-' + path.replace(/[^a-z0-9]/gi, '-');
    setTimeout(function () {
      var el = document.getElementById(uid);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.style.outline = '2px solid #2563EB';
        setTimeout(function () { el.style.outline = ''; }, 1600);
      }
    }, 80);
  }
  window.jumpToFile = jumpToFile;

  /* Init: show tab from URL hash or default to overview */
  document.addEventListener('DOMContentLoaded', function () {
    var validTabs = ['overview', 'security', 'map', 'files', 'rules', 'skills', 'mcp', 'project-docs', 'fix-prompts', 'manifest'];
    var hash = location.hash.replace('#', '');
    showTab(validTabs.indexOf(hash) !== -1 ? hash : 'overview');
  });
})();
`;

// ── Shared render helpers ─────────────────────────────────────────────────────

function renderMeta(file: AgentFile): string {
  const parts: string[] = [];
  const m = file.metadata;

  if (file.subtype === 'cursor_mdc') {
    if (m.description) parts.push(`<div class="meta-row"><span class="meta-label">Description</span> ${esc(m.description)}</div>`);
    if (Array.isArray(m.globs) && m.globs.length) {
      parts.push(`<div class="meta-row"><span class="meta-label">Globs</span> <code>${(m.globs as string[]).map(esc).join(', ')}</code></div>`);
    }
    parts.push(`<div class="meta-row"><span class="meta-label">Always Apply</span> ${m.alwaysApply ? 'Yes' : 'No'}</div>`);
  }

  if (file.type === 'skill') {
    parts.push(`<div class="meta-row"><span class="meta-label">Folder</span> <code>${esc(m.folder ?? '')}</code></div>`);
    if (Array.isArray(m.relatedFiles) && m.relatedFiles.length) {
      const list = (m.relatedFiles as string[]).map((f) => `<li><code>${esc(f)}</code></li>`).join('');
      parts.push(`<div class="meta-row"><span class="meta-label">Related Files</span><ul style="margin:4px 0 0 18px;font-size:12px;">${list}</ul></div>`);
    }
  }

  if (file.type === 'mcp_config') {
    if (Array.isArray(m.servers) && m.servers.length) {
      const serverBadges = (m.servers as string[]).map((s) => badge(s, '#64748B')).join(' ');
      parts.push(`<div class="meta-row"><span class="meta-label">Servers</span> ${serverBadges}</div>`);
    }
  }

  return parts.length ? `<div class="meta-block">${parts.join('')}</div>` : '';
}

function renderRisks(risks: Risk[]): string {
  if (!risks.length) return '';
  return risks.map((r) => `
    <div class="risk-item" style="border-left-color:${sevColor(r.severity)};background:${sevBg(r.severity)}">
      ${sevBadge(r.severity)}<span>${esc(r.message)}</span>
    </div>`).join('');
}

function renderFileContent(file: AgentFile): string {
  if (file.type === 'mcp_config') {
    let pretty = file.rawContent;
    try { pretty = JSON.stringify(JSON.parse(file.rawContent), null, 2); } catch { /* leave as-is */ }
    return `<pre class="code-block">${esc(pretty)}</pre>`;
  }
  if (file.renderedContent) {
    return `<div class="rendered-md">${file.renderedContent}</div>`;
  }
  return `<pre class="code-block">${esc(file.rawContent)}</pre>`;
}

function collapsible(summary: string, content: string, open = false): string {
  return `<details class="collapsible"${open ? ' open' : ''}>
  <summary><span class="toggle-icon">▶</span>${esc(summary)}</summary>
  <div style="margin-top:8px;">${content}</div>
</details>`;
}

function rawBlock(id: string, content: string): string {
  return `<div class="code-wrap">
  <pre class="code-block" id="${id}">${esc(content)}</pre>
  <button class="copy-btn" onclick="copyById('${id}', this)">Copy</button>
</div>`;
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function renderOverview(manifest: Manifest): string {
  const { repo: _repo, summary, security, files, warnings, projectDocs, projectDocsInfo } = manifest;
  const total = totalFindings(security);
  const sc = readinessColor(summary.score, total);
  const totalFiles = files.length;
  const topFindings = security.findings.filter((f) => f.severity === 'high' || f.severity === 'medium').slice(0, 3);
  const docsEnabled = !!projectDocsInfo?.enabled;
  const docsCount = projectDocs?.length ?? 0;
  const readiness = readinessLabel(summary.score);
  const posture = postureLabel(security.posture);
  const postureTone = postureColor(security.posture);

  return `<h2 class="section-title">Overview</h2>

<div class="overview-group-label">Assessment</div>
<div class="assess-grid">
  <div class="assess-card primary-risk" style="border-top:4px solid ${total > 0 ? postureTone : '#16A34A'};">
    <div class="assess-card-label">Findings</div>
    <div style="display:flex;align-items:baseline;gap:8px;">
      <span style="font-size:44px;font-weight:800;color:${total > 0 ? postureTone : '#16A34A'};line-height:1;">${total}</span>
      <span style="font-size:13px;color:#64748B;">security signal${total !== 1 ? 's' : ''}</span>
    </div>
    <div class="severity-breakdown">
      <div class="severity-pill"><div class="severity-pill-num" style="color:${sevColor('high')}">${security.findingsCount.high}</div><div class="severity-pill-label">High</div></div>
      <div class="severity-pill"><div class="severity-pill-num" style="color:${sevColor('medium')}">${security.findingsCount.medium}</div><div class="severity-pill-label">Medium</div></div>
      <div class="severity-pill"><div class="severity-pill-num" style="color:${sevColor('low')}">${security.findingsCount.low}</div><div class="severity-pill-label">Low</div></div>
      <div class="severity-pill"><div class="severity-pill-num" style="color:${sevColor('info')}">${security.findingsCount.info}</div><div class="severity-pill-label">Info</div></div>
    </div>
    ${total > 0 ? `<div style="margin-top:14px;"><button class="action-btn" onclick="showTab('security')">Review Findings &#8594;</button></div>` : '<div class="assessment-note">No agent instruction security findings were detected by the current rule set.</div>'}
  </div>
  <div class="assess-card" style="border-top:4px solid ${postureTone};">
    <div class="assess-card-label">Risk Posture</div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
      ${postureChip(security.posture)}
      <span style="font-size:16px;font-weight:700;color:#0F172A;">${esc(posture)}</span>
    </div>
    <div class="assessment-note">
      Based on security findings in agent instructions, prompts, skills, and MCP configuration.
      ${security.findingsCount.medium > 0 ? 'Medium findings keep the posture at Caution even when readiness is complete.' : ''}
    </div>
  </div>
  <div class="assess-card">
    <div class="assess-card-label">Agent Readiness</div>
    <div style="display:flex;align-items:baseline;gap:8px;">
      <span style="font-size:40px;font-weight:800;color:${sc};line-height:1;">${summary.score}</span>
      <span style="font-size:15px;color:#94A3B8;">/ 100</span>
      <span style="font-size:12px;color:${sc};font-weight:600;margin-left:4px;">${esc(readiness)}</span>
    </div>
    <div class="assess-card-divider"></div>
    <div style="font-size:12px;color:#64748B;margin-bottom:6px;">Measures whether agent artifacts are present, not whether the repo is safe.</div>
    ${summary.scoreExplanation.length ? `<ul class="score-explanation">${summary.scoreExplanation.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
  </div>
</div>

<div class="overview-group-label">Inventory</div>
<div class="inventory-grid">
  <div class="inventory-card"><div class="inventory-num" style="color:#1E293B">${totalFiles}</div><div class="inventory-label">Total Files</div></div>
  <div class="inventory-card"><div class="inventory-num" style="color:#2563EB">${summary.counts.genericInstructions}</div><div class="inventory-label">Instructions</div></div>
  <div class="inventory-card"><div class="inventory-num" style="color:#7C3AED">${summary.counts.rules}</div><div class="inventory-label">Rules</div></div>
  <div class="inventory-card"><div class="inventory-num" style="color:#0D9488">${summary.counts.skills}</div><div class="inventory-label">Skills</div></div>
  <div class="inventory-card"><div class="inventory-num" style="color:#EA580C">${summary.counts.mcpConfigs}</div><div class="inventory-label">MCP Configs</div></div>
  <div class="inventory-card"><div class="inventory-num" style="color:#334155">${summary.counts.prompts}</div><div class="inventory-label">Prompts</div></div>
  ${docsEnabled ? `<div class="inventory-card"><div class="inventory-num" style="color:#475569">${docsCount}</div><div class="inventory-label">Project Docs</div></div>` : ''}
</div>

${docsEnabled ? `
<div class="card" style="margin-bottom:16px;border-left:4px solid #475569;">
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
    <span style="font-size:13px;font-weight:600;">Project documentation scanning enabled</span>
    ${badge('--include-docs', '#475569')}
    <span style="font-size:12px;color:#64748B;">${docsCount} doc${docsCount !== 1 ? 's' : ''} scanned${projectDocsInfo && projectDocsInfo.skipped > 0 ? ` · ${projectDocsInfo.skipped} skipped` : ''}</span>
    <button class="action-btn" style="margin-left:auto;" onclick="showTab('project-docs')">View Project Docs →</button>
  </div>
</div>` : ''}

${topFindings.length ? `
<div class="card" style="margin-bottom:16px;">
  <div style="font-size:14px;font-weight:700;margin-bottom:12px;">Top Security Findings</div>
  ${topFindings.map((f) => `
  <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #F1F5F9;">
    ${sevBadge(f.severity)}
    <div style="flex:1;min-width:0;">
      <div style="font-size:13px;font-weight:600;color:#0F172A;">${esc(f.title)}</div>
      <div style="font-size:11px;color:#64748B;font-family:monospace;margin-top:2px;">
        ${esc(f.path)}
        <span style="color:#94A3B8;font-family:inherit;"> &middot; ${esc(f.category.replace(/_/g, ' '))}</span>
      </div>
      ${f.recommendation ? `<div style="font-size:12px;color:#475569;margin-top:3px;">${esc(shortText(f.recommendation, 132))}</div>` : ''}
    </div>
  </div>`).join('')}
  <div style="margin-top:12px;"><button class="action-btn" onclick="showTab('security')">View All Findings &#8594;</button></div>
</div>` : ''}

${warnings.length ? `
<div class="card">
  <div style="font-size:14px;font-weight:700;margin-bottom:10px;">Readiness Gaps</div>
  ${warnings.map((w) => `
  <div class="warning-card" style="border-left-color:${sevColor(w.severity)};background:${sevBg(w.severity)}">
    ${sevBadge(w.severity)} <span>${esc(w.message)}</span>
  </div>`).join('')}
  <div style="margin-top:12px;"><button class="action-btn" onclick="showTab('map')">View Instruction Map →</button></div>
</div>` : `<div class="card"><div style="color:#16A34A;font-size:14px;">&#10003; No readiness gaps detected.</div></div>`}
`;
}

// ── Security tab ──────────────────────────────────────────────────────────────

function renderSecurityTab(manifest: Manifest): string {
  const { security } = manifest;
  const total = security.findings.length;
  const categories = [...new Set(security.findings.map((f) => f.category))].sort();
  const postureTone = postureColor(security.posture);

  const groups: Array<[string, string, SecurityFinding[]]> = [
    ['High', 'high', security.findings.filter((f) => f.severity === 'high')],
    ['Medium', 'medium', security.findings.filter((f) => f.severity === 'medium')],
    ['Low', 'low', security.findings.filter((f) => f.severity === 'low')],
    ['Info', 'info', security.findings.filter((f) => f.severity === 'info')],
  ];

  return `<h2 class="section-title">Security Review</h2>

<p class="section-desc">
  AgentLens scans the agent instruction layer, not application source code. Findings highlight risks in
  instructions, rules, skills, command files, prompt files, and MCP configs that AI coding agents may follow.
</p>

<div class="assess-card primary-risk" style="border-top:4px solid ${postureTone};margin-bottom:18px;">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">
    <div>
      <div class="assess-card-label">Risk Posture</div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        ${postureChip(security.posture)}
        <span style="font-size:20px;font-weight:800;color:#0F172A;">${esc(postureLabel(security.posture))}</span>
      </div>
      <div class="assessment-note">
        ${total} finding${total !== 1 ? 's' : ''} across agent-facing files.
        ${security.findingsCount.medium > 0 ? 'Medium findings are enough to keep the posture at Caution.' : ''}
      </div>
    </div>
    <div class="severity-breakdown" style="width:min(100%,440px);margin-top:0;">
      <div class="severity-pill"><div class="severity-pill-num" style="color:${sevColor('high')}">${security.findingsCount.high}</div><div class="severity-pill-label">High</div></div>
      <div class="severity-pill"><div class="severity-pill-num" style="color:${sevColor('medium')}">${security.findingsCount.medium}</div><div class="severity-pill-label">Medium</div></div>
      <div class="severity-pill"><div class="severity-pill-num" style="color:${sevColor('low')}">${security.findingsCount.low}</div><div class="severity-pill-label">Low</div></div>
      <div class="severity-pill"><div class="severity-pill-num" style="color:${sevColor('info')}">${security.findingsCount.info}</div><div class="severity-pill-label">Info</div></div>
    </div>
  </div>
</div>

${total > 0 ? `
<div class="filter-bar">
  <span class="filter-label">Filter:</span>
  <select id="sec-sev" onchange="applySecurityFilter()">
    <option value="">All severities</option>
    <option value="high">High</option>
    <option value="medium">Medium</option>
    <option value="low">Low</option>
    <option value="info">Info</option>
  </select>
  <select id="sec-cat" onchange="applySecurityFilter()">
    <option value="">All categories</option>
    ${categories.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
  </select>
  <input id="sec-q" type="search" placeholder="Search findings..." oninput="applySecurityFilter()" />
  <span id="sec-count" class="filter-count">${total} finding${total !== 1 ? 's' : ''}</span>
</div>

${groups.map(([label, severity, findings]) => findings.length === 0 ? '' : `
<div class="finding-group">
  <div class="finding-group-header">
    ${sevBadge(severity)}
    <span style="color:#444;font-weight:400;font-size:13px;">${findings.length} finding${findings.length !== 1 ? 's' : ''}</span>
  </div>
  ${findings.map((f, i) => {
    const promptId = `sec-prompt-${severity}-${i}`;
    const promptText = FIX_PROMPTS[f.category] ?? `Review the finding in ${f.path} and apply the recommended remediation.`;
    return `<div class="finding-card" data-severity="${esc(f.severity)}" data-category="${esc(f.category)}" style="border-left-color:${sevColor(f.severity)};background:${sevBg(f.severity)}">
  <div class="row" style="margin-bottom:6px;">
    ${sevBadge(f.severity)}
    <span style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">${esc(f.category.replace(/_/g, ' '))}</span>
  </div>
  <div class="finding-title">${esc(f.title)}</div>
  <div class="finding-path"><code>${esc(f.path)}${f.lineNumber ? `:${f.lineNumber}` : ''}</code></div>
  <div class="finding-message">${esc(f.message)}</div>
  ${f.evidence ? `<div class="finding-evidence"><strong>Evidence:</strong> <code>${esc(f.evidence)}</code></div>` : ''}
  ${f.recommendation ? `<div class="finding-rec"><strong>Recommendation:</strong> ${esc(f.recommendation)}</div>` : ''}
  ${f.references && f.references.length ? `<div class="finding-refs" style="margin-top:6px;font-size:11px;color:#64748B;"><strong>References:</strong> ${f.references.map((r) => r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener" style="color:#2563EB;text-decoration:none;">${esc(r.id)}: ${esc(r.name)}</a>` : `<span>${esc(r.id)}: ${esc(r.name)}</span>`).join(' &middot; ')}</div>` : ''}
  <div style="margin-top:10px;display:flex;gap:6px;align-items:center;">
    <button class="copy-btn" onclick="copyById('${promptId}', this)">Copy Remediation Prompt</button>
    <button class="action-btn" style="font-size:11px;padding:4px 10px;" onclick="showTab('fix-prompts')">Remediation Prompts &#8594;</button>
  </div>
  <span id="${promptId}" style="display:none">${esc(promptText)}</span>
</div>`;
  }).join('')}
</div>`).join('')}
` : '<p class="empty-msg">No agent instruction security findings detected by the current rule set.</p>'}
`;
}

// ── Instruction Map tab ───────────────────────────────────────────────────────

function renderMapTab(manifest: Manifest): string {
  const { files, security } = manifest;
  const filesWithFindings = new Set(security.findings.map((f) => f.path));

  const groups = [
    { label: 'Project-wide Instructions', items: files.filter((f) => f.type === 'generic_instruction') },
    { label: 'Rules', items: files.filter((f) => f.type === 'rule') },
    { label: 'Skills', items: files.filter((f) => f.type === 'skill') },
    { label: 'MCP Configs', items: files.filter((f) => f.type === 'mcp_config') },
    { label: 'Prompts & Commands', items: files.filter((f) => f.type === 'prompt') },
  ].filter((g) => g.items.length > 0);

  if (!groups.length) {
    return `<h2 class="section-title">Instruction Map</h2><p class="empty-msg">No agent instruction files discovered.</p>`;
  }

  const docsEnabled = !!manifest.projectDocsInfo?.enabled;
  const docsCount = manifest.projectDocs?.length ?? 0;

  return `<h2 class="section-title">Instruction Map</h2>
<p class="section-desc">Visual map of discovered agent instruction files grouped by type. Click any item to view its full detail in the Files tab. Warning indicators show files with security findings.</p>

${docsEnabled ? `
<div class="card" style="margin-bottom:18px;border-left:4px solid #475569;">
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
    <span style="font-size:13px;color:#444;">Project documentation is shown separately to keep this map focused on agent instruction files.</span>
    <button class="action-btn" style="margin-left:auto;" onclick="showTab('project-docs')">View ${docsCount} Project Doc${docsCount !== 1 ? 's' : ''} →</button>
  </div>
</div>` : ''}

${groups.map((g) => `
<div class="map-group">
  <div class="map-group-title">${esc(g.label)}</div>
  <div class="map-items">
    ${g.items.map((f) => {
      const hasWarn = filesWithFindings.has(f.path);
      return `<div class="map-item${hasWarn ? ' has-findings' : ''}" onclick="jumpToFile('${esc(f.path)}')" title="${esc(f.path)}">
  ${typeBadge(f.type)}
  <span class="map-item-path">${esc(f.path)}</span>
  ${hasWarn ? '<span class="map-item-warn" title="Has security findings">⚠</span>' : ''}
</div>`;
    }).join('')}
  </div>
</div>`).join('')}
`;
}

// ── File card (used in Files tab) ─────────────────────────────────────────────

function renderFileCard(file: AgentFile, filesWithFindings: Set<string>): string {
  const id = fileUid(file.path);
  const rawId = `raw-${id}`;
  const hasWarn = filesWithFindings.has(file.path);

  return `
<div class="card file-card" id="${id}" data-type="${esc(file.type)}" data-path="${esc(file.path)}">
  <div class="file-card-header">
    <div>
      <div class="file-card-title-row">
        ${typeBadge(file.type)}
        ${hasWarn ? '<span style="color:#D97706;font-size:12px;font-weight:600;">⚠ findings</span>' : ''}
        <span class="card-title">${esc(file.title || file.path)}</span>
      </div>
      <div class="card-path">${esc(file.path)}</div>
    </div>
    <div class="row" style="flex-shrink:0;">
      <button class="copy-btn" data-copy="${esc(file.path)}" onclick="doCopy(this)">Copy Path</button>
    </div>
  </div>
  ${file.description ? `<p class="card-desc">${esc(file.description)}</p>` : ''}
  ${renderMeta(file)}
  ${renderRisks(file.risks)}
  ${collapsible('Content', renderFileContent(file), true)}
  ${collapsible('Raw content', rawBlock(rawId, file.rawContent), false)}
</div>`;
}

// ── Files tab ─────────────────────────────────────────────────────────────────

function renderFilesTab(manifest: Manifest): string {
  const { files, security } = manifest;
  const filesWithFindings = new Set(security.findings.map((f) => f.path));

  if (!files.length) {
    return `<h2 class="section-title">Files</h2><p class="empty-msg">No agent instruction files discovered.</p>`;
  }

  const types = [...new Set(files.map((f) => f.type))];

  return `<h2 class="section-title">Files</h2>

<div class="filter-bar">
  <span class="filter-label">Search:</span>
  <input id="files-q" type="search" placeholder="Search by path, title, content..." oninput="applyFilesFilter()" />
  <select id="files-type" onchange="applyFilesFilter()">
    <option value="">All types</option>
    ${types.map((t) => `<option value="${esc(t)}">${esc(typeLabel(t))}</option>`).join('')}
  </select>
</div>

${files.map((f) => renderFileCard(f, filesWithFindings)).join('\n')}
`;
}

// ── Rules tab ─────────────────────────────────────────────────────────────────

function renderRulesTab(manifest: Manifest): string {
  const rules = manifest.files.filter((f) => f.type === 'rule');
  const filesWithFindings = new Set(manifest.security.findings.map((f) => f.path));

  if (!rules.length) {
    return `<h2 class="section-title">Rules</h2>
<p class="empty-msg">No rule files discovered. Rule files include .cursor/rules/*.mdc, .cursorrules, and rules/**/*.md.</p>`;
  }

  return `<h2 class="section-title">Rules</h2>
<p class="section-desc">AI coding rule files define scoped, file-pattern-targeted instructions for the agent. .mdc files include YAML frontmatter with glob patterns, description, and alwaysApply settings.</p>

${rules.map((f) => {
    const m = f.metadata;
    const id = fileUid(f.path);
    const rawId = `rawrule-${id}`;
    const hasWarn = filesWithFindings.has(f.path);
    return `
<div class="card">
  <div class="file-card-header">
    <div>
      <div class="file-card-title-row">
        ${typeBadge(f.type)}
        ${f.subtype === 'cursor_mdc' ? badge('MDC', '#6c5ce7') : ''}
        ${hasWarn ? '<span style="color:#D97706;font-size:12px;font-weight:600;">⚠ findings</span>' : ''}
        <span class="card-title">${esc(f.title || f.path)}</span>
      </div>
      <div class="card-path">${esc(f.path)}</div>
    </div>
    <button class="copy-btn" data-copy="${esc(f.path)}" onclick="doCopy(this)">Copy Path</button>
  </div>
  ${f.description ? `<p class="card-desc">${esc(f.description)}</p>` : ''}
  ${f.subtype === 'cursor_mdc' ? `<div class="meta-block">
    ${m.description ? `<div class="meta-row"><span class="meta-label">Description</span> ${esc(m.description)}</div>` : ''}
    ${Array.isArray(m.globs) && m.globs.length ? `<div class="meta-row"><span class="meta-label">Globs</span> <code>${(m.globs as string[]).map(esc).join(', ')}</code></div>` : ''}
    <div class="meta-row"><span class="meta-label">Always Apply</span> ${m.alwaysApply ? 'Yes' : 'No'}</div>
  </div>` : ''}
  ${renderRisks(f.risks)}
  ${collapsible('Rule content', f.renderedContent ? `<div class="rendered-md">${f.renderedContent}</div>` : `<pre class="code-block">${esc(f.rawContent)}</pre>`, true)}
  ${collapsible('Raw content', rawBlock(rawId, f.rawContent), false)}
</div>`;
  }).join('')}`;
}

// ── Skills tab ────────────────────────────────────────────────────────────────

function renderSkillsTab(manifest: Manifest): string {
  const skills = manifest.files.filter((f) => f.type === 'skill');
  const filesWithFindings = new Set(manifest.security.findings.map((f) => f.path));

  if (!skills.length) {
    return `<h2 class="section-title">Skills</h2>
<p class="empty-msg">No skill folders discovered. Skill folders follow the pattern .claude/skills/*/SKILL.md.</p>`;
  }

  return `<h2 class="section-title">Skills</h2>
<p class="section-desc">Skill folders define reusable agent capabilities. Each skill is a folder containing a SKILL.md definition and optional supporting files.</p>

${skills.map((f) => {
    const m = f.metadata;
    const id = fileUid(f.path);
    const rawId = `rawskill-${id}`;
    const hasWarn = filesWithFindings.has(f.path);
    return `
<div class="card">
  <div class="file-card-header">
    <div>
      <div class="file-card-title-row">
        ${typeBadge(f.type)}
        ${hasWarn ? '<span style="color:#D97706;font-size:12px;font-weight:600;">⚠ findings</span>' : ''}
        <span class="card-title">${esc(f.title || f.path)}</span>
      </div>
      <div class="card-path">${esc(f.path)}</div>
    </div>
    <button class="copy-btn" data-copy="${esc(f.path)}" onclick="doCopy(this)">Copy Path</button>
  </div>
  ${f.description ? `<p class="card-desc">${esc(f.description)}</p>` : ''}
  <div class="meta-block">
    <div class="meta-row"><span class="meta-label">Folder</span> <code>${esc(m.folder ?? '')}</code></div>
    ${Array.isArray(m.relatedFiles) && m.relatedFiles.length ? `<div class="meta-row"><span class="meta-label">Related Files</span><ul style="margin:4px 0 0 18px;font-size:12px;">${(m.relatedFiles as string[]).map((rf) => `<li><code>${esc(rf)}</code></li>`).join('')}</ul></div>` : ''}
  </div>
  ${renderRisks(f.risks)}
  ${collapsible('Skill content', f.renderedContent ? `<div class="rendered-md">${f.renderedContent}</div>` : `<pre class="code-block">${esc(f.rawContent)}</pre>`, true)}
  ${collapsible('Raw content', rawBlock(rawId, f.rawContent), false)}
</div>`;
  }).join('')}`;
}

// ── MCP tab ───────────────────────────────────────────────────────────────────

function renderMcpTab(manifest: Manifest): string {
  const mcpFiles = manifest.files.filter((f) => f.type === 'mcp_config');
  const allFindings = manifest.security.findings;

  if (!mcpFiles.length) {
    return `<h2 class="section-title">MCP</h2>
<p class="empty-msg">No MCP config files discovered. MCP configs include .mcp.json, mcp.json, and .cursor/mcp.json.</p>`;
  }

  return `<h2 class="section-title">MCP</h2>
<p class="section-desc">MCP (Model Context Protocol) configs register tools and services available to AI agents. Broad MCP access is a significant security surface — review each registered server carefully.</p>

${mcpFiles.map((f) => {
    const m = f.metadata;
    const id = fileUid(f.path);
    const rawId = `rawmcp-${id}`;
    const fileMcpFindings = allFindings.filter((fi) => fi.path === f.path);
    let prettyJson = f.rawContent;
    try { prettyJson = JSON.stringify(JSON.parse(f.rawContent), null, 2); } catch { /* leave as-is */ }
    return `
<div class="card">
  <div class="file-card-header">
    <div>
      <div class="file-card-title-row">
        ${typeBadge(f.type)}
        ${fileMcpFindings.length ? `<span style="color:#D97706;font-size:12px;font-weight:600;">⚠ ${fileMcpFindings.length} finding${fileMcpFindings.length !== 1 ? 's' : ''}</span>` : ''}
        <span class="card-title">${esc(f.path)}</span>
      </div>
      <div class="card-path">${esc(f.path)}</div>
    </div>
    <button class="copy-btn" data-copy="${esc(f.path)}" onclick="doCopy(this)">Copy Path</button>
  </div>
  ${Array.isArray(m.servers) && m.servers.length ? `<div class="meta-block"><div class="meta-row"><span class="meta-label">Servers</span> ${(m.servers as string[]).map((s) => badge(s, '#64748B')).join(' ')}</div></div>` : ''}
  ${fileMcpFindings.length ? `
  <div style="margin:12px 0;">
    <div style="font-size:13px;font-weight:600;margin-bottom:8px;">MCP Exposure Findings</div>
    ${fileMcpFindings.map((fi) => `
    <div class="finding-card" style="border-left-color:${sevColor(fi.severity)};background:${sevBg(fi.severity)}">
      <div class="row" style="margin-bottom:4px;">${sevBadge(fi.severity)}<span style="font-size:11px;color:#64748B;">${esc(fi.category)}</span></div>
      <div class="finding-title" style="font-size:14px;">${esc(fi.title)}</div>
      ${fi.evidence ? `<div class="finding-evidence"><strong>Evidence:</strong> <code>${esc(fi.evidence)}</code></div>` : ''}
      ${fi.recommendation ? `<div class="finding-rec">${esc(fi.recommendation)}</div>` : ''}
    </div>`).join('')}
  </div>` : ''}
  ${collapsible('Config JSON', rawBlock(rawId, prettyJson), true)}
</div>`;
  }).join('')}`;
}

// ── Project Docs tab ──────────────────────────────────────────────────────────

const DOC_GROUP_ORDER = ['root', 'docs', 'guides', 'examples', '.ai', '.github', 'other'];
const DOC_GROUP_LABELS: Record<string, string> = {
  root: 'Root',
  docs: 'docs',
  guides: 'guides',
  examples: 'examples',
  '.ai': '.ai',
  '.github': '.github',
  other: 'Other',
};

function topGroupForDoc(p: string): string {
  const parts = p.split('/');
  if (parts.length === 1) return 'root';
  const top = parts[0];
  if (['docs', 'guides', 'examples', '.ai', '.github'].includes(top)) return top;
  return 'other';
}

function renderHeadingOutline(headings: DocHeading[]): string {
  if (!headings.length) return '';
  const items = headings
    .slice(0, 30)
    .map(
      (h) =>
        `<li style="margin-left:${(h.level - 1) * 12}px;font-size:12px;color:#444;">
           <span style="color:#64748B;font-size:10px;">H${h.level}</span> ${esc(h.text)}
         </li>`
    )
    .join('');
  return `<details class="collapsible" open>
    <summary><span class="toggle-icon">▶</span>Heading outline (${headings.length})</summary>
    <ul style="list-style:none;margin:6px 0 0 0;padding:0;">${items}</ul>
  </details>`;
}

function renderDocCard(doc: AgentFile, findingsByPath: Set<string>): string {
  const id = 'doc-' + fileUid(doc.path);
  const rawId = `rawdoc-${id}`;
  const headings = (doc.metadata.headings as DocHeading[]) ?? [];
  const wordCount = (doc.metadata.wordCount as number) ?? 0;
  const group = topGroupForDoc(doc.path);
  const hasWarn = findingsByPath.has(doc.path);

  return `
<div class="card doc-card" id="${id}" data-path="${esc(doc.path)}" data-group="${esc(group)}">
  <div class="file-card-header">
    <div>
      <div class="file-card-title-row">
        ${typeBadge('project_doc')}
        ${hasWarn ? '<span style="color:#D97706;font-size:12px;font-weight:600;">⚠ findings</span>' : ''}
        <span class="card-title">${esc(doc.title || doc.path)}</span>
      </div>
      <div class="card-path">${esc(doc.path)}</div>
    </div>
    <div class="row" style="flex-shrink:0;">
      <span style="font-size:11px;color:#64748B;">${wordCount} words</span>
      <button class="copy-btn" data-copy="${esc(doc.path)}" onclick="doCopy(this)">Copy Path</button>
    </div>
  </div>
  ${renderHeadingOutline(headings)}
  ${doc.contentPreview ? `<details class="collapsible" open>
    <summary><span class="toggle-icon">▶</span>Content preview</summary>
    <p class="card-desc" style="margin-top:6px;">${esc(doc.contentPreview)}</p>
  </details>` : ''}
  ${collapsible('Rendered markdown', doc.renderedContent ? `<div class="rendered-md">${doc.renderedContent}</div>` : `<pre class="code-block">${esc(doc.rawContent)}</pre>`, false)}
  ${collapsible('Raw content', rawBlock(rawId, doc.rawContent), false)}
</div>`;
}

function renderProjectDocsTab(manifest: Manifest): string {
  const info = manifest.projectDocsInfo;
  const docs = manifest.projectDocs ?? [];

  if (!info?.enabled) {
    return `<h2 class="section-title">Project Docs</h2>
<p class="section-desc">Project documentation scanning is disabled. Re-run AgentLens with <code>--include-docs</code> to also discover README and Markdown documentation files alongside agent instruction files.</p>
<pre class="code-block">agentlens build &lt;input&gt; --out &lt;path&gt; --include-docs</pre>`;
  }

  const findingsByPath = new Set(
    manifest.security.findings
      .filter((f) => f.source === 'project_doc')
      .map((f) => f.path)
  );

  const grouped: Record<string, AgentFile[]> = {};
  for (const doc of docs) {
    const g = topGroupForDoc(doc.path);
    (grouped[g] ??= []).push(doc);
  }

  const presentGroups = DOC_GROUP_ORDER.filter((g) => grouped[g]?.length);

  return `<h2 class="section-title">Project Docs</h2>
<p class="section-desc">
  Project documentation files discovered with <code>--include-docs</code>. AgentLens still focuses on the agent instruction layer
  by default — these docs are listed here so you can also see how the project explains itself.
</p>

<div class="summary-grid" style="margin-bottom:18px;">
  <div class="summary-card"><div class="summary-num" style="color:#475569">${info.scanned}</div><div class="summary-label">Scanned</div></div>
  <div class="summary-card"><div class="summary-num" style="color:#334155">${info.total}</div><div class="summary-label">Discovered</div></div>
  <div class="summary-card"><div class="summary-num" style="color:${info.skipped > 0 ? sevColor('medium') : '#16A34A'}">${info.skipped}</div><div class="summary-label">Skipped</div></div>
  <div class="summary-card"><div class="summary-num" style="color:#64748B">${info.maxDocs}</div><div class="summary-label">Max Docs</div></div>
</div>

${docs.length ? `
<div class="filter-bar">
  <span class="filter-label">Search:</span>
  <input id="docs-q" type="search" placeholder="Search by path, title, content..." oninput="applyDocsFilter()" />
  <select id="docs-group" onchange="applyDocsFilter()">
    <option value="">All folders</option>
    ${presentGroups.map((g) => `<option value="${esc(g)}">${esc(DOC_GROUP_LABELS[g] ?? g)}</option>`).join('')}
  </select>
  <span id="docs-count" class="filter-count">${docs.length} doc${docs.length !== 1 ? 's' : ''}</span>
</div>

${presentGroups.map((g) => `
<div class="doc-group" data-group="${esc(g)}">
  <div class="map-group-title">${esc(DOC_GROUP_LABELS[g] ?? g)} (${grouped[g].length})</div>
  ${grouped[g].map((d) => renderDocCard(d, findingsByPath)).join('')}
</div>`).join('')}
` : '<p class="empty-msg">No project documentation files were discovered.</p>'}
`;
}

// ── Fix Prompts tab ───────────────────────────────────────────────────────────

function renderFixPromptsTab(manifest: Manifest): string {
  const { security } = manifest;

  if (!security.findings.length) {
    return `<h2 class="section-title">Remediation Prompts</h2>
<p class="empty-msg">No security findings — no remediation prompts to generate.</p>`;
  }

  return `<h2 class="section-title">Remediation Prompts</h2>
<p class="section-desc">Copy these prompts and paste them to your AI coding agent to remediate security findings. Prompts are deterministic and based on finding category.</p>

${security.findings.map((f, i) => {
    const promptText = FIX_PROMPTS[f.category] ?? `Review the finding in ${f.path} and apply the recommended remediation from AgentLens.`;
    const promptId = `fp-text-${i}`;
    return `
<div class="fix-prompt-card">
  <div class="row" style="margin-bottom:6px;flex-wrap:wrap;">
    ${sevBadge(f.severity)}
    <span style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">${esc(f.category)}</span>
    <code style="font-size:11px;color:#64748B;">${esc(f.path)}</code>
  </div>
  <div style="font-size:13px;font-weight:600;margin-bottom:8px;">${esc(f.title)}</div>
  <pre class="fix-prompt-text" id="${promptId}">${esc(promptText)}</pre>
  <div class="row">
    <button class="copy-btn" onclick="copyById('${promptId}', this)">Copy Prompt</button>
  </div>
</div>`;
  }).join('')}`;
}

// ── Raw Manifest tab ──────────────────────────────────────────────────────────

function renderManifestTab(manifest: Manifest): string {
  const json = safeJson(manifest);
  return `<h2 class="section-title">Raw Manifest</h2>
<p class="section-desc">Machine-readable manifest embedded in this report. This is the same data written to .agentlens/manifest.json.</p>
<div class="code-wrap">
  <pre class="code-block" id="raw-manifest" style="max-height:640px;">${esc(json)}</pre>
  <button class="copy-btn" onclick="copyById('raw-manifest', this)">Copy Manifest</button>
</div>`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function renderReport(manifest: Manifest): string {
  const { repo, summary, security } = manifest;
  const findingCount = totalFindings(security);
  const sc = readinessColor(summary.score, findingCount);
  const readiness = readinessLabel(summary.score);

  const docsEnabled = !!manifest.projectDocsInfo?.enabled;
  const docsCount = manifest.projectDocs?.length ?? 0;

  const tabs = [
    { id: 'overview',     label: 'Overview' },
    { id: 'security',     label: security.findings.length ? `Security (${security.findings.length})` : 'Security' },
    { id: 'map',          label: 'Instruction Map' },
    { id: 'files',        label: 'Files' },
    { id: 'rules',        label: 'Rules' },
    { id: 'skills',       label: 'Skills' },
    { id: 'mcp',          label: 'MCP' },
    ...(docsEnabled ? [{ id: 'project-docs', label: docsCount ? `Project Docs (${docsCount})` : 'Project Docs' }] : []),
    { id: 'fix-prompts',  label: 'Remediation' },
    { id: 'manifest',     label: 'Raw Manifest' },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AgentLens — ${esc(repo.name)}</title>
  <script id="agentlens-manifest" type="application/json">${safeJson(manifest)}</script>
  <style>${CSS}</style>
</head>
<body>

<div class="header">
  <div class="header-inner">
    <div>
      <div class="logo">AgentLens</div>
      <div class="tagline">See how AI agents see your repo.</div>
      <div class="repo-meta">
        <strong>${esc(repo.name)}</strong>
        &nbsp;·&nbsp; <code>${esc(repo.source)}</code>
        &nbsp;·&nbsp; Scanned ${new Date(repo.scannedAt).toLocaleString()}
      </div>
    </div>
    <div class="header-right">
      <div class="header-metric header-score">
        <div class="header-score-label">Readiness</div>
        <div class="score-num-large" style="color:${sc}">${summary.score}<span class="score-suffix"> / 100</span></div>
        <div style="font-size:12px;color:#CBD5E1;margin-top:4px;font-weight:600;">${esc(readiness)}</div>
        <div class="header-metric-note">Artifact coverage, not risk clearance.</div>
      </div>
      <div class="header-metric header-posture">
        <div class="header-posture-label">Risk Posture</div>
        <div style="margin:4px 0 6px;">${postureChip(security.posture)}</div>
        <div class="header-finding-count">${findingCount} finding${findingCount !== 1 ? 's' : ''}</div>
        <div class="header-metric-note">Security posture from findings.</div>
      </div>
    </div>
  </div>
</div>

<nav class="tab-nav">
  <div class="tab-nav-inner">
    ${tabs.map((t) => `<button class="tab-btn" data-tab="${t.id}" onclick="showTab('${t.id}')">${esc(t.label)}</button>`).join('')}
  </div>
</nav>

<div class="main">
  <div id="tab-overview"    class="tab-panel">${renderOverview(manifest)}</div>
  <div id="tab-security"    class="tab-panel">${renderSecurityTab(manifest)}</div>
  <div id="tab-map"         class="tab-panel">${renderMapTab(manifest)}</div>
  <div id="tab-files"       class="tab-panel">${renderFilesTab(manifest)}</div>
  <div id="tab-rules"       class="tab-panel">${renderRulesTab(manifest)}</div>
  <div id="tab-skills"      class="tab-panel">${renderSkillsTab(manifest)}</div>
  <div id="tab-mcp"         class="tab-panel">${renderMcpTab(manifest)}</div>
  ${docsEnabled ? `<div id="tab-project-docs" class="tab-panel">${renderProjectDocsTab(manifest)}</div>` : ''}
  <div id="tab-fix-prompts" class="tab-panel">${renderFixPromptsTab(manifest)}</div>
  <div id="tab-manifest"    class="tab-panel">${renderManifestTab(manifest)}</div>
</div>

<script>${JS}</script>
</body>
</html>`;
}
