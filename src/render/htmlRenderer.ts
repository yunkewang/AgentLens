import { renderReport } from './templates';
import { writeFile } from '../utils/file';
import type { Manifest } from '../core/types';

export async function generateHtmlReport(manifest: Manifest, outputPath: string): Promise<void> {
  const html = renderReport(manifest);
  await writeFile(outputPath, html);
}
