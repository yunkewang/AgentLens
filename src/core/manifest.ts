import type { AgentFile, Manifest, RepoInfo, RepoSummary, Warning } from './types';
import { calculateScore, generateWarnings } from './scoring';
import { runSecurityScan } from './securityScanner';

export function buildManifest(
  files: AgentFile[],
  repoSource: string,
  repoName: string,
  extraWarnings: Warning[] = []
): Manifest {
  const scoreResult = calculateScore(files);
  const warnings = [...generateWarnings(files, scoreResult), ...extraWarnings];
  const security = runSecurityScan(files);

  const counts = {
    genericInstructions: files.filter((f) => f.type === 'generic_instruction').length,
    rules: files.filter((f) => f.type === 'rule').length,
    skills: files.filter((f) => f.type === 'skill').length,
    mcpConfigs: files.filter((f) => f.type === 'mcp_config').length,
    prompts: files.filter((f) => f.type === 'prompt').length,
  };

  const repo: RepoInfo = {
    source: repoSource,
    name: repoName,
    scannedAt: new Date().toISOString(),
  };

  const summary: RepoSummary = {
    score: scoreResult.score,
    scoreExplanation: scoreResult.explanation,
    counts,
  };

  return { repo, summary, security, files, warnings };
}
