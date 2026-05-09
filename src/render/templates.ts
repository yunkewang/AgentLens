import type { AgentFile, Manifest, Risk, SecurityFinding, Warning } from '../core/types';

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
  return s === 'high' ? '#c0392b' : s === 'medium' ? '#e67e22' : s === 'low' ? '#2980b9' : '#7f8c8d';
}

function sevBg(s: string): string {
  return s === 'high' ? '#fdf0ee' : s === 'medium' ? '#fef9f0' : s === 'low' ? '#eaf4fb' : '#f4f6f7';
}

function scoreCol(n: number): string {
  return n >= 75 ? '#27ae60' : n >= 50 ? '#f39c12' : '#c0392b';
}

function typeColor(t: string): string {
  const m: Record<string, string> = {
    generic_instruction: '#2980b9', rule: '#8e44ad', skill: '#16a085',
    mcp_config: '#d35400', prompt: '#2c3e50',
  };
  return m[t] ?? '#555';
}

function typeLabel(t: string): string {
  const m: Record<string, string> = {
    generic_instruction: 'Instruction', rule: 'Rule', skill: 'Skill',
    mcp_config: 'MCP', prompt: 'Prompt',
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
  const m: Record<string, [string, string]> = {
    needs_review: ['Needs Review', '#c0392b'],
    caution: ['Caution', '#e67e22'],
    clean: ['Clean', '#27ae60'],
  };
  const [label, color] = m[posture] ?? ['Clean', '#27ae60'];
  return `<span class="posture-chip" style="background:${color}">${esc(label)}</span>`;
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
  background: #f7f8fa; color: #2c3e50; line-height: 1.6; font-size: 14px;
}
a { color: #2980b9; text-decoration: none; }
a:hover { text-decoration: underline; }
code { font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace; font-size: 0.875em; background: #eef1f4; padding: 1px 5px; border-radius: 3px; }
pre { font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace; }

/* Header */
.header { background: #1a1a2e; color: #fff; padding: 20px 0; }
.header-inner { max-width: 1100px; margin: 0 auto; padding: 0 24px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.logo { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #fff; }
.tagline { font-size: 13px; color: #adb5bd; margin-top: 2px; }
.repo-meta { font-size: 12px; color: #adb5bd; margin-top: 6px; }
.repo-meta code { background: rgba(255,255,255,0.1); color: #ddd; }
.header-score { text-align: right; flex-shrink: 0; }
.score-num-large { font-size: 40px; font-weight: 800; line-height: 1; }
.score-suffix { font-size: 18px; font-weight: 400; color: #adb5bd; }

/* Tab nav */
.tab-nav { background: #252540; border-bottom: 1px solid #1a1a2e; position: sticky; top: 0; z-index: 100; overflow-x: auto; }
.tab-nav-inner { max-width: 1100px; margin: 0 auto; padding: 0 24px; display: flex; }
.tab-btn { background: none; border: none; color: #adb5bd; font-size: 13px; font-weight: 500; padding: 12px 16px; cursor: pointer; white-space: nowrap; border-bottom: 2px solid transparent; transition: color 0.15s, border-color 0.15s; }
.tab-btn:hover { color: #fff; }
.tab-btn.active { color: #fff; border-bottom-color: #4fa3e0; }

/* Layout */
.main { max-width: 1100px; margin: 0 auto; padding: 28px 24px; }
.tab-panel { display: none; }
.tab-panel.active { display: block; }

/* Section title */
.section-title { font-size: 18px; font-weight: 700; color: #1a1a2e; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e1e4e8; }
.section-desc { font-size: 13px; color: #666; background: #f7f8fa; border: 1px solid #e1e4e8; border-radius: 6px; padding: 10px 14px; margin-bottom: 20px; line-height: 1.6; }

/* Cards */
.card { background: #fff; border: 1px solid #e1e4e8; border-radius: 8px; padding: 18px; margin-bottom: 14px; }
.card-title { font-size: 16px; font-weight: 600; color: #1a1a2e; }
.card-path { font-size: 12px; color: #666; margin-top: 2px; font-family: 'SFMono-Regular', Consolas, monospace; }
.card-desc { font-size: 13px; color: #555; margin: 8px 0; }

/* Summary grid */
.summary-grid { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
.summary-card { background: #fff; border: 1px solid #e1e4e8; border-radius: 8px; padding: 14px 18px; min-width: 85px; text-align: center; flex: 1; }
.summary-num { font-size: 28px; font-weight: 700; line-height: 1.1; }
.summary-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px; }

/* Badges */
.badge { display: inline-block; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.5px; vertical-align: middle; }
.posture-chip { display: inline-block; color: #fff; font-size: 12px; font-weight: 600; padding: 3px 12px; border-radius: 12px; }

/* Findings */
.finding-card { border-left: 4px solid; border-radius: 6px; padding: 14px 16px; margin: 8px 0; }
.finding-title { font-weight: 600; font-size: 15px; margin: 6px 0 4px; }
.finding-path { font-size: 12px; color: #666; font-family: 'SFMono-Regular', Consolas, monospace; margin-bottom: 6px; }
.finding-message { font-size: 13px; color: #333; }
.finding-evidence { margin-top: 8px; font-size: 12px; }
.finding-rec { margin-top: 8px; font-size: 13px; color: #555; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.08); }
.finding-group { margin-bottom: 24px; }
.finding-group-header { font-size: 14px; font-weight: 700; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }

/* Filter bar */
.filter-bar { background: #fff; border: 1px solid #e1e4e8; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.filter-bar select, .filter-bar input { border: 1px solid #d1d5da; border-radius: 5px; padding: 6px 10px; font-size: 13px; background: #fff; color: #333; font-family: inherit; }
.filter-bar input { flex: 1; min-width: 160px; }
.filter-label { font-size: 12px; color: #666; font-weight: 600; white-space: nowrap; }
.filter-count { font-size: 12px; color: #888; white-space: nowrap; }

/* Buttons */
.copy-btn { background: #f1f3f5; border: 1px solid #d1d5da; border-radius: 5px; padding: 4px 10px; font-size: 12px; cursor: pointer; color: #333; transition: background 0.15s; font-family: inherit; }
.copy-btn:hover { background: #e2e6ea; }
.copy-btn.copied { background: #d4edda; border-color: #c3e6cb; color: #155724; }
.action-btn { background: #2980b9; color: #fff; border: none; border-radius: 5px; padding: 6px 14px; font-size: 13px; cursor: pointer; font-family: inherit; }
.action-btn:hover { background: #236fa1; }

/* Meta block */
.meta-block { background: #f7f8fa; border: 1px solid #e1e4e8; border-radius: 6px; padding: 10px 14px; margin: 10px 0; font-size: 13px; }
.meta-row { margin: 3px 0; }
.meta-label { font-weight: 600; color: #444; display: inline-block; min-width: 110px; }

/* Code blocks */
.code-block { background: #f4f5f7; border: 1px solid #e1e4e8; border-radius: 6px; padding: 14px; font-size: 12.5px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; max-height: 420px; overflow-y: auto; margin: 10px 0; }

/* Rendered markdown */
.rendered-md { font-size: 14px; line-height: 1.7; }
.rendered-md h1, .rendered-md h2, .rendered-md h3 { margin: 12px 0 6px; font-weight: 600; color: #1a1a2e; }
.rendered-md h1 { font-size: 18px; } .rendered-md h2 { font-size: 16px; } .rendered-md h3 { font-size: 14px; }
.rendered-md p { margin: 6px 0; }
.rendered-md ul, .rendered-md ol { margin: 6px 0 6px 20px; }
.rendered-md li { margin: 2px 0; }
.rendered-md code { background: #eef1f4; }
.rendered-md pre { background: #f4f5f7; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 8px 0; }
.rendered-md blockquote { border-left: 3px solid #d1d5da; padding-left: 12px; color: #666; margin: 8px 0; }
.rendered-md table { border-collapse: collapse; margin: 8px 0; font-size: 13px; }
.rendered-md th, .rendered-md td { border: 1px solid #e1e4e8; padding: 6px 10px; }
.rendered-md th { background: #f7f8fa; }

/* Collapsible */
.collapsible summary { cursor: pointer; font-size: 13px; color: #666; padding: 6px 0; user-select: none; list-style: none; display: flex; align-items: center; gap: 6px; }
.collapsible summary::-webkit-details-marker { display: none; }
.collapsible summary .toggle-icon { font-size: 10px; color: #999; transition: transform 0.15s; display: inline-block; width: 10px; }
details[open] summary .toggle-icon { transform: rotate(90deg); }
.collapsible summary:hover { color: #2980b9; }
.collapsible summary:hover .toggle-icon { color: #2980b9; }

/* Risk items */
.risk-item { padding: 6px 10px; margin: 4px 0; border-radius: 4px; font-size: 13px; border-left: 3px solid; display: flex; align-items: flex-start; gap: 6px; }

/* Warning cards */
.warning-card { padding: 10px 14px; border-radius: 6px; margin: 6px 0; font-size: 13px; display: flex; align-items: flex-start; gap: 8px; border-left: 4px solid; }

/* Instruction map */
.map-group { margin-bottom: 28px; }
.map-group-title { font-size: 12px; font-weight: 700; color: #888; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.8px; }
.map-items { display: flex; flex-wrap: wrap; gap: 8px; }
.map-item { background: #fff; border: 1px solid #e1e4e8; border-radius: 6px; padding: 8px 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 13px; transition: border-color 0.15s, box-shadow 0.15s; max-width: 400px; }
.map-item:hover { border-color: #2980b9; box-shadow: 0 2px 6px rgba(41,128,185,0.12); }
.map-item.has-findings { border-left: 3px solid #e67e22; }
.map-item-path { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; color: #333; word-break: break-all; }
.map-item-warn { color: #e67e22; font-size: 13px; margin-left: auto; flex-shrink: 0; }

/* File card header */
.file-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
.file-card-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }

/* Fix prompts */
.fix-prompt-card { background: #fff; border: 1px solid #e1e4e8; border-radius: 8px; padding: 18px; margin-bottom: 14px; }
.fix-prompt-text { background: #f7f8fa; border: 1px solid #e1e4e8; border-radius: 6px; padding: 12px; font-size: 13px; line-height: 1.7; color: #333; margin: 10px 0; white-space: pre-wrap; font-family: inherit; }

/* Overview layout */
.overview-top { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.score-explanation { list-style: none; margin: 10px 0 0; }
.score-explanation li { font-size: 13px; padding: 2px 0; color: #27ae60; }
.score-explanation li::before { content: '✓  '; }

/* Empty state */
.empty-msg { color: #888; font-size: 14px; padding: 24px 0; }

/* Relative container for copy-on-code */
.code-wrap { position: relative; }
.code-wrap .copy-btn { position: absolute; top: 8px; right: 8px; }

/* Inline row utilities */
.row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

@media (max-width: 700px) {
  .overview-top { grid-template-columns: 1fr; }
  .header-inner { flex-direction: column; }
  .header-score { text-align: left; }
  .summary-card { min-width: 70px; }
  .map-item { max-width: 100%; }
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

  /* Jump from instruction map to file in Files tab */
  function jumpToFile(path) {
    showTab('files');
    var uid = 'f-' + path.replace(/[^a-z0-9]/gi, '-');
    setTimeout(function () {
      var el = document.getElementById(uid);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.style.outline = '2px solid #2980b9';
        setTimeout(function () { el.style.outline = ''; }, 1600);
      }
    }, 80);
  }
  window.jumpToFile = jumpToFile;

  /* Init: show tab from URL hash or default to overview */
  document.addEventListener('DOMContentLoaded', function () {
    var validTabs = ['overview', 'security', 'map', 'files', 'rules', 'skills', 'mcp', 'fix-prompts', 'manifest'];
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
      const serverBadges = (m.servers as string[]).map((s) => badge(s, '#555')).join(' ');
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
  const { repo: _repo, summary, security, files, warnings } = manifest;
  const sc = scoreCol(summary.score);
  const totalFiles = files.length;
  const totalFindings = security.findingsCount.high + security.findingsCount.medium + security.findingsCount.low + security.findingsCount.info;
  const topFindings = security.findings.filter((f) => f.severity === 'high' || f.severity === 'medium').slice(0, 3);

  return `<h2 class="section-title">Overview</h2>

<div class="overview-top">
  <div class="card">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#888;margin-bottom:8px;">Agent Readiness Score</div>
    <div style="display:flex;align-items:baseline;gap:8px;">
      <span style="font-size:44px;font-weight:800;color:${sc};line-height:1;">${summary.score}</span>
      <span style="font-size:16px;color:#aaa;">/ 100</span>
    </div>
    ${summary.scoreExplanation.length ? `<ul class="score-explanation">${summary.scoreExplanation.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
  </div>
  <div class="card">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#888;margin-bottom:8px;">Security Posture</div>
    <div style="margin-bottom:10px;">${postureChip(security.posture)}</div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;">
      <span style="font-size:13px;"><strong style="color:${sevColor('high')}">${security.findingsCount.high}</strong> <span style="color:#666;">High</span></span>
      <span style="font-size:13px;"><strong style="color:${sevColor('medium')}">${security.findingsCount.medium}</strong> <span style="color:#666;">Medium</span></span>
      <span style="font-size:13px;"><strong style="color:${sevColor('low')}">${security.findingsCount.low}</strong> <span style="color:#666;">Low</span></span>
      <span style="font-size:13px;"><strong style="color:${sevColor('info')}">${security.findingsCount.info}</strong> <span style="color:#666;">Info</span></span>
    </div>
  </div>
</div>

<div class="summary-grid">
  <div class="summary-card"><div class="summary-num" style="color:#2c3e50">${totalFiles}</div><div class="summary-label">Total Files</div></div>
  <div class="summary-card"><div class="summary-num" style="color:#2980b9">${summary.counts.genericInstructions}</div><div class="summary-label">Instructions</div></div>
  <div class="summary-card"><div class="summary-num" style="color:#8e44ad">${summary.counts.rules}</div><div class="summary-label">Rules</div></div>
  <div class="summary-card"><div class="summary-num" style="color:#16a085">${summary.counts.skills}</div><div class="summary-label">Skills</div></div>
  <div class="summary-card"><div class="summary-num" style="color:#d35400">${summary.counts.mcpConfigs}</div><div class="summary-label">MCP Configs</div></div>
  <div class="summary-card"><div class="summary-num" style="color:#2c3e50">${summary.counts.prompts}</div><div class="summary-label">Prompts</div></div>
  <div class="summary-card"><div class="summary-num" style="color:${totalFindings > 0 ? sevColor('medium') : '#27ae60'}">${totalFindings}</div><div class="summary-label">Findings</div></div>
</div>

${topFindings.length ? `
<div class="card" style="margin-bottom:16px;">
  <div style="font-size:14px;font-weight:700;margin-bottom:12px;">Top Security Findings</div>
  ${topFindings.map((f) => `
  <div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid #f0f0f0;">
    ${sevBadge(f.severity)}
    <div>
      <div style="font-size:13px;font-weight:600;">${esc(f.title)}</div>
      <div style="font-size:11px;color:#888;font-family:monospace;">${esc(f.path)}</div>
    </div>
  </div>`).join('')}
  <div style="margin-top:12px;"><button class="action-btn" onclick="showTab('security')">View All Findings →</button></div>
</div>` : ''}

${warnings.length ? `
<div class="card">
  <div style="font-size:14px;font-weight:700;margin-bottom:10px;">Readiness Gaps</div>
  ${warnings.map((w) => `
  <div class="warning-card" style="border-left-color:${sevColor(w.severity)};background:${sevBg(w.severity)}">
    ${sevBadge(w.severity)} <span>${esc(w.message)}</span>
  </div>`).join('')}
  <div style="margin-top:12px;"><button class="action-btn" onclick="showTab('map')">View Instruction Map →</button></div>
</div>` : `<div class="card"><div style="color:#27ae60;font-size:14px;">✓ No readiness gaps detected.</div></div>`}
`;
}

// ── Security tab ──────────────────────────────────────────────────────────────

function renderSecurityTab(manifest: Manifest): string {
  const { security } = manifest;
  const total = security.findings.length;
  const categories = [...new Set(security.findings.map((f) => f.category))].sort();

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

<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
  <span style="font-size:13px;color:#555;">Security Posture:</span>
  ${postureChip(security.posture)}
</div>

<div class="summary-grid" style="margin-bottom:20px;">
  <div class="summary-card"><div class="summary-num" style="color:${sevColor('high')}">${security.findingsCount.high}</div><div class="summary-label">High</div></div>
  <div class="summary-card"><div class="summary-num" style="color:${sevColor('medium')}">${security.findingsCount.medium}</div><div class="summary-label">Medium</div></div>
  <div class="summary-card"><div class="summary-num" style="color:${sevColor('low')}">${security.findingsCount.low}</div><div class="summary-label">Low</div></div>
  <div class="summary-card"><div class="summary-num" style="color:${sevColor('info')}">${security.findingsCount.info}</div><div class="summary-label">Info</div></div>
  <div class="summary-card"><div class="summary-num" style="color:#2c3e50">${total}</div><div class="summary-label">Total</div></div>
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
    <span style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">${esc(f.category)}</span>
  </div>
  <div class="finding-title">${esc(f.title)}</div>
  <div class="finding-path"><code>${esc(f.path)}</code></div>
  <div class="finding-message">${esc(f.message)}</div>
  ${f.evidence ? `<div class="finding-evidence"><strong>Evidence:</strong> <code>${esc(f.evidence)}</code></div>` : ''}
  ${f.recommendation ? `<div class="finding-rec"><strong>Recommendation:</strong> ${esc(f.recommendation)}</div>` : ''}
  <div style="margin-top:10px;display:flex;gap:6px;align-items:center;">
    <button class="copy-btn" onclick="copyById('${promptId}', this)">Copy Fix Prompt</button>
    <button class="action-btn" style="font-size:11px;padding:4px 10px;" onclick="showTab('fix-prompts')">Fix Prompts →</button>
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

  return `<h2 class="section-title">Instruction Map</h2>
<p class="section-desc">Visual map of discovered agent instruction files grouped by type. Click any item to view its full detail in the Files tab. Warning indicators show files with security findings.</p>

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
        ${hasWarn ? '<span style="color:#e67e22;font-size:12px;font-weight:600;">⚠ findings</span>' : ''}
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
        ${hasWarn ? '<span style="color:#e67e22;font-size:12px;font-weight:600;">⚠ findings</span>' : ''}
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
        ${hasWarn ? '<span style="color:#e67e22;font-size:12px;font-weight:600;">⚠ findings</span>' : ''}
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
        ${fileMcpFindings.length ? `<span style="color:#e67e22;font-size:12px;font-weight:600;">⚠ ${fileMcpFindings.length} finding${fileMcpFindings.length !== 1 ? 's' : ''}</span>` : ''}
        <span class="card-title">${esc(f.path)}</span>
      </div>
      <div class="card-path">${esc(f.path)}</div>
    </div>
    <button class="copy-btn" data-copy="${esc(f.path)}" onclick="doCopy(this)">Copy Path</button>
  </div>
  ${Array.isArray(m.servers) && m.servers.length ? `<div class="meta-block"><div class="meta-row"><span class="meta-label">Servers</span> ${(m.servers as string[]).map((s) => badge(s, '#555')).join(' ')}</div></div>` : ''}
  ${fileMcpFindings.length ? `
  <div style="margin:12px 0;">
    <div style="font-size:13px;font-weight:600;margin-bottom:8px;">MCP Exposure Findings</div>
    ${fileMcpFindings.map((fi) => `
    <div class="finding-card" style="border-left-color:${sevColor(fi.severity)};background:${sevBg(fi.severity)}">
      <div class="row" style="margin-bottom:4px;">${sevBadge(fi.severity)}<span style="font-size:11px;color:#666;">${esc(fi.category)}</span></div>
      <div class="finding-title" style="font-size:14px;">${esc(fi.title)}</div>
      ${fi.evidence ? `<div class="finding-evidence"><strong>Evidence:</strong> <code>${esc(fi.evidence)}</code></div>` : ''}
      ${fi.recommendation ? `<div class="finding-rec">${esc(fi.recommendation)}</div>` : ''}
    </div>`).join('')}
  </div>` : ''}
  ${collapsible('Config JSON', rawBlock(rawId, prettyJson), true)}
</div>`;
  }).join('')}`;
}

// ── Fix Prompts tab ───────────────────────────────────────────────────────────

function renderFixPromptsTab(manifest: Manifest): string {
  const { security } = manifest;

  if (!security.findings.length) {
    return `<h2 class="section-title">Fix Prompts</h2>
<p class="empty-msg">No security findings — no fix prompts to generate.</p>`;
  }

  return `<h2 class="section-title">Fix Prompts</h2>
<p class="section-desc">Copy these prompts and paste them to your AI coding agent to remediate security findings. Prompts are deterministic and based on finding category.</p>

${security.findings.map((f, i) => {
    const promptText = FIX_PROMPTS[f.category] ?? `Review the finding in ${f.path} and apply the recommended remediation from AgentLens.`;
    const promptId = `fp-text-${i}`;
    return `
<div class="fix-prompt-card">
  <div class="row" style="margin-bottom:6px;flex-wrap:wrap;">
    ${sevBadge(f.severity)}
    <span style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">${esc(f.category)}</span>
    <code style="font-size:11px;color:#888;">${esc(f.path)}</code>
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
  const sc = scoreCol(summary.score);

  const tabs = [
    { id: 'overview',     label: 'Overview' },
    { id: 'security',     label: security.findings.length ? `Security (${security.findings.length})` : 'Security' },
    { id: 'map',          label: 'Instruction Map' },
    { id: 'files',        label: 'Files' },
    { id: 'rules',        label: 'Rules' },
    { id: 'skills',       label: 'Skills' },
    { id: 'mcp',          label: 'MCP' },
    { id: 'fix-prompts',  label: 'Fix Prompts' },
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
    <div class="header-score">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#adb5bd;margin-bottom:4px;">Readiness Score</div>
      <div class="score-num-large" style="color:${sc}">${summary.score}<span class="score-suffix"> / 100</span></div>
      <div style="margin-top:8px;">${postureChip(security.posture)}</div>
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
  <div id="tab-fix-prompts" class="tab-panel">${renderFixPromptsTab(manifest)}</div>
  <div id="tab-manifest"    class="tab-panel">${renderManifestTab(manifest)}</div>
</div>

<script>${JS}</script>
</body>
</html>`;
}
