import matter from 'gray-matter';
import { marked } from 'marked';
import path from 'path';
import { readFile, listDir, statFile } from '../utils/file';
import type { AgentFile, FileType, FileSubtype } from './types';

const PREVIEW_LENGTH = 300;

function extractTitle(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function extractPreview(content: string): string {
  // Strip markdown headings, links, code blocks for a text preview
  const stripped = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#+\s+.+$/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  return stripped.slice(0, PREVIEW_LENGTH);
}

async function renderMarkdown(content: string): Promise<string> {
  return marked(content) as string;
}

export async function parseMarkdownFile(
  filePath: string,
  type: FileType,
  subtype: FileSubtype,
  repoRoot: string
): Promise<AgentFile> {
  const raw = await readFile(filePath);
  const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
  const title = extractTitle(raw) ?? path.basename(filePath);
  const preview = extractPreview(raw);
  const rendered = await renderMarkdown(raw);

  return {
    type,
    subtype,
    path: relativePath,
    title,
    description: preview.slice(0, 120).replace(/\n/g, ' '),
    metadata: {},
    risks: [],
    contentPreview: preview,
    rawContent: raw,
    renderedContent: rendered,
  };
}

export async function parseMdcFile(
  filePath: string,
  repoRoot: string
): Promise<AgentFile> {
  const raw = await readFile(filePath);
  const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
  const parsed = matter(raw);

  const frontmatter = parsed.data as {
    description?: string;
    globs?: string | string[];
    alwaysApply?: boolean;
  };

  const bodyContent = parsed.content;
  const title = extractTitle(bodyContent) ?? path.basename(filePath, '.mdc');
  const preview = extractPreview(bodyContent);
  const rendered = await renderMarkdown(bodyContent);

  const globs = frontmatter.globs
    ? Array.isArray(frontmatter.globs)
      ? frontmatter.globs
      : [frontmatter.globs]
    : [];

  return {
    type: 'rule',
    subtype: 'cursor_mdc',
    path: relativePath,
    title,
    description: frontmatter.description ?? preview.slice(0, 120).replace(/\n/g, ' '),
    metadata: {
      description: frontmatter.description,
      globs,
      alwaysApply: frontmatter.alwaysApply ?? false,
    },
    risks: [],
    contentPreview: preview,
    rawContent: raw,
    renderedContent: rendered,
  };
}

export async function parseSkillFolder(
  skillMdPath: string,
  repoRoot: string
): Promise<AgentFile> {
  const raw = await readFile(skillMdPath);
  const folder = path.dirname(skillMdPath);
  const relativePath = path.relative(repoRoot, skillMdPath).replace(/\\/g, '/');
  const relativeFolder = path.relative(repoRoot, folder).replace(/\\/g, '/');
  const skillName = path.basename(folder);

  const title = extractTitle(raw) ?? skillName;
  const preview = extractPreview(raw);
  const rendered = await renderMarkdown(raw);

  const relatedFiles = await findRelatedSkillFiles(folder, skillMdPath, repoRoot);

  return {
    type: 'skill',
    subtype: 'claude_skill',
    path: relativePath,
    title,
    description: preview.slice(0, 120).replace(/\n/g, ' '),
    metadata: {
      folder: relativeFolder,
      relatedFiles,
    },
    risks: [],
    contentPreview: preview,
    rawContent: raw,
    renderedContent: rendered,
  };
}

async function findRelatedSkillFiles(
  folder: string,
  skillMdPath: string,
  repoRoot: string
): Promise<string[]> {
  const related: string[] = [];
  await collectFiles(folder, skillMdPath, folder, repoRoot, related);
  return related;
}

async function collectFiles(
  dir: string,
  excludePath: string,
  baseFolder: string,
  repoRoot: string,
  result: string[]
): Promise<void> {
  const entries = await listDir(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (full === excludePath) continue;
    const stat = await statFile(full);
    if (!stat) continue;
    if (stat.isDirectory()) {
      await collectFiles(full, excludePath, baseFolder, repoRoot, result);
    } else {
      result.push(path.relative(baseFolder, full).replace(/\\/g, '/'));
    }
  }
}

export async function parseMcpConfig(
  filePath: string,
  repoRoot: string
): Promise<AgentFile> {
  const raw = await readFile(filePath);
  const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
  let servers: string[] = [];
  let parseWarning = false;

  try {
    const parsed = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
    if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
      servers = Object.keys(parsed.mcpServers);
    }
  } catch {
    parseWarning = true;
  }

  const preview = raw.slice(0, PREVIEW_LENGTH);

  return {
    type: 'mcp_config',
    subtype: 'mcp_json',
    path: relativePath,
    title: path.basename(filePath),
    description: 'MCP server configuration',
    metadata: { servers },
    risks: parseWarning ? [{ severity: 'medium', category: 'parse_error', message: 'Failed to parse MCP JSON config' }] : [],
    contentPreview: preview,
    rawContent: raw,
    renderedContent: undefined,
  };
}
