import path from 'path';
import { scanRepo } from '../src/core/scanner';

const SAMPLE_REPO = path.resolve(__dirname, '../examples/sample-agent-repo');

describe('scanner', () => {
  it('discovers expected file types in sample repo', async () => {
    const files = await scanRepo(SAMPLE_REPO);
    const types = files.map((f) => f.type);
    expect(types).toContain('generic_instruction');
    expect(types).toContain('rule');
    expect(types).toContain('skill');
    expect(types).toContain('mcp_config');
  });

  it('finds AGENTS.md', async () => {
    const files = await scanRepo(SAMPLE_REPO);
    const agentsMd = files.find((f) => f.subtype === 'agents_md');
    expect(agentsMd).toBeDefined();
    expect(agentsMd?.title).toBe('AGENTS.md');
  });

  it('finds CLAUDE.md', async () => {
    const files = await scanRepo(SAMPLE_REPO);
    const claudeMd = files.find((f) => f.subtype === 'claude_md');
    expect(claudeMd).toBeDefined();
  });

  it('finds cursor mdc rule', async () => {
    const files = await scanRepo(SAMPLE_REPO);
    const rule = files.find((f) => f.subtype === 'cursor_mdc');
    expect(rule).toBeDefined();
    expect(rule?.path).toContain('sample-rule.mdc');
  });

  it('finds skill folder', async () => {
    const files = await scanRepo(SAMPLE_REPO);
    const skill = files.find((f) => f.type === 'skill');
    expect(skill).toBeDefined();
    expect(skill?.metadata?.relatedFiles).toContain('checklist.md');
  });

  it('finds mcp config', async () => {
    const files = await scanRepo(SAMPLE_REPO);
    const mcp = files.find((f) => f.type === 'mcp_config');
    expect(mcp).toBeDefined();
    const servers = mcp?.metadata?.servers as string[];
    expect(servers).toContain('filesystem');
    expect(servers).toContain('github');
  });

  it('deduplicates files', async () => {
    const files = await scanRepo(SAMPLE_REPO);
    const paths = files.map((f) => f.path);
    const unique = new Set(paths);
    expect(paths.length).toBe(unique.size);
  });
});
