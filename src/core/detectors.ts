import path from 'path';
import type { FileType, FileSubtype } from './types';

export interface DetectionPattern {
  type: FileType;
  subtype: FileSubtype;
  patterns: string[];
}

export const DETECTION_PATTERNS: DetectionPattern[] = [
  {
    type: 'generic_instruction',
    subtype: 'agents_md',
    patterns: ['AGENTS.md'],
  },
  {
    type: 'generic_instruction',
    subtype: 'claude_md',
    patterns: ['CLAUDE.md'],
  },
  {
    type: 'generic_instruction',
    subtype: 'gemini_md',
    patterns: ['GEMINI.md'],
  },
  {
    type: 'generic_instruction',
    subtype: 'copilot_instructions',
    patterns: ['.github/copilot-instructions.md'],
  },
  {
    type: 'rule',
    subtype: 'cursor_mdc',
    patterns: ['.cursor/rules/*.mdc', '.cursor/rules/**/*.mdc'],
  },
  {
    type: 'rule',
    subtype: 'cursorrules',
    patterns: ['.cursorrules'],
  },
  {
    type: 'rule',
    subtype: 'windsurfrules',
    patterns: ['.windsurfrules'],
  },
  {
    type: 'rule',
    subtype: 'windsurf_md',
    patterns: ['.windsurf/rules/*.md', '.windsurf/rules/**/*.md'],
  },
  {
    type: 'mcp_config',
    subtype: 'mcp_json',
    patterns: ['.mcp.json', 'mcp.json', '.cursor/mcp.json'],
  },
  {
    type: 'prompt',
    subtype: 'command_md',
    patterns: ['.claude/commands/*.md', '.claude/commands/**/*.md'],
  },
  {
    type: 'prompt',
    subtype: 'prompt_md',
    patterns: ['prompts/*.md', 'prompts/**/*.md'],
  },
  {
    type: 'rule',
    subtype: 'rule_md',
    patterns: ['rules/*.md', 'rules/**/*.md'],
  },
];

export const SKILL_PATTERN = '.claude/skills/*/SKILL.md';
export const SKILL_PATTERN_DEEP = '.claude/skills/**/SKILL.md';

export function detectSubtype(filePath: string): { type: FileType; subtype: FileSubtype } | null {
  const normalized = filePath.replace(/\\/g, '/');
  for (const pattern of DETECTION_PATTERNS) {
    for (const glob of pattern.patterns) {
      if (matchGlob(normalized, glob)) {
        return { type: pattern.type, subtype: pattern.subtype };
      }
    }
  }
  return null;
}

function matchGlob(filePath: string, pattern: string): boolean {
  // Simple glob: exact match, * wildcard (single segment), ** wildcard (multi-segment)
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*\//g, '(.+/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]+');
  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(filePath);
}

export function getSkillFolder(skillMdPath: string): string {
  return path.dirname(skillMdPath);
}
