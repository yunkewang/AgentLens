import path from 'path';
import { rm } from 'fs/promises';
import { runScan } from './scan';
import { generateHtmlReport } from '../render/htmlRenderer';
import { logger } from '../utils/logger';
import type { BuildOptions, Manifest } from '../core/types';

export async function runBuild(
  input: string,
  options: BuildOptions
): Promise<{ manifest: Manifest; reportPath: string; outputDir: string }> {
  const { manifest, outputDir, tempDir } = await runScan(input, options);

  const reportPath = path.join(outputDir, 'report.html');
  await generateHtmlReport(manifest, reportPath);

  logger.success(`Report: ${reportPath}`);
  logger.plain('');

  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }

  return { manifest, reportPath, outputDir };
}
