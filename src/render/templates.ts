import type { AgentFile, Manifest, Risk, SecurityFinding, SecuritySummary, Warning } from '../core/types';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'high': return '#c0392b';
    case 'medium': return '#e67e22';
    case 'low': return '#2980b9';
    case 'info': return '#7f8c8d';
    default: return '#7f8c8d';
  }
}

function severityBg(severity: string): string {
  switch (severity) {
    case 'high': return '#fdf0ee';
    case 'medium': return '#fef9f0';
    case 'low': return '#eaf4fb';
    case 'info': return '#f4f6f7';
    default: return '#f4f6f7';
  }
}

function scoreColor(score: number): string {
  if (score >= 75) return '#27ae60';
  if (score >= 50) return '#f39c12';
  return '#c0392b';
}

function typeBadge(type: string, subtype: string): string {
  const labels: Record<string, string> = {
    generic_instruction: 'Instruction',
    rule: 'Rule',
    skill: 'Skill',
    mcp_config: 'MCP',
    prompt: 'Prompt',
  };
  const colors: Record<string, string> = {
    generic_instruction: '#2980b9',
    rule: '#8e44ad',
    skill: '#16a085',
    mcp_config: '#d35400',
    prompt: '#2c3e50',
  };
  const label = labels[type] ?? type;
  const color = colors[type] ?? '#555';
  return `<span class="badge" style="background:${color}">${escapeHtml(label)}</span>`;
}

function renderRisks(risks: Risk[]): string {
  if (!risks.length) return '';
  return risks.map((r) => `
    <div class="risk-item" style="border-left:3px solid ${severityColor(r.severity)};background:${severityBg(r.severity)};padding:6px 10px;margin:4px 0;border-radius:3px;font-size:13px;">
      <strong style="color:${severityColor(r.severity)}">${escapeHtml(r.severity.toUpperCase())}</strong>
      <span style="margin-left:8px;">${escapeHtml(r.message)}</span>
    </div>`).join('');
}

function renderMeta(file: AgentFile): string {
  const parts: string[] = [];
  const m = file.metadata;

  if (file.subtype === 'cursor_mdc') {
    if (m.description) parts.push(`<div class="meta-row"><span class="meta-label">Description:</span> ${escapeHtml(String(m.description))}</div>`);
    if (Array.isArray(m.globs) && m.globs.length) {
      parts.push(`<div class="meta-row"><span class="meta-label">Globs:</span> <code>${(m.globs as string[]).map(escapeHtml).join(', ')}</code></div>`);
    }
    parts.push(`<div class="meta-row"><span class="meta-label">Always Apply:</span> ${m.alwaysApply ? 'Yes' : 'No'}</div>`);
  }

  if (file.type === 'skill') {
    parts.push(`<div class="meta-row"><span class="meta-label">Folder:</span> <code>${escapeHtml(String(m.folder ?? ''))}</code></div>`);
    if (Array.isArray(m.relatedFiles) && m.relatedFiles.length) {
      const fileList = (m.relatedFiles as string[]).map((f) => `<li><code>${escapeHtml(f)}</code></li>`).join('');
      parts.push(`<div class="meta-row"><span class="meta-label">Related Files:</span><ul style="margin:4px 0 0 18px;">${fileList}</ul></div>`);
    }
  }

  if (file.type === 'mcp_config') {
    if (Array.isArray(m.servers) && m.servers.length) {
      const serverList = (m.servers as string[]).map((s) => `<span class="badge" style="background:#666;margin-right:4px;">${escapeHtml(s)}</span>`).join('');
      parts.push(`<div class="meta-row"><span class="meta-label">Servers:</span> ${serverList}</div>`);
    }
  }

  return parts.length ? `<div class="meta-block">${parts.join('')}</div>` : '';
}

function renderFileContent(file: AgentFile): string {
  if (file.type === 'mcp_config') {
    let pretty = file.rawContent;
    try {
      pretty = JSON.stringify(JSON.parse(file.rawContent), null, 2);
    } catch { /* leave as-is */ }
    return `<pre class="code-block">${escapeHtml(pretty)}</pre>`;
  }
  if (file.renderedContent) {
    return `<div class="rendered-md">${file.renderedContent}</div>`;
  }
  return `<pre class="code-block">${escapeHtml(file.rawContent)}</pre>`;
}

function renderCollapsible(id: string, label: string, content: string): string {
  return `
  <details class="collapsible">
    <summary>${escapeHtml(label)}</summary>
    <pre class="code-block raw-block">${escapeHtml(content)}</pre>
  </details>`;
}

function renderFileCard(file: AgentFile): string {
  const uid = file.path.replace(/[^a-z0-9]/gi, '-');
  return `
  <div class="file-card" id="file-${uid}">
    <div class="file-header">
      <div class="file-title-row">
        ${typeBadge(file.type, file.subtype)}
        <h3 class="file-title">${escapeHtml(file.title)}</h3>
      </div>
      <div class="file-path"><code>${escapeHtml(file.path)}</code></div>
    </div>
    ${file.description ? `<p class="file-desc">${escapeHtml(file.description)}</p>` : ''}
    ${renderMeta(file)}
    ${renderRisks(file.risks)}
    <div class="file-content">${renderFileContent(file)}</div>
    ${renderCollapsible(`raw-${uid}`, 'Raw content', file.rawContent)}
  </div>`;
}

function renderSection(title: string, files: AgentFile[], icon: string): string {
  if (!files.length) return '';
  return `
  <section class="section">
    <h2 class="section-title">${icon} ${escapeHtml(title)}</h2>
    ${files.map(renderFileCard).join('\n')}
  </section>`;
}

function renderWarningCards(warnings: Warning[]): string {
  if (!warnings.length) return '<p class="dim-text">No warnings.</p>';
  const sorted = [...warnings].sort((a, b) => {
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });
  return sorted.map((w) => `
    <div class="warning-card" style="border-left:4px solid ${severityColor(w.severity)};background:${severityBg(w.severity)};">
      <span class="badge" style="background:${severityColor(w.severity)}">${escapeHtml(w.severity.toUpperCase())}</span>
      <span style="margin-left:8px;">${escapeHtml(w.message)}</span>
    </div>`).join('\n');
}

function renderSummaryCards(manifest: Manifest): string {
  const { counts } = manifest.summary;
  const cards = [
    { label: 'Instructions', value: counts.genericInstructions, color: '#2980b9' },
    { label: 'Rules', value: counts.rules, color: '#8e44ad' },
    { label: 'Skills', value: counts.skills, color: '#16a085' },
    { label: 'MCP Configs', value: counts.mcpConfigs, color: '#d35400' },
    { label: 'Prompts', value: counts.prompts, color: '#2c3e50' },
    { label: 'Warnings', value: manifest.warnings.length, color: '#c0392b' },
  ];
  return cards.map((c) => `
    <div class="summary-card">
      <div class="summary-num" style="color:${c.color}">${c.value}</div>
      <div class="summary-label">${escapeHtml(c.label)}</div>
    </div>`).join('');
}

function renderSecurityBadge(severity: string): string {
  return `<span class="badge" style="background:${severityColor(severity)}">${escapeHtml(severity.toUpperCase())}</span>`;
}

function renderSecurityFinding(f: SecurityFinding): string {
  return `
  <div class="sec-finding" style="border-left:4px solid ${severityColor(f.severity)};background:${severityBg(f.severity)};border-radius:6px;padding:14px 18px;margin:10px 0;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
      ${renderSecurityBadge(f.severity)}
      <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(f.category)}</span>
    </div>
    <div style="font-weight:600;font-size:15px;margin-bottom:4px;">${escapeHtml(f.title)}</div>
    <div style="font-size:12px;color:#666;margin-bottom:6px;"><code>${escapeHtml(f.path)}</code></div>
    <div style="font-size:14px;color:#333;margin-bottom:${f.evidence || f.recommendation ? '8px' : '0'};">${escapeHtml(f.message)}</div>
    ${f.evidence ? `<div style="margin:6px 0;"><span style="font-size:12px;font-weight:600;color:#444;">Evidence:</span> <code style="font-size:12px;">${escapeHtml(f.evidence)}</code></div>` : ''}
    ${f.recommendation ? `<div style="font-size:13px;color:#555;margin-top:6px;padding-top:6px;border-top:1px solid rgba(0,0,0,0.08);"><strong>Recommendation:</strong> ${escapeHtml(f.recommendation)}</div>` : ''}
  </div>`;
}

function renderSecurityGroup(label: string, severity: string, findings: SecurityFinding[]): string {
  if (!findings.length) return '';
  return `
  <div style="margin-bottom:24px;">
    <h3 style="font-size:15px;font-weight:700;color:${severityColor(severity)};margin-bottom:10px;display:flex;align-items:center;gap:8px;">
      <span class="badge" style="background:${severityColor(severity)}">${escapeHtml(label)}</span>
      <span style="color:#444;font-weight:400;">${findings.length} finding${findings.length !== 1 ? 's' : ''}</span>
    </h3>
    ${findings.map(renderSecurityFinding).join('')}
  </div>`;
}

function renderSecuritySummaryCards(sec: SecuritySummary): string {
  const total = sec.findingsCount.high + sec.findingsCount.medium + sec.findingsCount.low + sec.findingsCount.info;
  const cards = [
    { label: 'High', value: sec.findingsCount.high, color: '#c0392b' },
    { label: 'Medium', value: sec.findingsCount.medium, color: '#e67e22' },
    { label: 'Low', value: sec.findingsCount.low, color: '#2980b9' },
    { label: 'Info', value: sec.findingsCount.info, color: '#7f8c8d' },
    { label: 'Total', value: total, color: '#2c3e50' },
  ];
  return cards.map((c) => `
    <div class="summary-card">
      <div class="summary-num" style="color:${c.color}">${c.value}</div>
      <div class="summary-label">${escapeHtml(c.label)}</div>
    </div>`).join('');
}

function renderPostureChip(posture: SecuritySummary['posture']): string {
  const map: Record<string, { label: string; color: string }> = {
    needs_review: { label: 'Needs Review', color: '#c0392b' },
    caution:      { label: 'Caution',      color: '#e67e22' },
    clean:        { label: 'Clean',        color: '#27ae60' },
  };
  const { label, color } = map[posture] ?? map.clean;
  return `<span class="badge" style="background:${color};font-size:13px;padding:4px 12px;">${escapeHtml(label)}</span>`;
}

function renderSecuritySection(sec: SecuritySummary): string {
  const high   = sec.findings.filter((f) => f.severity === 'high');
  const medium = sec.findings.filter((f) => f.severity === 'medium');
  const low    = sec.findings.filter((f) => f.severity === 'low');
  const info   = sec.findings.filter((f) => f.severity === 'info');

  const noFindings = sec.findings.length === 0;

  return `
  <section class="section" id="security">
    <h2 class="section-title">🔒 Security Review</h2>

    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      <span style="font-size:14px;color:#555;">Security Posture:</span>
      ${renderPostureChip(sec.posture)}
    </div>

    <div class="summary-cards" style="margin-bottom:20px;">
      ${renderSecuritySummaryCards(sec)}
    </div>

    <p style="font-size:13px;color:#666;margin-bottom:20px;background:#f7f8fa;border:1px solid #e1e4e8;border-radius:6px;padding:10px 14px;">
      AgentLens scans the agent instruction layer, not application source code. Findings highlight risks in
      instructions, rules, skills, command files, prompt files, and MCP configs that AI coding agents may follow.
    </p>

    ${noFindings
      ? '<p class="dim-text">No agent instruction security findings detected by the current rule set.</p>'
      : `${renderSecurityGroup('High', 'high', high)}${renderSecurityGroup('Medium', 'medium', medium)}${renderSecurityGroup('Low', 'low', low)}${renderSecurityGroup('Info', 'info', info)}`
    }
  </section>`;
}

export function renderReport(manifest: Manifest): string {
  const { repo, summary, security, files, warnings } = manifest;
  const scoreCol = scoreColor(summary.score);

  const genericInstructions = files.filter((f) => f.type === 'generic_instruction');
  const rules = files.filter((f) => f.type === 'rule');
  const skills = files.filter((f) => f.type === 'skill');
  const mcpConfigs = files.filter((f) => f.type === 'mcp_config');
  const prompts = files.filter((f) => f.type === 'prompt');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AgentLens Report — ${escapeHtml(repo.name)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f7f8fa; color: #2c3e50; line-height: 1.6; }
    a { color: #2980b9; }
    code { font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace; font-size: 0.875em; background: #eef1f4; padding: 1px 5px; border-radius: 3px; }

    .header { background: #fff; border-bottom: 1px solid #e1e4e8; padding: 24px 0; }
    .container { max-width: 1000px; margin: 0 auto; padding: 0 24px; }
    .header-top { display: flex; align-items: baseline; gap: 16px; margin-bottom: 4px; }
    .logo { font-size: 28px; font-weight: 800; letter-spacing: -1px; color: #1a1a2e; }
    .tagline { font-size: 14px; color: #666; }
    .repo-meta { font-size: 13px; color: #555; margin-top: 6px; }
    .repo-meta code { background: #f0f0f0; }

    .summary-bar { background: #fff; border-bottom: 1px solid #e1e4e8; padding: 20px 0; }
    .summary-cards { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
    .summary-card { background: #f7f8fa; border: 1px solid #e1e4e8; border-radius: 8px; padding: 14px 20px; min-width: 110px; text-align: center; }
    .summary-num { font-size: 28px; font-weight: 700; }
    .summary-label { font-size: 12px; color: #666; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }

    .score-badge { display: inline-flex; align-items: center; gap: 10px; background: #fff; border: 2px solid; border-radius: 12px; padding: 10px 20px; margin-top: 12px; }
    .score-num { font-size: 36px; font-weight: 800; }
    .score-label { font-size: 13px; color: #666; }

    .main { padding: 32px 0; }
    .section { margin-bottom: 40px; }
    .section-title { font-size: 18px; font-weight: 700; color: #1a1a2e; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e1e4e8; }

    .file-card { background: #fff; border: 1px solid #e1e4e8; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
    .file-header { margin-bottom: 10px; }
    .file-title-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .file-title { font-size: 17px; font-weight: 600; }
    .file-path { font-size: 13px; color: #555; margin-top: 2px; }
    .file-desc { font-size: 14px; color: #555; margin: 8px 0; }

    .badge { display: inline-block; color: #fff; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.5px; }

    .meta-block { background: #f7f8fa; border: 1px solid #e1e4e8; border-radius: 6px; padding: 10px 14px; margin: 10px 0; font-size: 13px; }
    .meta-row { margin: 3px 0; }
    .meta-label { font-weight: 600; color: #444; min-width: 100px; display: inline-block; }

    .rendered-md { font-size: 14px; line-height: 1.7; }
    .rendered-md h1, .rendered-md h2, .rendered-md h3 { margin: 12px 0 6px; font-weight: 600; }
    .rendered-md p { margin: 6px 0; }
    .rendered-md ul, .rendered-md ol { margin: 6px 0 6px 20px; }
    .rendered-md li { margin: 2px 0; }
    .rendered-md code { background: #eef1f4; padding: 1px 5px; border-radius: 3px; }
    .rendered-md pre { background: #f4f5f7; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 8px 0; }

    .code-block { background: #f4f5f7; border: 1px solid #e1e4e8; border-radius: 6px; padding: 14px; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 13px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; margin: 10px 0; }
    .raw-block { max-height: 300px; overflow-y: auto; margin-top: 8px; }

    .collapsible summary { cursor: pointer; font-size: 13px; color: #555; padding: 6px 0; user-select: none; }
    .collapsible summary:hover { color: #2980b9; }

    .file-content { margin: 12px 0; }

    .warning-card { padding: 10px 14px; border-radius: 6px; margin: 8px 0; font-size: 14px; display: flex; align-items: flex-start; gap: 4px; }

    .score-explanation { list-style: none; margin: 8px 0; }
    .score-explanation li { font-size: 14px; padding: 3px 0; color: #27ae60; }
    .score-explanation li::before { content: '✓ '; }

    .dim-text { color: #888; font-size: 14px; }

    .nav { background: #1a1a2e; color: #aaa; padding: 8px 0; font-size: 13px; position: sticky; top: 0; z-index: 100; }
    .nav .container { display: flex; gap: 16px; align-items: center; overflow-x: auto; }
    .nav a { color: #adb5bd; text-decoration: none; white-space: nowrap; }
    .nav a:hover { color: #fff; }
    .nav .nav-logo { color: #fff; font-weight: 700; margin-right: 8px; }

    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 700px) { .two-col { grid-template-columns: 1fr; } .summary-cards { gap: 8px; } }
  </style>
</head>
<body>

<nav class="nav">
  <div class="container">
    <span class="nav-logo">AgentLens</span>
    <a href="#score">Score</a>
    <a href="#security">Security</a>
    <a href="#warnings">Warnings</a>
    ${genericInstructions.length ? '<a href="#instructions">Instructions</a>' : ''}
    ${rules.length ? '<a href="#rules">Rules</a>' : ''}
    ${skills.length ? '<a href="#skills">Skills</a>' : ''}
    ${mcpConfigs.length ? '<a href="#mcp">MCP</a>' : ''}
    ${prompts.length ? '<a href="#prompts">Prompts</a>' : ''}
  </div>
</nav>

<div class="header">
  <div class="container">
    <div class="header-top">
      <div class="logo">AgentLens</div>
      <div class="tagline">See how AI agents see your repo.</div>
    </div>
    <div class="repo-meta">
      <strong>${escapeHtml(repo.name)}</strong>
      &nbsp;·&nbsp; <code>${escapeHtml(repo.source)}</code>
      &nbsp;·&nbsp; Scanned ${new Date(repo.scannedAt).toLocaleString()}
    </div>
  </div>
</div>

<div class="summary-bar">
  <div class="container">
    <div class="summary-cards">
      ${renderSummaryCards(manifest)}
    </div>
  </div>
</div>

<div class="main">
  <div class="container">

    <section class="section" id="score">
      <h2 class="section-title">🎯 Agent Readiness Score</h2>
      <div class="score-badge" style="border-color:${scoreCol}">
        <div class="score-num" style="color:${scoreCol}">${summary.score}</div>
        <div class="score-label">out of 100</div>
      </div>
      ${summary.scoreExplanation.length ? `
      <ul class="score-explanation" style="margin-top:14px;">
        ${summary.scoreExplanation.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}
      </ul>` : '<p class="dim-text" style="margin-top:10px;">No scoring factors found.</p>'}
    </section>

    ${renderSecuritySection(security)}

    <section class="section" id="warnings">
      <h2 class="section-title">⚠️ Warnings</h2>
      ${renderWarningCards(warnings)}
    </section>

    ${renderSection('Generic Instructions', genericInstructions, '📄')}
    ${renderSection('AI Coding Rules', rules, '📐')}
    ${renderSection('Skills', skills, '🛠️')}
    ${renderSection('MCP Configs', mcpConfigs, '🔌')}
    ${renderSection('Prompts &amp; Commands', prompts, '💬')}

  </div>
</div>

</body>
</html>`;
}
