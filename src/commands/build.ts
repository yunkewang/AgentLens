import path from 'path';
import { rm } from 'fs/promises';
import { runScan, printScanSummary } from './scan';
import { generateHtmlReport } from '../render/htmlRenderer';
import type { BuildOptions, Manifest } from '../core/types';

export async function runBuild(
  input: string,
  options: BuildOptions
): Promise<{ manifest: Manifest; reportPath: string; outputDir: string }> {
  const { manifest, outputDir, tempDir } = await runScan(input, { ...options, silent: true });

  const reportPath = path.join(outputDir, 'report.html');
  const manifestPath = path.join(outputDir, 'manifest.json');

  await generateHtmlReport(manifest, reportPath);

  if (options.json) {
    process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
  } else {
    printScanSummary(manifest, manifestPath, { mode: 'build', reportPath });
  }

  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }

  return { manifest, reportPath, outputDir };
}
