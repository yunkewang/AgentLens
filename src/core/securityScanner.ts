import type { AgentFile, SecurityFinding, SecuritySummary } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractLineEvidence(content: string, pattern: RegExp): string | undefined {
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (pattern.test(trimmed)) {
      return redactEvidence(trimmed.slice(0, 120));
    }
  }
  return undefined;
}

function redactEvidence(text: string): string {
  return text
    .replace(/ghp_([A-Za-z0-9]{3})[A-Za-z0-9]+([A-Za-z0-9]{3})/g, 'ghp_$1...$2')
    .replace(/sk-([A-Za-z0-9]{3})[A-Za-z0-9]+([A-Za-z0-9]{3})/g, 'sk-$1...$2');
}

// ---------------------------------------------------------------------------
// possible_secret
// ---------------------------------------------------------------------------

const SECRET_MSG =
  'Agent instruction files should not contain secrets, tokens, passwords, or credential material.';
const SECRET_REC =
  'Remove secrets from instruction files and reference secure secret-management workflows instead.';

interface SecretDef {
  pattern: RegExp;
  severity: 'high' | 'medium';
  keyword: string;
}

const HIGH_SECRET_DEFS: SecretDef[] = [
  { pattern: /BEGIN\s+PRIVATE\s+KEY/, severity: 'high', keyword: 'BEGIN PRIVATE KEY' },
  { pattern: /AWS_SECRET_ACCESS_KEY/, severity: 'high', keyword: 'AWS_SECRET_ACCESS_KEY' },
  { pattern: /AWS_ACCESS_KEY_ID/, severity: 'high', keyword: 'AWS_ACCESS_KEY_ID' },
  { pattern: /ghp_[A-Za-z0-9]+/, severity: 'high', keyword: 'ghp_' },
  { pattern: /sk-[A-Za-z0-9]{10,}/, severity: 'high', keyword: 'sk-' },
];

const MEDIUM_SECRET_DEFS: SecretDef[] = [
  { pattern: /\bapi[_-]?key\b\s*[:=]/i, severity: 'medium', keyword: 'api_key' },
  { pattern: /\bapikey\b\s*[:=]/i, severity: 'medium', keyword: 'apikey' },
  { pattern: /\bsecret\b\s*[:=]/i, severity: 'medium', keyword: 'secret' },
  { pattern: /\btoken\b\s*[:=]/i, severity: 'medium', keyword: 'token' },
  { pattern: /\bpassword\b\s*[:=]/i, severity: 'medium', keyword: 'password' },
  { pattern: /\bprivate[_-]?key\b\s*[:=]/i, severity: 'medium', keyword: 'private_key' },
];

function scanPossibleSecrets(file: AgentFile): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const content = file.rawContent;

  for (const def of [...HIGH_SECRET_DEFS, ...MEDIUM_SECRET_DEFS]) {
    if (def.pattern.test(content)) {
      findings.push({
        severity: def.severity,
        category: 'possible_secret',
        title: 'Possible secret reference found',
        message: SECRET_MSG,
        path: file.path,
        evidence: extractLineEvidence(content, def.pattern) ?? def.keyword,
        recommendation: SECRET_REC,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// dangerous_command
// ---------------------------------------------------------------------------

const DANGEROUS_REC =
  'Avoid instructing agents to run destructive, privileged, or remote-piped shell commands. Require human review for dangerous operations.';

interface CommandDef {
  pattern: RegExp;
  severity: 'high' | 'medium';
  label: string;
}

const DANGEROUS_COMMAND_DEFS: CommandDef[] = [
  { pattern: /rm\s+-rf\s+\//, severity: 'high', label: 'rm -rf /' },
  { pattern: /sudo\s+rm/, severity: 'high', label: 'sudo rm' },
  { pattern: /curl\s+[^\n|]*\|\s*sh/, severity: 'high', label: 'curl ... | sh' },
  { pattern: /wget\s+[^\n|]*\|\s*sh/, severity: 'high', label: 'wget ... | sh' },
  { pattern: /chmod\s+777/, severity: 'medium', label: 'chmod 777' },
  { pattern: /\beval\b/, severity: 'medium', label: 'eval' },
  { pattern: /\bexec\b/, severity: 'medium', label: 'exec' },
];

function scanDangerousCommands(file: AgentFile): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const content = file.rawContent;

  for (const def of DANGEROUS_COMMAND_DEFS) {
    if (def.pattern.test(content)) {
      findings.push({
        severity: def.severity,
        category: 'dangerous_command',
        title: `Dangerous command pattern found: ${def.label}`,
        message: 'Agent instruction files contain a potentially destructive or privileged command pattern.',
        path: file.path,
        evidence: extractLineEvidence(content, def.pattern) ?? def.label,
        recommendation: DANGEROUS_REC,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// weak_boundary
// ---------------------------------------------------------------------------

const WEAK_BOUNDARY_PATTERNS: RegExp[] = [
  /read\s+all\s+files/i,
  /access\s+all\s+directories/i,
  /run\s+any\s+command/i,
  /delete\s+files/i,
  /modify\s+anything/i,
  /ignore\s+safety/i,
  /\bbypass\b/i,
  /disable\s+security/i,
  /do\s+not\s+ask\s+for\s+confirmation/i,
];

function scanWeakBoundary(file: AgentFile): SecurityFinding[] {
  const content = file.rawContent;

  for (const pattern of WEAK_BOUNDARY_PATTERNS) {
    if (pattern.test(content)) {
      return [
        {
          severity: 'medium',
          category: 'weak_boundary',
          title: 'Overly broad agent permission language detected',
          message:
            'Agent instruction files contain language that may grant overly broad permissions to the agent.',
          path: file.path,
          evidence: extractLineEvidence(content, pattern),
          recommendation:
            'Narrow the agent boundary. Define allowed files, allowed commands, approval requirements, and explicit no-go areas.',
        },
      ];
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// instruction_override
// ---------------------------------------------------------------------------

const INSTRUCTION_OVERRIDE_PATTERNS: RegExp[] = [
  /ignore\s+all\s+previous\s+instructions/i,
  /ignore\s+previous\s+instructions/i,
  /override\s+system/i,
  /bypass\s+policy/i,
  /always\s+comply/i,
  /do\s+not\s+refuse/i,
];

function scanInstructionOverride(file: AgentFile): SecurityFinding[] {
  const content = file.rawContent;

  for (const pattern of INSTRUCTION_OVERRIDE_PATTERNS) {
    if (pattern.test(content)) {
      return [
        {
          severity: 'medium',
          category: 'instruction_override',
          title: 'Instruction override language detected',
          message:
            'Agent instruction files contain language that may instruct agents to bypass instructions, policies, or safety boundaries.',
          path: file.path,
          evidence: extractLineEvidence(content, pattern),
          recommendation:
            'Remove instruction-override language. Agent instruction files should not tell agents to bypass higher-priority instructions, policies, or safety boundaries.',
        },
      ];
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// data_exfiltration
// ---------------------------------------------------------------------------

const DATA_EXFIL_PATTERNS: RegExp[] = [
  /upload\s+files?\s+to/i,
  /send\s+logs?\s+to/i,
  /post\s+contents?\s+to/i,
  /curl\s+-X\s+POST/i,
  /\bwebhook\b/i,
  /\bpastebin\b/i,
  /external\s+endpoint/i,
];

function scanDataExfiltration(file: AgentFile): SecurityFinding[] {
  const content = file.rawContent;

  for (const pattern of DATA_EXFIL_PATTERNS) {
    if (pattern.test(content)) {
      return [
        {
          severity: 'medium',
          category: 'data_exfiltration',
          title: 'Possible data exfiltration instruction detected',
          message:
            'Agent instruction files appear to contain instructions that may send repository content or data to external destinations.',
          path: file.path,
          evidence: extractLineEvidence(content, pattern),
          recommendation:
            'Avoid instructions that send repo contents, logs, environment variables, or customer data to external endpoints unless explicitly reviewed and approved.',
        },
      ];
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// private_environment
// ---------------------------------------------------------------------------

const PRIVATE_IP_PATTERNS: RegExp[] = [
  /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
  /\b172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/,
  /\b192\.168\.\d{1,3}\.\d{1,3}\b/,
];

const PRIVATE_KEYWORD_PATTERNS: RegExp[] = [
  /\bcorp\.local\b/i,
  /\bintranet\b/i,
  /\binternal\b/i,
];

const CREDENTIAL_NEAR_PATTERN = /secret|key|password|token|credential/i;

function scanPrivateEnvironment(file: AgentFile): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const content = file.rawContent;
  const lines = content.split('\n');

  for (const pattern of [...PRIVATE_IP_PATTERNS, ...PRIVATE_KEYWORD_PATTERNS]) {
    if (!pattern.test(content)) continue;

    const matchingLine = lines.find((l) => pattern.test(l));
    const isNearCredential = matchingLine ? CREDENTIAL_NEAR_PATTERN.test(matchingLine) : false;
    const severity = isNearCredential ? 'medium' : 'low';
    const evidence = matchingLine
      ? redactEvidence(matchingLine.trim().slice(0, 120))
      : undefined;

    findings.push({
      severity,
      category: 'private_environment',
      title: 'Private network or internal environment reference detected',
      message:
        'Agent instruction files contain private network addresses or internal environment identifiers.',
      path: file.path,
      evidence,
      recommendation:
        'Review whether internal environment details should be redacted before sharing instruction files or generated reports.',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// mcp_exposure
// ---------------------------------------------------------------------------

interface McpServerEntry {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

const SHELL_COMMANDS = new Set(['bash', 'sh', 'zsh', 'fish', 'powershell', 'pwsh', 'cmd']);
const SHELL_NAME_FRAGMENTS = ['shell', 'terminal', 'bash', 'exec', 'run'];
const FS_NAME_FRAGMENTS = ['filesystem', 'fs', 'files'];
const FS_PKG_FRAGMENT = '@modelcontextprotocol/server-filesystem';
const BROWSER_NAME_FRAGMENTS = ['browser', 'playwright', 'puppeteer', 'selenium', 'chrome'];
const CLOUD_NAME_FRAGMENTS = ['aws', 'gcp', 'azure', 's3', 'cloud'];
const DB_NAME_FRAGMENTS = [
  'database', 'db', 'postgres', 'mysql', 'sqlite', 'mongo', 'redis', 'supabase',
];
const SAAS_NAME_FRAGMENTS = [
  'github', 'gitlab', 'slack', 'jira', 'confluence', 'notion', 'linear', 'asana', 'trello',
];
const BROAD_FS_ARGS = new Set(['/', '/home', '/root', '/Users', '~']);

function nameContains(name: string, fragments: string[]): boolean {
  return fragments.some((f) => name.includes(f));
}

function scanMcpExposure(file: AgentFile): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(file.rawContent) as Record<string, unknown>;
  } catch {
    return findings;
  }

  const serverMap = (
    (config.mcpServers ?? config.servers ?? {}) as Record<string, McpServerEntry>
  );

  for (const [name, server] of Object.entries(serverMap)) {
    const nameLower = name.toLowerCase();
    const command = server.command ?? '';
    const args = server.args ?? [];
    const argsStr = args.join(' ');

    let severity: SecurityFinding['severity'] = 'info';
    let title = 'MCP server registered';
    let message =
      'This MCP server is registered and may have access to external tools or systems.';
    let recommendation =
      'Review all registered MCP servers and ensure they have the minimum required access.';

    if (SHELL_COMMANDS.has(command) || nameContains(nameLower, SHELL_NAME_FRAGMENTS)) {
      severity = 'high';
      title = 'Shell or terminal MCP server detected';
      message = 'This MCP configuration exposes shell or terminal execution capabilities.';
      recommendation =
        'Avoid registering shell or terminal MCP servers. Prefer specific, scoped tools instead.';
    } else if (nameContains(nameLower, FS_NAME_FRAGMENTS) || argsStr.includes(FS_PKG_FRAGMENT)) {
      if (args.some((a) => BROAD_FS_ARGS.has(a))) {
        severity = 'high';
        title = 'Broad filesystem MCP access';
        message = 'This MCP configuration appears to expose broad filesystem access.';
        recommendation =
          'Restrict filesystem MCP servers to the minimum project directory required.';
      } else {
        severity = 'medium';
        title = 'Filesystem MCP server detected';
        message = 'This MCP configuration exposes filesystem access scoped to a project path.';
        recommendation =
          'Restrict filesystem MCP servers to the minimum project directory required.';
      }
    } else if (nameContains(nameLower, DB_NAME_FRAGMENTS)) {
      severity = 'medium';
      title = 'Database MCP server detected';
      message = 'This MCP configuration exposes database access.';
      recommendation =
        'Ensure database MCP servers have read-only access where possible and are scoped to the minimum required dataset.';
    } else if (nameContains(nameLower, CLOUD_NAME_FRAGMENTS)) {
      severity = 'medium';
      title = 'Cloud provider MCP server detected';
      message = 'This MCP configuration exposes cloud provider access.';
      recommendation =
        'Ensure cloud MCP servers use least-privilege IAM roles and are scoped to required resources only.';
    } else if (nameContains(nameLower, BROWSER_NAME_FRAGMENTS)) {
      severity = 'medium';
      title = 'Browser automation MCP server detected';
      message = 'This MCP configuration exposes browser automation capabilities.';
      recommendation =
        'Ensure browser MCP servers are sandboxed and cannot access credentials stored in the browser.';
    } else if (nameContains(nameLower, SAAS_NAME_FRAGMENTS)) {
      severity = 'medium';
      title = 'External SaaS MCP server detected';
      message = 'This MCP configuration exposes access to an external SaaS tool.';
      recommendation =
        'Ensure external SaaS MCP servers use scoped API tokens with minimum required permissions.';
    }

    const evidenceParts = [`server: ${name}`, `command: ${command}`];
    if (args.length) evidenceParts.push(`args: ${args.join(' ')}`);

    findings.push({
      severity,
      category: 'mcp_exposure',
      title,
      message,
      path: file.path,
      evidence: evidenceParts.join(', '),
      recommendation,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// missing_security_guidance
// ---------------------------------------------------------------------------

const SECURITY_GUIDANCE_PATTERNS: RegExp[] = [
  /\bsecurity\b/i,
  /\bsecrets?\b/i,
  /\bcredentials?\b/i,
  /\btoken\b/i,
  /\bprivacy\b/i,
  /\bsensitive\b/i,
  /customer\s+data/i,
  /\bredact\b/i,
  /do\s+not\s+upload/i,
  /do\s+not\s+expose/i,
];

function checkMissingSecurityGuidance(files: AgentFile[]): SecurityFinding[] {
  const instructionFiles = files.filter(
    (f) => f.type === 'generic_instruction' || f.type === 'rule',
  );

  if (instructionFiles.length === 0) return [];

  const allContent = instructionFiles.map((f) => f.rawContent).join('\n');
  const hasGuidance = SECURITY_GUIDANCE_PATTERNS.some((p) => p.test(allContent));

  if (hasGuidance) return [];

  return [
    {
      severity: 'medium',
      category: 'missing_security_guidance',
      title: 'No security boundary guidance found',
      message:
        'Agent instruction files should define how agents handle secrets, credentials, sensitive data, customer data, and external uploads.',
      path: 'repository',
      recommendation:
        'Add a security boundary section to AGENTS.md or equivalent project-wide instructions.',
    },
  ];
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function runSecurityScan(
  files: AgentFile[],
  projectDocs: AgentFile[] = []
): SecuritySummary {
  const findings: SecurityFinding[] = [];

  for (const file of files) {
    if (file.type === 'mcp_config') {
      findings.push(...scanMcpExposure(file));
      findings.push(...scanPossibleSecrets(file));
    } else {
      findings.push(...scanPossibleSecrets(file));
      findings.push(...scanDangerousCommands(file));
      findings.push(...scanWeakBoundary(file));
      findings.push(...scanInstructionOverride(file));
      findings.push(...scanDataExfiltration(file));
      findings.push(...scanPrivateEnvironment(file));
    }
  }

  for (const doc of projectDocs) {
    const docFindings: SecurityFinding[] = [
      ...scanPossibleSecrets(doc),
      ...scanDangerousCommands(doc),
      ...scanDataExfiltration(doc),
      ...scanPrivateEnvironment(doc),
    ];
    for (const f of docFindings) {
      findings.push({ ...f, source: 'project_doc' });
    }
  }

  findings.push(...checkMissingSecurityGuidance(files));

  for (const f of findings) {
    if (!f.source) f.source = 'agent_instruction';
  }

  const findingsCount = {
    high: findings.filter((f) => f.severity === 'high').length,
    medium: findings.filter((f) => f.severity === 'medium').length,
    low: findings.filter((f) => f.severity === 'low').length,
    info: findings.filter((f) => f.severity === 'info').length,
  };

  const posture: SecuritySummary['posture'] =
    findingsCount.high > 0 ? 'needs_review' :
    findingsCount.medium > 0 ? 'caution' :
    'clean';

  return { posture, findingsCount, findings };
}
