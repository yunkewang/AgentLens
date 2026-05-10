import path from 'path';
import { readFile } from 'fs/promises';
import type { SecurityFinding } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AllowlistEntry {
  /** Finding category to suppress (e.g., "possible_secret", "weak_boundary") */
  category?: string;
  /** File path glob or exact path to suppress findings for */
  path?: string;
  /** Regex pattern — suppress findings whose evidence matches this */
  pattern?: string;
  /** Optional reason for the allowlist entry */
  reason?: string;
}

export interface AgentLensConfig {
  /** Findings matching any allowlist entry will be suppressed from the report */
  allowlist?: AllowlistEntry[];
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

const CONFIG_FILENAMES = ['.agentlens.json', 'agentlens.json'];

export async function loadConfig(repoRoot: string): Promise<AgentLensConfig> {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = path.join(repoRoot, filename);
    try {
      const raw = await readFile(configPath, 'utf-8');
      const parsed = JSON.parse(raw) as AgentLensConfig;
      return parsed;
    } catch {
      // File doesn't exist or isn't valid JSON — try next
    }
  }
  return {};
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

function matchesGlob(filePath: string, globPattern: string): boolean {
  const regexStr = globPattern
    .replace(/\./g, '\\.')
    .replace(/\*\*\//g, '(.+/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]+');
  return new RegExp(`^${regexStr}$`).test(filePath);
}

export function applyAllowlist(
  findings: SecurityFinding[],
  config: AgentLensConfig
): { findings: SecurityFinding[]; suppressed: number } {
  const allowlist = config.allowlist;
  if (!allowlist || allowlist.length === 0) {
    return { findings, suppressed: 0 };
  }

  let suppressed = 0;
  const filtered = findings.filter((finding) => {
    for (const entry of allowlist) {
      let matches = true;

      if (entry.category && entry.category !== finding.category) {
        matches = false;
      }

      if (matches && entry.path) {
        if (!matchesGlob(finding.path, entry.path) && finding.path !== entry.path) {
          matches = false;
        }
      }

      if (matches && entry.pattern) {
        try {
          const regex = new RegExp(entry.pattern, 'i');
          if (finding.evidence && !regex.test(finding.evidence)) {
            matches = false;
          } else if (!finding.evidence) {
            matches = false;
          }
        } catch {
          // Invalid regex in config — skip this entry
          matches = false;
        }
      }

      if (matches) {
        suppressed++;
        return false;
      }
    }
    return true;
  });

  return { findings: filtered, suppressed };
}
