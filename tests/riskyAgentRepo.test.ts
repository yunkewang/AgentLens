import path from 'path';
import { scanRepo } from '../src/core/scanner';
import { runSecurityScan } from '../src/core/securityScanner';

const RISKY_REPO = path.resolve(__dirname, 'fixtures/risky-agent-repo');

describe('risky-agent-repo fixture', () => {
  it('discovers all expected artifact subtypes', async () => {
    const files = await scanRepo(RISKY_REPO);
    const subtypes = files.map((f) => f.subtype);

    expect(subtypes).toContain('agents_md');
    expect(subtypes).toContain('claude_md');
    expect(subtypes).toContain('cursor_mdc');
    expect(subtypes).toContain('mcp_json');

    const skill = files.find((f) => f.type === 'skill');
    expect(skill).toBeDefined();
    expect(skill?.path).toContain('deploy');
  });

  it('produces the expected high-severity security findings', async () => {
    const files = await scanRepo(RISKY_REPO);
    const result = runSecurityScan(files);

    expect(result.posture).toBe('needs_review');
    expect(result.findingsCount.high).toBeGreaterThan(0);

    const categories = new Set(result.findings.map((f) => f.category));
    expect(categories.has('possible_secret')).toBe(true);
    expect(categories.has('dangerous_command')).toBe(true);
    expect(categories.has('weak_boundary')).toBe(true);
    expect(categories.has('instruction_override')).toBe(true);
    expect(categories.has('data_exfiltration')).toBe(true);
    expect(categories.has('private_environment')).toBe(true);
    expect(categories.has('mcp_exposure')).toBe(true);
  });

  it('flags broad filesystem and shell MCP servers as high severity', async () => {
    const files = await scanRepo(RISKY_REPO);
    const result = runSecurityScan(files);

    const broadFs = result.findings.find(
      (f) => f.category === 'mcp_exposure' && f.title.includes('Broad filesystem'),
    );
    expect(broadFs?.severity).toBe('high');

    const shell = result.findings.find(
      (f) => f.category === 'mcp_exposure' && f.title.toLowerCase().includes('shell'),
    );
    expect(shell?.severity).toBe('high');
  });
});
