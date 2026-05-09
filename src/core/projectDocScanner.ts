import fg from 'fast-glob';
import path from 'path';
import { statFile } from '../utils/file';
import { parseProjectDoc } from './parser';
import type { AgentFile, ProjectDocsInfo, Warning } from './types';

export const DEFAULT_MAX_DOCS = 100;
export const DEFAULT_MAX_FILE_SIZE = 1024 * 1024;

const DOC_PATTERNS = [
  'README.md',
  'README.*.md',
  'docs/**/*.md',
  'docs/**/*.mdx',
  'guides/**/*.md',
  'guides/**/*.mdx',
  'examples/**/*.md',
  'examples/**/*.mdx',
  '.ai/**/*.md',
  '.github/**/*.md',
  '**/*.md',
  '**/*.mdx',
];

const DOC_IGNORE = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  'coverage/**',
  'vendor/**',
  '.next/**',
  'out/**',
  'target/**',
  'tmp/**',
  'temp/**',
];

export interface ProjectDocScanResult {
  docs: AgentFile[];
  info: ProjectDocsInfo;
  warnings: Warning[];
}

export async function scanProjectDocs(
  repoRoot: string,
  excludePaths: Set<string>,
  options: { maxDocs?: number; maxFileSize?: number } = {}
): Promise<ProjectDocScanResult> {
  const maxDocs = options.maxDocs ?? DEFAULT_MAX_DOCS;
  const maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  const abs = path.resolve(repoRoot);

  const matches = await fg(DOC_PATTERNS, {
    cwd: abs,
    dot: true,
    absolute: true,
    ignore: DOC_IGNORE,
    unique: true,
    onlyFiles: true,
  });

  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const m of matches) {
    if (seen.has(m)) continue;
    seen.add(m);
    const rel = path.relative(abs, m).replace(/\\/g, '/');
    if (excludePaths.has(rel)) continue;
    candidates.push(m);
  }

  candidates.sort((a, b) => {
    const ra = path.relative(abs, a);
    const rb = path.relative(abs, b);
    return ra.localeCompare(rb);
  });

  const total = candidates.length;
  const docs: AgentFile[] = [];
  const warnings: Warning[] = [];
  let skippedSize = 0;
  let skippedCount = 0;
  let parseFailures = 0;

  for (let i = 0; i < candidates.length; i++) {
    if (docs.length >= maxDocs) {
      skippedCount = candidates.length - i;
      break;
    }
    const file = candidates[i];
    const stat = await statFile(file);
    if (!stat) continue;
    if (stat.size > maxFileSize) {
      skippedSize += 1;
      continue;
    }
    try {
      const doc = await parseProjectDoc(file, abs);
      docs.push(doc);
    } catch {
      parseFailures += 1;
    }
  }

  if (skippedCount > 0) {
    warnings.push({
      severity: 'low',
      category: 'project_docs_max_reached',
      message: `Project docs limit reached: ${skippedCount} additional Markdown file${skippedCount !== 1 ? 's were' : ' was'} skipped after the first ${maxDocs}. Use --max-docs to raise the limit.`,
    });
  }
  if (skippedSize > 0) {
    warnings.push({
      severity: 'low',
      category: 'project_docs_size_skipped',
      message: `${skippedSize} project doc${skippedSize !== 1 ? 's were' : ' was'} skipped because the file exceeded the max-file-size limit (${maxFileSize} bytes). Use --max-file-size to raise the limit.`,
    });
  }
  if (parseFailures > 0) {
    warnings.push({
      severity: 'low',
      category: 'project_docs_parse_failed',
      message: `${parseFailures} project doc${parseFailures !== 1 ? 's' : ''} could not be parsed and were skipped.`,
    });
  }

  const info: ProjectDocsInfo = {
    enabled: true,
    total,
    scanned: docs.length,
    skipped: skippedCount + skippedSize + parseFailures,
    maxDocs,
    maxFileSize,
  };

  return { docs, info, warnings };
}

export function topGroupForPath(docPath: string): string {
  const parts = docPath.split('/');
  if (parts.length === 1) return 'root';
  const top = parts[0];
  if (['docs', 'guides', 'examples', '.ai', '.github'].includes(top)) return top;
  return 'other';
}
