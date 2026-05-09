import type { AgentFile, Risk } from './types';

interface RiskPattern {
  pattern: RegExp;
  severity: Risk['severity'];
  category: string;
  message: string;
}

const SECRET_PATTERNS: RiskPattern[] = [
  {
    pattern: /api[_-]?key\s*[:=]/i,
    severity: 'high',
    category: 'possible_secret',
    message: 'Possible API key reference found.',
  },
  {
    pattern: /apikey\s*[:=]/i,
    severity: 'high',
    category: 'possible_secret',
    message: 'Possible API key reference found.',
  },
  {
    pattern: /private[_-]?key\s*[:=]/i,
    severity: 'high',
    category: 'possible_secret',
    message: 'Possible private key reference found.',
  },
  {
    pattern: /BEGIN\s+PRIVATE\s+KEY/,
    severity: 'high',
    category: 'possible_secret',
    message: 'Possible private key block found.',
  },
  {
    pattern: /AWS_ACCESS_KEY_ID/,
    severity: 'high',
    category: 'possible_secret',
    message: 'Possible AWS access key reference found.',
  },
  {
    pattern: /AWS_SECRET_ACCESS_KEY/,
    severity: 'high',
    category: 'possible_secret',
    message: 'Possible AWS secret key reference found.',
  },
  {
    pattern: /ghp_[A-Za-z0-9]+/,
    severity: 'high',
    category: 'possible_secret',
    message: 'Possible GitHub personal access token found.',
  },
  {
    pattern: /sk-[A-Za-z0-9]{20,}/,
    severity: 'high',
    category: 'possible_secret',
    message: 'Possible API secret key found.',
  },
  {
    pattern: /password\s*[:=]/i,
    severity: 'medium',
    category: 'possible_secret',
    message: 'Possible password reference found.',
  },
  {
    pattern: /\bsecret\b\s*[:=]/i,
    severity: 'medium',
    category: 'possible_secret',
    message: 'Possible secret reference found.',
  },
  {
    pattern: /\btoken\b\s*[:=]/i,
    severity: 'medium',
    category: 'possible_secret',
    message: 'Possible token reference found.',
  },
];

const PRIVATE_IP_PATTERNS: RiskPattern[] = [
  {
    pattern: /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
    severity: 'low',
    category: 'private_network',
    message: 'Private network address (10.x.x.x) found.',
  },
  {
    pattern: /\b172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/,
    severity: 'medium',
    category: 'private_network',
    message: 'Private network address (172.16-31.x.x) found.',
  },
  {
    pattern: /\b192\.168\.\d{1,3}\.\d{1,3}\b/,
    severity: 'low',
    category: 'private_network',
    message: 'Private network address (192.168.x.x) found.',
  },
];

const DANGEROUS_COMMAND_PATTERNS: RiskPattern[] = [
  {
    pattern: /rm\s+-rf\s+\//,
    severity: 'high',
    category: 'dangerous_command',
    message: 'Dangerous command "rm -rf /" found.',
  },
  {
    pattern: /sudo\s+rm/,
    severity: 'high',
    category: 'dangerous_command',
    message: 'Dangerous command "sudo rm" found.',
  },
  {
    pattern: /chmod\s+777/,
    severity: 'medium',
    category: 'dangerous_command',
    message: 'Dangerous command "chmod 777" found.',
  },
  {
    pattern: /curl\s+[^|]+\|\s*sh/,
    severity: 'high',
    category: 'dangerous_command',
    message: 'Dangerous "curl ... | sh" pattern found.',
  },
  {
    pattern: /wget\s+[^|]+\|\s*sh/,
    severity: 'high',
    category: 'dangerous_command',
    message: 'Dangerous "wget ... | sh" pattern found.',
  },
];

const WEAK_BOUNDARY_PATTERNS: RiskPattern[] = [
  {
    pattern: /read\s+all\s+files/i,
    severity: 'medium',
    category: 'weak_boundary',
    message: 'Overly broad file access language detected.',
  },
  {
    pattern: /run\s+any\s+command/i,
    severity: 'medium',
    category: 'weak_boundary',
    message: 'Overly broad command execution language detected.',
  },
  {
    pattern: /access\s+all\s+directories/i,
    severity: 'medium',
    category: 'weak_boundary',
    message: 'Overly broad directory access language detected.',
  },
  {
    pattern: /ignore\s+safety/i,
    severity: 'medium',
    category: 'weak_boundary',
    message: 'Safety override language detected.',
  },
  {
    pattern: /do\s+not\s+ask\s+for\s+confirmation/i,
    severity: 'medium',
    category: 'weak_boundary',
    message: 'Confirmation bypass language detected.',
  },
];

const INSTRUCTION_OVERRIDE_PATTERNS: RiskPattern[] = [
  {
    pattern: /ignore\s+(all\s+)?previous\s+instructions/i,
    severity: 'medium',
    category: 'instruction_override',
    message: 'Instruction override language detected.',
  },
  {
    pattern: /bypass\s+policy/i,
    severity: 'medium',
    category: 'instruction_override',
    message: 'Policy bypass language detected.',
  },
  {
    pattern: /always\s+comply/i,
    severity: 'medium',
    category: 'instruction_override',
    message: 'Unconditional compliance language detected.',
  },
  {
    pattern: /do\s+not\s+refuse/i,
    severity: 'medium',
    category: 'instruction_override',
    message: 'Refusal suppression language detected.',
  },
];

const DATA_EXFILTRATION_PATTERNS: RiskPattern[] = [
  {
    pattern: /upload\s+files?\s+to/i,
    severity: 'medium',
    category: 'data_exfiltration',
    message: 'Data upload instruction detected.',
  },
  {
    pattern: /\bwebhook\b/i,
    severity: 'medium',
    category: 'data_exfiltration',
    message: 'Webhook reference detected.',
  },
  {
    pattern: /\bpastebin\b/i,
    severity: 'medium',
    category: 'data_exfiltration',
    message: 'Pastebin reference detected.',
  },
  {
    pattern: /curl\s+-X\s+POST/i,
    severity: 'medium',
    category: 'data_exfiltration',
    message: 'Outbound POST request instruction detected.',
  },
];

const MCP_RISK_SERVERS = ['filesystem', 'shell', 'exec', 'bash', 'terminal', 'network'];

const ALL_TEXT_PATTERNS = [
  ...SECRET_PATTERNS,
  ...PRIVATE_IP_PATTERNS,
  ...DANGEROUS_COMMAND_PATTERNS,
  ...WEAK_BOUNDARY_PATTERNS,
  ...INSTRUCTION_OVERRIDE_PATTERNS,
  ...DATA_EXFILTRATION_PATTERNS,
];

export function scanFileRisks(file: AgentFile): Risk[] {
  const risks: Risk[] = [];
  const content = file.rawContent;

  for (const riskPattern of ALL_TEXT_PATTERNS) {
    if (riskPattern.pattern.test(content)) {
      risks.push({
        severity: riskPattern.severity,
        category: riskPattern.category,
        message: riskPattern.message,
        path: file.path,
      });
    }
  }

  if (file.type === 'mcp_config') {
    const servers = (file.metadata.servers as string[]) ?? [];
    for (const server of servers) {
      if (MCP_RISK_SERVERS.some((r) => server.toLowerCase().includes(r))) {
        risks.push({
          severity: 'medium',
          category: 'mcp_risk',
          message: `MCP config references potentially sensitive server: "${server}"`,
          path: file.path,
        });
      }
    }
    if (servers.length > 0) {
      risks.push({
        severity: 'low',
        category: 'mcp_external_tools',
        message: 'MCP config references external tools.',
        path: file.path,
      });
    }
  }

  return risks;
}

export function applyRisks(files: AgentFile[]): AgentFile[] {
  return files.map((file) => ({
    ...file,
    risks: [...file.risks, ...scanFileRisks(file)],
  }));
}
