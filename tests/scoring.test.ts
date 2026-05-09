import { calculateScore, generateWarnings } from '../src/core/scoring';
import type { AgentFile } from '../src/core/types';

function makeFile(overrides: Partial<AgentFile>): AgentFile {
  return {
    type: 'generic_instruction',
    subtype: 'agents_md',
    path: 'AGENTS.md',
    title: 'AGENTS.md',
    description: '',
    metadata: {},
    risks: [],
    contentPreview: '',
    rawContent: '',
    ...overrides,
  };
}

describe('scoring', () => {
  it('starts at 0 for empty file list', () => {
    const result = calculateScore([]);
    expect(result.score).toBe(0);
    expect(result.explanation).toHaveLength(0);
  });

  it('adds 20 for AGENTS.md', () => {
    const files = [makeFile({ subtype: 'agents_md' })];
    const result = calculateScore(files);
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.explanation.some((e) => e.includes('+20'))).toBe(true);
  });

  it('adds 15 for CLAUDE.md', () => {
    const files = [makeFile({ subtype: 'claude_md' })];
    const result = calculateScore(files);
    expect(result.score).toBeGreaterThanOrEqual(15);
    expect(result.explanation.some((e) => e.includes('+15') && e.includes('project-wide'))).toBe(true);
  });

  it('adds 15 for rule files', () => {
    const files = [makeFile({ type: 'rule', subtype: 'cursor_mdc' })];
    const result = calculateScore(files);
    expect(result.score).toBeGreaterThanOrEqual(15);
    expect(result.explanation.some((e) => e.includes('rule'))).toBe(true);
  });

  it('adds 10 for test/validation guidance in content', () => {
    const files = [makeFile({ rawContent: 'Run tests before committing.' })];
    const result = calculateScore(files);
    expect(result.explanation.some((e) => e.includes('validation/test'))).toBe(true);
  });

  it('adds 10 for security guidance in content', () => {
    const files = [makeFile({ rawContent: 'Do not expose secrets or credentials.' })];
    const result = calculateScore(files);
    expect(result.explanation.some((e) => e.includes('security'))).toBe(true);
  });

  it('caps score at 100', () => {
    const files = [
      makeFile({ subtype: 'agents_md', rawContent: 'test security naming convention' }),
      makeFile({ subtype: 'claude_md', type: 'generic_instruction', path: 'CLAUDE.md' }),
      makeFile({ type: 'rule', subtype: 'cursor_mdc', path: 'r.mdc' }),
      makeFile({ type: 'skill', subtype: 'claude_skill', path: 's/SKILL.md' }),
      makeFile({ type: 'mcp_config', subtype: 'mcp_json', path: '.mcp.json' }),
    ];
    const result = calculateScore(files);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('generates warning for missing AGENTS.md', () => {
    const score = calculateScore([]);
    const warnings = generateWarnings([], score);
    expect(warnings.some((w) => w.category === 'missing_agents_md')).toBe(true);
  });

  it('generates warning for missing security guidance', () => {
    const files = [makeFile({ rawContent: 'just some content' })];
    const score = calculateScore(files);
    const warnings = generateWarnings(files, score);
    expect(warnings.some((w) => w.category === 'missing_security_guidance')).toBe(true);
  });
});
