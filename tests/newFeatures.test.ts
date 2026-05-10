import { runSecurityScan } from '../src/core/securityScanner';
import { applyAllowlist, loadConfig, type AgentLensConfig } from '../src/core/config';
import { detectSubtype } from '../src/core/detectors';
import type { AgentFile, SecurityFinding } from '../src/core/types';
import path from 'path';
import { writeFile, mkdir, rm } from 'fs/promises';
import os from 'os';

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

// ---------------------------------------------------------------------------
// Windsurf rules detection
// ---------------------------------------------------------------------------

describe('detectors — windsurfrules', () => {
  it('detects .windsurfrules as rule/windsurfrules', () => {
    const result = detectSubtype('.windsurfrules');
    expect(result).toEqual({ type: 'rule', subtype: 'windsurfrules' });
  });

  it('detects .windsurf/rules/foo.md as rule/windsurf_md', () => {
    const result = detectSubtype('.windsurf/rules/foo.md');
    expect(result).toEqual({ type: 'rule', subtype: 'windsurf_md' });
  });

  it('detects nested .windsurf/rules/sub/bar.md as rule/windsurf_md', () => {
    const result = detectSubtype('.windsurf/rules/sub/bar.md');
    expect(result).toEqual({ type: 'rule', subtype: 'windsurf_md' });
  });
});

// ---------------------------------------------------------------------------
// Line numbers in findings
// ---------------------------------------------------------------------------

describe('securityScanner — line numbers', () => {
  it('includes lineNumber for secret findings', () => {
    const content = 'line 1\nline 2\napi_key: sk-abc123def456ghi789\nline 4';
    const file = makeFile({ rawContent: content });
    const result = runSecurityScan([file]);
    const secretFinding = result.findings.find(
      (f) => f.category === 'possible_secret' && f.lineNumber !== undefined
    );
    expect(secretFinding).toBeDefined();
    expect(secretFinding!.lineNumber).toBe(3);
  });

  it('includes lineNumber for dangerous_command findings', () => {
    const content = 'First line\nSecond line\nThird line\nrun: rm -rf / to clean\nFifth line';
    const file = makeFile({ rawContent: content });
    const result = runSecurityScan([file]);
    const cmdFinding = result.findings.find(
      (f) => f.category === 'dangerous_command' && f.lineNumber !== undefined
    );
    expect(cmdFinding).toBeDefined();
    expect(cmdFinding!.lineNumber).toBe(4);
  });

  it('includes lineNumber for weak_boundary findings', () => {
    const content = 'Introduction\n\nYou may read all files in the repo.';
    const file = makeFile({ rawContent: content });
    const result = runSecurityScan([file]);
    const f = result.findings.find((x) => x.category === 'weak_boundary');
    expect(f).toBeDefined();
    expect(f!.lineNumber).toBe(3);
  });

  it('includes lineNumber for private_environment findings', () => {
    const content = 'config:\n  host: 192.168.1.100\n  port: 5432';
    const file = makeFile({ rawContent: content });
    const result = runSecurityScan([file]);
    const f = result.findings.find((x) => x.category === 'private_environment');
    expect(f).toBeDefined();
    expect(f!.lineNumber).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Cross-file duplicate detection
// ---------------------------------------------------------------------------

describe('securityScanner — cross_file_duplicate', () => {
  it('detects same secret pattern in multiple files', () => {
    const file1 = makeFile({ path: 'AGENTS.md', rawContent: 'Use token: ghp_abcdefg123456789xyz' });
    const file2 = makeFile({ path: 'CLAUDE.md', subtype: 'claude_md', rawContent: 'Set ghp_another_token_here for auth' });
    const result = runSecurityScan([file1, file2]);
    const dup = result.findings.find((f) => f.category === 'cross_file_duplicate');
    expect(dup).toBeDefined();
    expect(dup!.title).toContain('2 files');
    expect(dup!.evidence).toContain('CLAUDE.md');
  });

  it('does not flag when pattern appears in only one file', () => {
    const file1 = makeFile({ path: 'AGENTS.md', rawContent: 'Use token: ghp_abcdefg123456789xyz' });
    const file2 = makeFile({ path: 'CLAUDE.md', subtype: 'claude_md', rawContent: 'No secrets here.' });
    const result = runSecurityScan([file1, file2]);
    const dup = result.findings.find((f) => f.category === 'cross_file_duplicate');
    expect(dup).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Allowlist filtering
// ---------------------------------------------------------------------------

describe('config — allowlist', () => {
  it('suppresses findings by category', () => {
    const findings: SecurityFinding[] = [
      { severity: 'medium', category: 'weak_boundary', title: 'test', message: 'test', path: 'AGENTS.md', evidence: 'read all files' },
      { severity: 'high', category: 'possible_secret', title: 'test', message: 'test', path: 'AGENTS.md', evidence: 'ghp_abc...xyz' },
    ];
    const config: AgentLensConfig = {
      allowlist: [{ category: 'weak_boundary' }],
    };
    const { findings: filtered, suppressed } = applyAllowlist(findings, config);
    expect(suppressed).toBe(1);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].category).toBe('possible_secret');
  });

  it('suppresses findings by path', () => {
    const findings: SecurityFinding[] = [
      { severity: 'medium', category: 'weak_boundary', title: 'test', message: 'test', path: 'AGENTS.md', evidence: 'test' },
      { severity: 'medium', category: 'weak_boundary', title: 'test', message: 'test', path: 'CLAUDE.md', evidence: 'test' },
    ];
    const config: AgentLensConfig = {
      allowlist: [{ path: 'AGENTS.md' }],
    };
    const { findings: filtered, suppressed } = applyAllowlist(findings, config);
    expect(suppressed).toBe(1);
    expect(filtered[0].path).toBe('CLAUDE.md');
  });

  it('suppresses findings by evidence pattern', () => {
    const findings: SecurityFinding[] = [
      { severity: 'medium', category: 'possible_secret', title: 'test', message: 'test', path: 'AGENTS.md', evidence: 'api_key: test_only' },
      { severity: 'high', category: 'possible_secret', title: 'test', message: 'test', path: 'AGENTS.md', evidence: 'ghp_real_token' },
    ];
    const config: AgentLensConfig = {
      allowlist: [{ pattern: 'test_only' }],
    };
    const { findings: filtered, suppressed } = applyAllowlist(findings, config);
    expect(suppressed).toBe(1);
    expect(filtered[0].evidence).toContain('ghp_real_token');
  });

  it('suppresses with combined category + path filter', () => {
    const findings: SecurityFinding[] = [
      { severity: 'medium', category: 'weak_boundary', title: 'test', message: 'test', path: 'AGENTS.md', evidence: 'test' },
      { severity: 'medium', category: 'weak_boundary', title: 'test', message: 'test', path: 'CLAUDE.md', evidence: 'test' },
      { severity: 'high', category: 'possible_secret', title: 'test', message: 'test', path: 'AGENTS.md', evidence: 'ghp_abc' },
    ];
    const config: AgentLensConfig = {
      allowlist: [{ category: 'weak_boundary', path: 'AGENTS.md' }],
    };
    const { findings: filtered, suppressed } = applyAllowlist(findings, config);
    expect(suppressed).toBe(1);
    expect(filtered).toHaveLength(2);
  });

  it('returns all findings when no allowlist is configured', () => {
    const findings: SecurityFinding[] = [
      { severity: 'medium', category: 'weak_boundary', title: 'test', message: 'test', path: 'AGENTS.md' },
    ];
    const config: AgentLensConfig = {};
    const { findings: filtered, suppressed } = applyAllowlist(findings, config);
    expect(suppressed).toBe(0);
    expect(filtered).toHaveLength(1);
  });

  it('supports glob patterns in path filter', () => {
    const findings: SecurityFinding[] = [
      { severity: 'medium', category: 'weak_boundary', title: 'test', message: 'test', path: '.cursor/rules/security.mdc', evidence: 'test' },
      { severity: 'medium', category: 'weak_boundary', title: 'test', message: 'test', path: 'AGENTS.md', evidence: 'test' },
    ];
    const config: AgentLensConfig = {
      allowlist: [{ path: '.cursor/rules/*.mdc' }],
    };
    const { findings: filtered, suppressed } = applyAllowlist(findings, config);
    expect(suppressed).toBe(1);
    expect(filtered[0].path).toBe('AGENTS.md');
  });
});

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

describe('config — loadConfig', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `agentlens-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('loads .agentlens.json when present', async () => {
    const config: AgentLensConfig = {
      allowlist: [{ category: 'weak_boundary', reason: 'intentional' }],
    };
    await writeFile(path.join(tmpDir, '.agentlens.json'), JSON.stringify(config));
    const loaded = await loadConfig(tmpDir);
    expect(loaded.allowlist).toHaveLength(1);
    expect(loaded.allowlist![0].category).toBe('weak_boundary');
  });

  it('returns empty config when no config file exists', async () => {
    const loaded = await loadConfig(tmpDir);
    expect(loaded).toEqual({});
  });

  it('falls back to agentlens.json', async () => {
    const config: AgentLensConfig = {
      allowlist: [{ category: 'possible_secret' }],
    };
    await writeFile(path.join(tmpDir, 'agentlens.json'), JSON.stringify(config));
    const loaded = await loadConfig(tmpDir);
    expect(loaded.allowlist).toHaveLength(1);
  });
});
