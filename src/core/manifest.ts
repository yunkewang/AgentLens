import type {
  AgentFile,
  Manifest,
  ProjectDocsInfo,
  RepoInfo,
  RepoSummary,
  Warning,
} from './types';
import { calculateScore, generateWarnings } from './scoring';
import { runSecurityScan } from './securityScanner';
import { applyAllowlist, type AgentLensConfig } from './config';

export interface BuildManifestOptions {
  extraWarnings?: Warning[];
  projectDocs?: AgentFile[];
  projectDocsInfo?: ProjectDocsInfo;
  config?: AgentLensConfig;
}

export function buildManifest(
  files: AgentFile[],
  repoSource: string,
  repoName: string,
  options: BuildManifestOptions = {}
): Manifest {
  const { extraWarnings = [], projectDocs, projectDocsInfo, config } = options;

  const scoreResult = calculateScore(files);
  const warnings = [...generateWarnings(files, scoreResult), ...extraWarnings];
  let security = runSecurityScan(files, projectDocs);

  // Apply allowlist filtering if config is present
  if (config?.allowlist) {
    const { findings: filtered, suppressed } = applyAllowlist(security.findings, config);
    if (suppressed > 0) {
      security = {
        ...security,
        findings: filtered,
        findingsCount: {
          high: filtered.filter((f) => f.severity === 'high').length,
          medium: filtered.filter((f) => f.severity === 'medium').length,
          low: filtered.filter((f) => f.severity === 'low').length,
          info: filtered.filter((f) => f.severity === 'info').length,
        },
        posture:
          filtered.some((f) => f.severity === 'high') ? 'needs_review' :
          filtered.some((f) => f.severity === 'medium') ? 'caution' :
          'clean',
      };
    }
  }

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

  const manifest: Manifest = { repo, summary, security, files, warnings };
  if (projectDocs) {
    manifest.projectDocs = projectDocs;
    manifest.projectDocsInfo = projectDocsInfo;
  }
  return manifest;
}
