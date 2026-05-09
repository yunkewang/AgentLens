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

type DocOpts = {
  includeDocs?: boolean;
  maxDocs?: number;
  maxFileSize?: number;
};

function parsePositiveInt(label: string) {
  return (value: string): number => {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`Invalid value for ${label}: ${value}`);
    }
    return n;
  };
}

program
  .command('scan <input>')
  .description('Scan a local repo or public GitHub URL and generate manifest.json')
  .option('-o, --out <path>', 'Output directory (default: <repo>/.agentlens)')
  .option('-v, --verbose', 'Verbose output')
  .option('--include-docs', 'Also include README and Markdown project documentation')
  .option('--max-docs <number>', 'Maximum number of project docs to include (default: 100)', parsePositiveInt('--max-docs'))
  .option('--max-file-size <bytes>', 'Skip project doc files larger than this many bytes (default: 1048576)', parsePositiveInt('--max-file-size'))
  .action(async (input: string, opts: { out?: string; verbose?: boolean } & DocOpts) => {
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
  .option('--include-docs', 'Also include README and Markdown project documentation')
  .option('--max-docs <number>', 'Maximum number of project docs to include (default: 100)', parsePositiveInt('--max-docs'))
  .option('--max-file-size <bytes>', 'Skip project doc files larger than this many bytes (default: 1048576)', parsePositiveInt('--max-file-size'))
  .action(async (input: string, opts: { out?: string; verbose?: boolean } & DocOpts) => {
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
  .option('--include-docs', 'Also include README and Markdown project documentation')
  .option('--max-docs <number>', 'Maximum number of project docs to include (default: 100)', parsePositiveInt('--max-docs'))
  .option('--max-file-size <bytes>', 'Skip project doc files larger than this many bytes (default: 1048576)', parsePositiveInt('--max-file-size'))
  .action(async (input: string, opts: { out?: string; port?: number; verbose?: boolean } & DocOpts) => {
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
