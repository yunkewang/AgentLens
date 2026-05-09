import path from 'path';
import express from 'express';
import { createServer } from 'net';
import { runBuild } from './build';
import { logger } from '../utils/logger';
import type { ServeOptions } from '../core/types';

async function findAvailablePort(start: number): Promise<number> {
  for (let port = start; port < start + 20; port++) {
    const available = await isPortFree(port);
    if (available) return port;
  }
  throw new Error(`No available port found starting from ${start}`);
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on('error', () => resolve(false));
  });
}

export async function runServe(input: string, options: ServeOptions): Promise<void> {
  const { outputDir } = await runBuild(input, options);

  const preferredPort = options.port ?? 4321;
  const port = await findAvailablePort(preferredPort);

  const app = express();
  app.use(express.static(outputDir));
  app.get('/', (_req, res) => {
    res.sendFile(path.join(outputDir, 'report.html'));
  });

  app.listen(port, async () => {
    const url = `http://localhost:${port}`;
    logger.success(`AgentLens report served at ${url}`);
    logger.dim('Press Ctrl+C to stop.');

    // Dynamically import `open` (ESM-only package)
    try {
      const { default: open } = await import('open');
      await open(url);
    } catch {
      logger.dim(`Open ${url} in your browser.`);
    }
  });
}
