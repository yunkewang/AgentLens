import type { AgentFile, SecurityFinding, SecurityReference, SecuritySummary } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface EvidenceResult {
  text: string;
  lineNumber: number;
}

function extractLineEvidence(content: string, pattern: RegExp): EvidenceResult | undefined {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (pattern.test(trimmed)) {
      return { text: redactEvidence(trimmed.slice(0, 120)), lineNumber: i + 1 };
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
      const ev = extractLineEvidence(content, def.pattern);
      findings.push({
        severity: def.severity,
        category: 'possible_secret',
        title: 'Possible secret reference found',
        message: SECRET_MSG,
        path: file.path,
        evidence: ev?.text ?? def.keyword,
        lineNumber: ev?.lineNumber,
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
      const ev = extractLineEvidence(content, def.pattern);
      findings.push({
        severity: def.severity,
        category: 'dangerous_command',
        title: `Dangerous command pattern found: ${def.label}`,
        message: 'Agent instruction files contain a potentially destructive or privileged command pattern.',
        path: file.path,
        evidence: ev?.text ?? def.label,
        lineNumber: ev?.lineNumber,
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
      const ev = extractLineEvidence(content, pattern);
      return [
        {
          severity: 'medium',
          category: 'weak_boundary',
          title: 'Overly broad agent permission language detected',
          message:
            'Agent instruction files contain language that may grant overly broad permissions to the agent.',
          path: file.path,
          evidence: ev?.text,
          lineNumber: ev?.lineNumber,
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
      const ev = extractLineEvidence(content, pattern);
      return [
        {
          severity: 'medium',
          category: 'instruction_override',
          title: 'Instruction override language detected',
          message:
            'Agent instruction files contain language that may instruct agents to bypass instructions, policies, or safety boundaries.',
          path: file.path,
          evidence: ev?.text,
          lineNumber: ev?.lineNumber,
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
      const ev = extractLineEvidence(content, pattern);
      return [
        {
          severity: 'medium',
          category: 'data_exfiltration',
          title: 'Possible data exfiltration instruction detected',
          message:
            'Agent instruction files appear to contain instructions that may send repository content or data to external destinations.',
          path: file.path,
          evidence: ev?.text,
          lineNumber: ev?.lineNumber,
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

    let matchingLineIdx = -1;
    const matchingLine = lines.find((l, idx) => {
      if (pattern.test(l)) { matchingLineIdx = idx; return true; }
      return false;
    });
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
      lineNumber: matchingLineIdx >= 0 ? matchingLineIdx + 1 : undefined,
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
// prompt_injection_surface
// ---------------------------------------------------------------------------

const PROMPT_INJECTION_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /follow\s+instructions?\s+(?:in|from)\s+(?:code|comments?|files?)/i, label: 'follow instructions in files' },
  { pattern: /execute\s+(?:code\s+blocks?|commands?)\s+(?:you\s+find|found\s+in)/i, label: 'execute found code blocks' },
  { pattern: /do\s+(?:what|whatever)\s+(?:the\s+file|it)\s+says/i, label: 'do what the file says' },
  { pattern: /obey\s+(?:instructions?|commands?)\s+(?:in|from|embedded)/i, label: 'obey embedded instructions' },
  { pattern: /parse\s+and\s+(?:execute|run|follow)/i, label: 'parse and execute' },
  { pattern: /treat\s+(?:comments?|content)\s+as\s+(?:instructions?|commands?)/i, label: 'treat content as instructions' },
  { pattern: /interpret\s+(?:markdown|text|content)\s+as\s+(?:commands?|instructions?)/i, label: 'interpret content as commands' },
];

const PROMPT_INJECTION_REFS: SecurityReference[] = [
  { type: 'owasp_llm', id: 'LLM01', name: 'Prompt Injection', url: 'https://genai.owasp.org/llmrisk/llm01-prompt-injection/' },
  { type: 'cwe', id: 'CWE-94', name: 'Improper Control of Generation of Code', url: 'https://cwe.mitre.org/data/definitions/94.html' },
];

function scanPromptInjectionSurface(file: AgentFile): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const content = file.rawContent;

  for (const def of PROMPT_INJECTION_PATTERNS) {
    if (def.pattern.test(content)) {
      const ev = extractLineEvidence(content, def.pattern);
      findings.push({
        severity: 'high',
        category: 'prompt_injection_surface',
        title: `Prompt injection surface: ${def.label}`,
        message: 'Agent instructions direct the agent to follow or execute content from untrusted sources (files, comments, user input). This creates an indirect prompt injection surface where malicious content in the repo can hijack agent behavior.',
        path: file.path,
        evidence: ev?.text,
        lineNumber: ev?.lineNumber,
        recommendation: 'Never instruct agents to interpret arbitrary file content as commands. Use explicit, bounded instruction sources only.',
        references: PROMPT_INJECTION_REFS,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// privilege_escalation
// ---------------------------------------------------------------------------

const PRIVILEGE_ESCALATION_DEFS: { pattern: RegExp; severity: 'high' | 'medium'; label: string }[] = [
  { pattern: /\bsudo\s/, severity: 'high', label: 'sudo' },
  { pattern: /\bsu\s+-?\s*root\b/, severity: 'high', label: 'su root' },
  { pattern: /--privileged/, severity: 'high', label: '--privileged' },
  { pattern: /--cap-add/, severity: 'medium', label: '--cap-add' },
  { pattern: /\bsetuid\b/, severity: 'high', label: 'setuid' },
  { pattern: /\brunas\s+\/user/i, severity: 'high', label: 'runas /user' },
  { pattern: /\bdoas\b/, severity: 'medium', label: 'doas' },
  { pattern: /run\s+as\s+root/i, severity: 'high', label: 'run as root' },
  { pattern: /admin(?:istrator)?\s+(?:access|privileges?|permissions?)/i, severity: 'medium', label: 'admin access' },
];

const PRIVILEGE_ESCALATION_REFS: SecurityReference[] = [
  { type: 'cwe', id: 'CWE-269', name: 'Improper Privilege Management', url: 'https://cwe.mitre.org/data/definitions/269.html' },
  { type: 'owasp_llm', id: 'LLM07', name: 'Insecure Plugin Design', url: 'https://genai.owasp.org/llmrisk/llm07-insecure-plugin-design/' },
];

function scanPrivilegeEscalation(file: AgentFile): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const content = file.rawContent;

  for (const def of PRIVILEGE_ESCALATION_DEFS) {
    if (def.pattern.test(content)) {
      const ev = extractLineEvidence(content, def.pattern);
      findings.push({
        severity: def.severity,
        category: 'privilege_escalation',
        title: `Privilege escalation pattern: ${def.label}`,
        message: 'Agent instructions include patterns that could grant elevated system privileges. Agents should operate with minimum required permissions.',
        path: file.path,
        evidence: ev?.text,
        lineNumber: ev?.lineNumber,
        recommendation: 'Remove privilege escalation commands. Agents should never run as root or with elevated privileges. Use scoped, least-privilege access instead.',
        references: PRIVILEGE_ESCALATION_REFS,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// supply_chain_risk
// ---------------------------------------------------------------------------

const SUPPLY_CHAIN_DEFS: { pattern: RegExp; severity: 'high' | 'medium'; label: string }[] = [
  { pattern: /curl\s+[^\n]*install[^\n]*\|\s*(?:ba)?sh/i, severity: 'high', label: 'curl install | sh' },
  { pattern: /wget\s+[^\n]*install[^\n]*\|\s*(?:ba)?sh/i, severity: 'high', label: 'wget install | sh' },
  { pattern: /pip\s+install\s+--index-url\s+http:/i, severity: 'high', label: 'pip install from HTTP' },
  { pattern: /npm\s+install\s+--registry\s+http:/i, severity: 'high', label: 'npm install from HTTP registry' },
  { pattern: /git\s+clone\s+http:\/\//i, severity: 'medium', label: 'git clone over HTTP' },
  { pattern: /install\s+(?:from|via)\s+(?:untrusted|unknown|third.?party)/i, severity: 'medium', label: 'install from untrusted source' },
  { pattern: /\badd\s+(?:this\s+)?(?:private|custom)\s+registry/i, severity: 'medium', label: 'custom registry' },
  { pattern: /npm\s+config\s+set\s+registry/i, severity: 'medium', label: 'npm registry override' },
];

const SUPPLY_CHAIN_REFS: SecurityReference[] = [
  { type: 'owasp_llm', id: 'LLM05', name: 'Supply Chain Vulnerabilities', url: 'https://genai.owasp.org/llmrisk/llm05-supply-chain-vulnerabilities/' },
  { type: 'cwe', id: 'CWE-829', name: 'Inclusion of Functionality from Untrusted Control Sphere', url: 'https://cwe.mitre.org/data/definitions/829.html' },
];

function scanSupplyChainRisk(file: AgentFile): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const content = file.rawContent;

  for (const def of SUPPLY_CHAIN_DEFS) {
    if (def.pattern.test(content)) {
      const ev = extractLineEvidence(content, def.pattern);
      findings.push({
        severity: def.severity,
        category: 'supply_chain_risk',
        title: `Supply chain risk: ${def.label}`,
        message: 'Agent instructions reference potentially untrusted package sources, insecure registries, or piped install scripts. These can introduce malicious dependencies.',
        path: file.path,
        evidence: ev?.text,
        lineNumber: ev?.lineNumber,
        recommendation: 'Use verified, pinned dependencies from trusted registries over HTTPS. Never pipe remote scripts directly to shell. Verify checksums for critical dependencies.',
        references: SUPPLY_CHAIN_REFS,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// sensitive_file_reference
// ---------------------------------------------------------------------------

const SENSITIVE_FILE_DEFS: { pattern: RegExp; severity: 'high' | 'medium'; label: string }[] = [
  { pattern: /\.env\b/, severity: 'high', label: '.env' },
  { pattern: /~\/\.ssh\b/, severity: 'high', label: '~/.ssh' },
  { pattern: /id_rsa/, severity: 'high', label: 'id_rsa' },
  { pattern: /id_ed25519/, severity: 'high', label: 'id_ed25519' },
  { pattern: /~\/\.aws\/credentials/, severity: 'high', label: '~/.aws/credentials' },
  { pattern: /~\/\.gnupg/, severity: 'medium', label: '~/.gnupg' },
  { pattern: /~\/\.netrc/, severity: 'high', label: '~/.netrc' },
  { pattern: /\/etc\/shadow/, severity: 'high', label: '/etc/shadow' },
  { pattern: /\/etc\/passwd/, severity: 'medium', label: '/etc/passwd' },
  { pattern: /keychain/i, severity: 'medium', label: 'keychain' },
  { pattern: /\.pem\b/, severity: 'medium', label: '.pem file' },
  { pattern: /\.p12\b/, severity: 'medium', label: '.p12 file' },
  { pattern: /credentials\.json/, severity: 'high', label: 'credentials.json' },
  { pattern: /service.?account.*\.json/i, severity: 'high', label: 'service account JSON' },
  { pattern: /\.kube\/config/, severity: 'high', label: '.kube/config' },
  { pattern: /~\/\.docker\/config/, severity: 'medium', label: '~/.docker/config' },
];

const SENSITIVE_FILE_REFS: SecurityReference[] = [
  { type: 'cwe', id: 'CWE-522', name: 'Insufficiently Protected Credentials', url: 'https://cwe.mitre.org/data/definitions/522.html' },
  { type: 'cwe', id: 'CWE-538', name: 'Insertion of Sensitive Information into Externally-Accessible File', url: 'https://cwe.mitre.org/data/definitions/538.html' },
];

function scanSensitiveFileReference(file: AgentFile): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const content = file.rawContent;

  for (const def of SENSITIVE_FILE_DEFS) {
    if (def.pattern.test(content)) {
      const ev = extractLineEvidence(content, def.pattern);
      findings.push({
        severity: def.severity,
        category: 'sensitive_file_reference',
        title: `Sensitive file reference: ${def.label}`,
        message: 'Agent instructions reference sensitive credential files, key material, or security-critical system files. Agents should not be directed to access these.',
        path: file.path,
        evidence: ev?.text,
        lineNumber: ev?.lineNumber,
        recommendation: 'Remove references to sensitive files from agent instructions. Use environment variables or secret managers instead of direct file access.',
        references: SENSITIVE_FILE_REFS,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// unscoped_network
// ---------------------------------------------------------------------------

const UNSCOPED_NETWORK_PATTERNS: { pattern: RegExp; severity: 'high' | 'medium'; label: string }[] = [
  { pattern: /fetch\s+any\s+(?:URL|endpoint)/i, severity: 'high', label: 'fetch any URL' },
  { pattern: /make\s+(?:HTTP|API)\s+requests?\s+(?:to\s+)?any/i, severity: 'high', label: 'unrestricted HTTP requests' },
  { pattern: /(?:curl|wget|fetch)\s+(?:any|arbitrary)/i, severity: 'high', label: 'arbitrary network requests' },
  { pattern: /no\s+(?:domain|URL|network)\s+restrict/i, severity: 'medium', label: 'no domain restriction' },
  { pattern: /access\s+(?:any|all)\s+(?:external\s+)?(?:APIs?|endpoints?|services?)/i, severity: 'medium', label: 'access any external API' },
  { pattern: /forward\s+(?:requests?|traffic)\s+to/i, severity: 'medium', label: 'forward requests' },
];

const UNSCOPED_NETWORK_REFS: SecurityReference[] = [
  { type: 'cwe', id: 'CWE-918', name: 'Server-Side Request Forgery (SSRF)', url: 'https://cwe.mitre.org/data/definitions/918.html' },
  { type: 'owasp_llm', id: 'LLM07', name: 'Insecure Plugin Design', url: 'https://genai.owasp.org/llmrisk/llm07-insecure-plugin-design/' },
];

function scanUnscopedNetwork(file: AgentFile): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const content = file.rawContent;

  for (const def of UNSCOPED_NETWORK_PATTERNS) {
    if (def.pattern.test(content)) {
      const ev = extractLineEvidence(content, def.pattern);
      findings.push({
        severity: def.severity,
        category: 'unscoped_network',
        title: `Unscoped network access: ${def.label}`,
        message: 'Agent instructions grant unrestricted network access. Without domain allowlists, agents can become SSRF vectors or exfiltrate data to arbitrary endpoints.',
        path: file.path,
        evidence: ev?.text,
        lineNumber: ev?.lineNumber,
        recommendation: 'Define an explicit domain allowlist for network access. Agents should only communicate with known, approved endpoints.',
        references: UNSCOPED_NETWORK_REFS,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// code_execution_unsandboxed
// ---------------------------------------------------------------------------

const CODE_EXEC_PATTERNS: { pattern: RegExp; severity: 'high' | 'medium'; label: string }[] = [
  { pattern: /(?:run|execute)\s+(?:the\s+)?generated\s+code/i, severity: 'high', label: 'execute generated code' },
  { pattern: /eval\s*\(\s*(?:response|output|result)/i, severity: 'high', label: 'eval(response)' },
  { pattern: /execute\s+(?:the\s+)?(?:output|result|response)/i, severity: 'high', label: 'execute output' },
  { pattern: /run\s+(?:whatever|any)\s+code/i, severity: 'high', label: 'run any code' },
  { pattern: /(?:compile|build)\s+and\s+(?:run|execute)\s+(?:without|no)\s+(?:sandbox|review|check)/i, severity: 'high', label: 'compile and run without sandbox' },
  { pattern: /directly\s+execute/i, severity: 'medium', label: 'directly execute' },
  { pattern: /auto.?(?:run|execute)\s+(?:code|scripts?)/i, severity: 'medium', label: 'auto-run code' },
];

const CODE_EXEC_REFS: SecurityReference[] = [
  { type: 'owasp_llm', id: 'LLM02', name: 'Insecure Output Handling', url: 'https://genai.owasp.org/llmrisk/llm02-insecure-output-handling/' },
  { type: 'cwe', id: 'CWE-94', name: 'Improper Control of Generation of Code', url: 'https://cwe.mitre.org/data/definitions/94.html' },
];

function scanCodeExecutionUnsandboxed(file: AgentFile): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const content = file.rawContent;

  for (const def of CODE_EXEC_PATTERNS) {
    if (def.pattern.test(content)) {
      const ev = extractLineEvidence(content, def.pattern);
      findings.push({
        severity: def.severity,
        category: 'code_execution_unsandboxed',
        title: `Unsandboxed code execution: ${def.label}`,
        message: 'Agent instructions direct the agent to execute generated or arbitrary code without sandboxing or human review. LLM outputs are inherently unpredictable and should never be executed directly.',
        path: file.path,
        evidence: ev?.text,
        lineNumber: ev?.lineNumber,
        recommendation: 'Never execute LLM-generated code without human review or sandboxing. Use isolated environments, containers, or approval gates for any code execution.',
        references: CODE_EXEC_REFS,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// persistence_mechanism
// ---------------------------------------------------------------------------

const PERSISTENCE_DEFS: { pattern: RegExp; severity: 'high' | 'medium'; label: string }[] = [
  { pattern: /crontab/i, severity: 'high', label: 'crontab' },
  { pattern: /cron\s+job/i, severity: 'high', label: 'cron job' },
  { pattern: /\bsystemd\b/, severity: 'high', label: 'systemd service' },
  { pattern: /\blaunchd\b/, severity: 'high', label: 'launchd' },
  { pattern: /\.bashrc\b/, severity: 'medium', label: '.bashrc modification' },
  { pattern: /\.zshrc\b/, severity: 'medium', label: '.zshrc modification' },
  { pattern: /\.profile\b/, severity: 'medium', label: '.profile modification' },
  { pattern: /\.bash_profile\b/, severity: 'medium', label: '.bash_profile modification' },
  { pattern: /git\s+hooks?/i, severity: 'medium', label: 'git hooks' },
  { pattern: /pre-commit\s+hook/i, severity: 'medium', label: 'pre-commit hook' },
  { pattern: /post-commit\s+hook/i, severity: 'medium', label: 'post-commit hook' },
  { pattern: /startup\s+script/i, severity: 'medium', label: 'startup script' },
  { pattern: /\binit\.d\b/, severity: 'high', label: 'init.d' },
  { pattern: /rc\.local/, severity: 'high', label: 'rc.local' },
  { pattern: /(?:modify|edit|add\s+to)\s+(?:the\s+)?CI\s+(?:config|pipeline|workflow)/i, severity: 'medium', label: 'CI pipeline modification' },
];

const PERSISTENCE_REFS: SecurityReference[] = [
  { type: 'cwe', id: 'CWE-912', name: 'Hidden Functionality', url: 'https://cwe.mitre.org/data/definitions/912.html' },
  { type: 'mitre_atlas', id: 'AML.T0011', name: 'User Execution', url: 'https://atlas.mitre.org/techniques/AML.T0011' },
];

function scanPersistenceMechanism(file: AgentFile): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const content = file.rawContent;

  for (const def of PERSISTENCE_DEFS) {
    if (def.pattern.test(content)) {
      const ev = extractLineEvidence(content, def.pattern);
      findings.push({
        severity: def.severity,
        category: 'persistence_mechanism',
        title: `Persistence mechanism: ${def.label}`,
        message: 'Agent instructions reference mechanisms that could establish persistent access or scheduled execution. Agents should not modify system startup, cron, shell profiles, or CI pipelines without explicit approval.',
        path: file.path,
        evidence: ev?.text,
        lineNumber: ev?.lineNumber,
        recommendation: 'Remove instructions to modify persistent system configurations. Agents should not install cron jobs, modify shell profiles, add git hooks, or alter CI pipelines autonomously.',
        references: PERSISTENCE_REFS,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// shadow_instructions
// ---------------------------------------------------------------------------

const SHADOW_INSTRUCTION_DEFS: { pattern: RegExp; severity: 'high' | 'medium'; label: string }[] = [
  { pattern: /[A-Za-z0-9+/]{40,}={0,2}/, severity: 'medium', label: 'base64 encoded content' },
  { pattern: /\\x[0-9a-f]{2}(?:\\x[0-9a-f]{2}){3,}/i, severity: 'high', label: 'hex-escaped content' },
  { pattern: /\\u[0-9a-f]{4}(?:\\u[0-9a-f]{4}){3,}/i, severity: 'high', label: 'unicode-escaped content' },
  { pattern: /<!--\s*(?:instruction|command|execute|run|do|follow)/i, severity: 'high', label: 'hidden instruction in HTML comment' },
  { pattern: /\u200B|\u200C|\u200D|\uFEFF/, severity: 'high', label: 'zero-width characters' },
];

const SHADOW_INSTRUCTION_REFS: SecurityReference[] = [
  { type: 'owasp_llm', id: 'LLM01', name: 'Prompt Injection', url: 'https://genai.owasp.org/llmrisk/llm01-prompt-injection/' },
  { type: 'cwe', id: 'CWE-116', name: 'Improper Encoding or Escaping of Output', url: 'https://cwe.mitre.org/data/definitions/116.html' },
];

function scanShadowInstructions(file: AgentFile): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const content = file.rawContent;

  for (const def of SHADOW_INSTRUCTION_DEFS) {
    if (def.pattern.test(content)) {
      // Skip base64 false positives: only flag if it's long enough and doesn't look like a hash/commit
      if (def.label === 'base64 encoded content') {
        const match = content.match(def.pattern);
        if (match && match[0].length < 60) continue; // Short b64 strings are likely hashes, not hidden instructions
      }

      const ev = extractLineEvidence(content, def.pattern);
      findings.push({
        severity: def.severity,
        category: 'shadow_instructions',
        title: `Shadow instruction detected: ${def.label}`,
        message: 'Agent instruction files contain obfuscated or hidden content that may not be visible during normal review. This could be used to smuggle malicious instructions past human reviewers.',
        path: file.path,
        evidence: ev?.text,
        lineNumber: ev?.lineNumber,
        recommendation: 'Remove obfuscated content from agent instruction files. All instructions should be human-readable. Audit for zero-width characters, encoded payloads, and hidden HTML comments.',
        references: SHADOW_INSTRUCTION_REFS,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// approval_bypass
// ---------------------------------------------------------------------------

const APPROVAL_BYPASS_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /auto.?(?:approve|merge|deploy)/i, label: 'auto-approve' },
  { pattern: /(?:no|skip|without)\s+(?:human\s+)?(?:confirmation|approval|review)/i, label: 'skip confirmation' },
  { pattern: /merge\s+without\s+(?:review|approval)/i, label: 'merge without review' },
  { pattern: /deploy\s+(?:directly|immediately|without)/i, label: 'deploy without gate' },
  { pattern: /(?:disable|remove|skip)\s+(?:code\s+)?review/i, label: 'skip code review' },
  { pattern: /push\s+(?:directly\s+)?to\s+(?:main|master|prod)/i, label: 'push directly to main' },
  { pattern: /--(?:no-verify|force)/i, label: '--no-verify / --force' },
  { pattern: /force\s+push/i, label: 'force push' },
];

const APPROVAL_BYPASS_REFS: SecurityReference[] = [
  { type: 'cwe', id: 'CWE-862', name: 'Missing Authorization', url: 'https://cwe.mitre.org/data/definitions/862.html' },
  { type: 'owasp_llm', id: 'LLM07', name: 'Insecure Plugin Design', url: 'https://genai.owasp.org/llmrisk/llm07-insecure-plugin-design/' },
];

function scanApprovalBypass(file: AgentFile): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const content = file.rawContent;

  for (const def of APPROVAL_BYPASS_PATTERNS) {
    if (def.pattern.test(content)) {
      const ev = extractLineEvidence(content, def.pattern);
      findings.push({
        severity: 'medium',
        category: 'approval_bypass',
        title: `Approval bypass: ${def.label}`,
        message: 'Agent instructions include patterns that bypass human review, approval gates, or safety checks. Removing human-in-the-loop safeguards increases risk of unreviewed changes reaching production.',
        path: file.path,
        evidence: ev?.text,
        lineNumber: ev?.lineNumber,
        recommendation: 'Maintain human approval gates for deployments, merges to protected branches, and security-sensitive operations. Agents should propose changes, not force them through.',
        references: APPROVAL_BYPASS_REFS,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// insecure_defaults
// ---------------------------------------------------------------------------

const INSECURE_DEFAULT_DEFS: { pattern: RegExp; severity: 'high' | 'medium'; label: string }[] = [
  { pattern: /--insecure\b/, severity: 'high', label: '--insecure flag' },
  { pattern: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/i, severity: 'high', label: 'TLS verification disabled' },
  { pattern: /verify\s*=\s*False/i, severity: 'high', label: 'SSL verify=False' },
  { pattern: /CURLOPT_SSL_VERIFYPEER.*false/i, severity: 'high', label: 'CURLOPT_SSL_VERIFYPEER false' },
  { pattern: /ssl[_.]?verify\s*[:=]\s*(?:false|0|no|off)/i, severity: 'high', label: 'SSL verify disabled' },
  { pattern: /http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/i, severity: 'medium', label: 'HTTP (not HTTPS) URL' },
  { pattern: /disable\s+(?:TLS|SSL|certificate\s+(?:check|verification))/i, severity: 'high', label: 'disable TLS' },
  { pattern: /allow\s+(?:self.?signed|invalid)\s+cert/i, severity: 'medium', label: 'allow invalid certificates' },
];

const INSECURE_DEFAULT_REFS: SecurityReference[] = [
  { type: 'cwe', id: 'CWE-295', name: 'Improper Certificate Validation', url: 'https://cwe.mitre.org/data/definitions/295.html' },
  { type: 'cwe', id: 'CWE-319', name: 'Cleartext Transmission of Sensitive Information', url: 'https://cwe.mitre.org/data/definitions/319.html' },
];

function scanInsecureDefaults(file: AgentFile): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const content = file.rawContent;

  for (const def of INSECURE_DEFAULT_DEFS) {
    if (def.pattern.test(content)) {
      const ev = extractLineEvidence(content, def.pattern);
      findings.push({
        severity: def.severity,
        category: 'insecure_defaults',
        title: `Insecure default: ${def.label}`,
        message: 'Agent instructions disable transport security or use insecure defaults. This exposes communications to man-in-the-middle attacks and credential theft.',
        path: file.path,
        evidence: ev?.text,
        lineNumber: ev?.lineNumber,
        recommendation: 'Always use HTTPS/TLS for network communications. Never disable certificate verification. Remove --insecure flags and verify=False patterns.',
        references: INSECURE_DEFAULT_REFS,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// cross_file_duplicate
// ---------------------------------------------------------------------------

function scanCrossFileDuplicates(files: AgentFile[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  // Track secrets found across files: keyword -> list of paths
  const secretOccurrences = new Map<string, { paths: string[]; severity: SecurityFinding['severity'] }>();

  for (const file of files) {
    if (file.type === 'mcp_config') continue;
    const content = file.rawContent;

    for (const def of [...HIGH_SECRET_DEFS, ...MEDIUM_SECRET_DEFS]) {
      if (def.pattern.test(content)) {
        const existing = secretOccurrences.get(def.keyword);
        if (existing) {
          existing.paths.push(file.path);
        } else {
          secretOccurrences.set(def.keyword, { paths: [file.path], severity: def.severity });
        }
      }
    }
  }

  for (const [keyword, { paths, severity }] of secretOccurrences) {
    if (paths.length < 2) continue;
    findings.push({
      severity,
      category: 'cross_file_duplicate',
      title: `Same secret pattern appears in ${paths.length} files`,
      message: `The pattern "${keyword}" was found in multiple agent instruction files. Duplicate secrets increase exposure risk and make rotation harder.`,
      path: paths[0],
      evidence: `Also found in: ${paths.slice(1).join(', ')}`,
      recommendation: 'Consolidate secret references to a single location and use secure secret-management workflows.',
    });
  }

  return findings;
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
      findings.push(...scanPromptInjectionSurface(file));
      findings.push(...scanPrivilegeEscalation(file));
      findings.push(...scanSupplyChainRisk(file));
      findings.push(...scanSensitiveFileReference(file));
      findings.push(...scanUnscopedNetwork(file));
      findings.push(...scanCodeExecutionUnsandboxed(file));
      findings.push(...scanPersistenceMechanism(file));
      findings.push(...scanShadowInstructions(file));
      findings.push(...scanApprovalBypass(file));
      findings.push(...scanInsecureDefaults(file));
    }
  }

  // Cross-file analysis
  findings.push(...scanCrossFileDuplicates(files));

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
