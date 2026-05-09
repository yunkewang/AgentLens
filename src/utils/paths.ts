import path from 'path';

export function isGitHubUrl(input: string): boolean {
  return /^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/.test(input);
}

export function repoNameFromPath(repoPath: string): string {
  return path.basename(path.resolve(repoPath));
}

export function repoNameFromUrl(url: string): string {
  const match = url.match(/github\.com\/[^/]+\/([^/]+?)(?:\.git)?(?:\/.*)?$/);
  return match ? match[1] : 'repo';
}

export function resolveOutputDir(
  repoPath: string,
  out?: string,
  defaultDir = '.agentlens'
): string {
  if (out) return path.resolve(out);
  if (path.isAbsolute(defaultDir)) return defaultDir;
  return path.join(path.resolve(repoPath), defaultDir);
}
