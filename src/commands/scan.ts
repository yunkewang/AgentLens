import path from 'path';
import os from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { scanRepo } from '../core/scanner';
import { applyRisks } from '../core/riskScanner';
import { buildManifest } from '../core/manifest';
import { scanProjectDocs } from '../core/projectDocScanner';
import { loadConfig } from '../core/config';
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

  const defaultOutputDir = path.resolve('output', repoName);
  const outputDir = resolveOutputDir(repoPath, options.out, defaultOutputDir);

  logger.info(`\nScanning ${repoSource} ...`);

  const config = await loadConfig(repoPath);

  const rawFiles = await scanRepo(repoPath);
  const files = applyRisks(rawFiles);

  let projectDocs: Awaited<ReturnType<typeof scanProjectDocs>> | undefined;
  if (options.includeDocs) {
    const excludePaths = new Set(files.map((f) => f.path));
    projectDocs = await scanProjectDocs(repoPath, excludePaths, {
      maxDocs: options.maxDocs,
      maxFileSize: options.maxFileSize,
    });
  }

  const manifest = buildManifest(files, repoSource, repoName, {
    extraWarnings: projectDocs?.warnings ?? [],
    projectDocs: projectDocs?.docs,
    projectDocsInfo: projectDocs?.info,
    config,
  });

  const manifestPath = path.join(outputDir, 'manifest.json');
  await writeJson(manifestPath, manifest);

  if (options.json) {
    process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
  } else if (!options.silent) {
    printScanSummary(manifest, manifestPath);
  }

  return { manifest, repoPath, outputDir, tempDir };
}

export function printScanSummary(
  manifest: Manifest,
  manifestPath: string,
  opts: { mode?: 'scan' | 'build'; reportPath?: string } = {}
): void {
  const { repo, summary, security, warnings } = manifest;
  const mode = opts.mode ?? 'scan';

  logger.plain('');
  logger.bold(`AgentLens ${mode} complete.`);
  logger.plain('');
  logger.plain(`Repo: ${repo.source}`);
  logger.plain(`Agent Readiness Score: ${summary.score} / 100`);
  logger.plain(`Security Posture: ${security.posture}`);
  logger.plain('');
  logger.plain('Found:');

  const { counts } = summary;
  logger.plain(`  - Generic Instructions: ${counts.genericInstructions}`);
  logger.plain(`  - Rules: ${counts.rules}`);
  logger.plain(`  - Skills: ${counts.skills}`);
  logger.plain(`  - MCP Configs: ${counts.mcpConfigs}`);
  logger.plain(`  - Prompts / Commands: ${counts.prompts}`);
  if (manifest.projectDocsInfo?.enabled) {
    logger.plain(`  - Project Docs: ${manifest.projectDocsInfo.scanned} (of ${manifest.projectDocsInfo.total} discovered)`);
  }

  logger.plain('');
  logger.plain('Security Review:');
  const { findingsCount } = security;
  logger.plain(`  - High: ${findingsCount.high}`);
  logger.plain(`  - Medium: ${findingsCount.medium}`);
  logger.plain(`  - Low: ${findingsCount.low}`);
  logger.plain(`  - Info: ${findingsCount.info}`);

  if (warnings.length) {
    logger.plain('');
    logger.plain('Warnings:');
    for (const w of warnings) {
      logger.warn(`  - ${w.message}`);
    }
  }

  logger.plain('');

  if (opts.reportPath) {
    logger.plain('Report:');
    logger.plain(`  ${opts.reportPath}`);
    logger.plain('');
  }

  logger.plain('Manifest:');
  logger.plain(`  ${manifestPath}`);
  logger.plain('');
}
