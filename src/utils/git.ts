import { simpleGit } from 'simple-git';
import { logger } from './logger';

export async function cloneRepo(url: string, targetDir: string): Promise<void> {
  logger.info(`Cloning ${url} ...`);
  const git = simpleGit();
  try {
    await git.clone(url, targetDir, ['--depth', '1']);
    logger.success(`Cloned to ${targetDir}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to clone ${url}: ${msg}`);
  }
}
