import fg from 'fast-glob';
import path from 'path';
import {
  DETECTION_PATTERNS,
  SKILL_PATTERN,
  SKILL_PATTERN_DEEP,
} from './detectors';
import {
  parseMarkdownFile,
  parseMdcFile,
  parseSkillFolder,
  parseMcpConfig,
} from './parser';
import type { AgentFile } from './types';

export async function scanRepo(repoRoot: string): Promise<AgentFile[]> {
  const files: AgentFile[] = [];
  const abs = path.resolve(repoRoot);

  // Discover and parse files by pattern group
  for (const pattern of DETECTION_PATTERNS) {
    const matches = await fg(pattern.patterns, {
      cwd: abs,
      dot: true,
      absolute: true,
      ignore: ['node_modules/**', '.git/**', 'dist/**'],
    });

    for (const match of matches) {
      try {
        let agentFile: AgentFile;
        if (pattern.subtype === 'cursor_mdc') {
          agentFile = await parseMdcFile(match, abs);
        } else if (pattern.subtype === 'mcp_json') {
          agentFile = await parseMcpConfig(match, abs);
        } else {
          agentFile = await parseMarkdownFile(match, pattern.type, pattern.subtype, abs);
        }
        files.push(agentFile);
      } catch (err) {
        // Skip files that can't be read
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`Warning: could not parse ${match}: ${msg}`);
      }
    }
  }

  // Skill folders
  const skillMatches = await fg([SKILL_PATTERN, SKILL_PATTERN_DEEP], {
    cwd: abs,
    dot: true,
    absolute: true,
    ignore: ['node_modules/**', '.git/**', 'dist/**'],
    unique: true,
  });

  for (const match of skillMatches) {
    try {
      const agentFile = await parseSkillFolder(match, abs);
      files.push(agentFile);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Warning: could not parse skill at ${match}: ${msg}`);
    }
  }

  // Deduplicate by path
  const seen = new Set<string>();
  return files.filter((f) => {
    if (seen.has(f.path)) return false;
    seen.add(f.path);
    return true;
  });
}
