#!/usr/bin/env node
import { Command } from 'commander';
import { runScan } from './commands/scan';
import { runBuild } from './commands/build';
import { runServe } from './commands/serve';
import { logger } from './utils/logger';

const program = new Command();

program
  .name('agentlens')
  .description('See how AI agents see your repo.')
  .version('0.1.0');

program
  .command('scan <input>')
  .description('Scan a local repo or public GitHub URL and generate manifest.json')
  .option('-o, --out <path>', 'Output directory (default: <repo>/.agentlens)')
  .option('-v, --verbose', 'Verbose output')
  .action(async (input: string, opts: { out?: string; verbose?: boolean }) => {
    try {
      await runScan(input, opts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Error: ${msg}`);
      process.exit(1);
    }
  });

program
  .command('build <input>')
  .description('Scan and generate manifest.json + report.html')
  .option('-o, --out <path>', 'Output directory (default: <repo>/.agentlens)')
  .option('-v, --verbose', 'Verbose output')
  .action(async (input: string, opts: { out?: string; verbose?: boolean }) => {
    try {
      await runBuild(input, opts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Error: ${msg}`);
      process.exit(1);
    }
  });

program
  .command('serve <input>')
  .description('Build and serve the report locally in a browser')
  .option('-o, --out <path>', 'Output directory (default: <repo>/.agentlens)')
  .option('-p, --port <number>', 'Port number (default: 4321)', parseInt)
  .option('-v, --verbose', 'Verbose output')
  .action(async (input: string, opts: { out?: string; port?: number; verbose?: boolean }) => {
    try {
      await runServe(input, opts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Error: ${msg}`);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((err) => {
  logger.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
