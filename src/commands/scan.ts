import path from 'path';
import os from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { scanRepo } from '../core/scanner';
import { applyRisks } from '../core/riskScanner';
import { buildManifest } from '../core/manifest';
import { writeJson } from '../utils/file';
import { logger } from '../utils/logger';
import { isGitHubUrl, repoNameFromPath, repoNameFromUrl, resolveOutputDir } from '../utils/paths';
import { cloneRepo } from '../utils/git';
import type { Manifest, ScanOptions } from '../core/types';

export async function runScan(
  input: string,
  options: ScanOptions
): Promise<{ manifest: Manifest; repoPath: string; outputDir: string; tempDir?: string }> {
  let repoPath: string;
  let repoSource: string;
  let repoName: string;
  let tempDir: string | undefined;

  if (isGitHubUrl(input)) {
    repoName = repoNameFromUrl(input);
    repoSource = input;
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'agentlens-'));
    await cloneRepo(input, tempDir);
    repoPath = tempDir;
  } else {
    repoPath = path.resolve(input);
    repoSource = input;
    repoName = repoNameFromPath(repoPath);
  }

  const outputDir = resolveOutputDir(repoPath, options.out);

  logger.info(`\nScanning ${repoSource} ...`);

  const rawFiles = await scanRepo(repoPath);
  const files = applyRisks(rawFiles);
  const manifest = buildManifest(files, repoSource, repoName);

  const manifestPath = path.join(outputDir, 'manifest.json');
  await writeJson(manifestPath, manifest);

  printScanSummary(manifest, manifestPath);

  return { manifest, repoPath, outputDir, tempDir };
}

function printScanSummary(manifest: Manifest, manifestPath: string): void {
  const { repo, summary, security, warnings } = manifest;

  logger.plain('');
  logger.bold('AgentLens scan complete.');
  logger.plain('');
  logger.plain(`Repo: ${repo.source}`);
  logger.plain(`Agent Readiness Score: ${summary.score} / 100`);
  logger.plain('');
  logger.plain('Found:');

  const { counts } = summary;
  if (counts.genericInstructions) logger.plain(`  - ${counts.genericInstructions} instruction file(s) (AGENTS.md, CLAUDE.md, etc.)`);
  if (counts.rules) logger.plain(`  - ${counts.rules} rule file(s)`);
  if (counts.skills) logger.plain(`  - ${counts.skills} skill folder(s)`);
  if (counts.mcpConfigs) logger.plain(`  - ${counts.mcpConfigs} MCP config(s)`);
  if (counts.prompts) logger.plain(`  - ${counts.prompts} prompt/command file(s)`);

  const total = counts.genericInstructions + counts.rules + counts.skills + counts.mcpConfigs + counts.prompts;
  if (total === 0) logger.warn('  No agent files found.');

  logger.plain('');
  logger.bold('Security Review:');
  const { findingsCount } = security;
  const totalFindings = findingsCount.high + findingsCount.medium + findingsCount.low + findingsCount.info;
  if (totalFindings === 0) {
    logger.plain('  No findings detected by current rule set.');
  } else {
    if (findingsCount.high) logger.warn(`  - High: ${findingsCount.high}`);
    if (findingsCount.medium) logger.plain(`  - Medium: ${findingsCount.medium}`);
    if (findingsCount.low) logger.plain(`  - Low: ${findingsCount.low}`);
    if (findingsCount.info) logger.dim(`  - Info: ${findingsCount.info}`);
  }

  if (warnings.length) {
    logger.plain('');
    logger.plain('Warnings:');
    for (const w of warnings) {
      logger.warn(`  - ${w.message}`);
    }
  }

  logger.plain('');
  logger.dim(`Manifest: ${manifestPath}`);
  logger.plain('');
}
