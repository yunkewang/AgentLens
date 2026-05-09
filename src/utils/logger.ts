const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';

export const logger = {
  info(msg: string): void {
    console.log(`${CYAN}${msg}${RESET}`);
  },
  success(msg: string): void {
    console.log(`${GREEN}${msg}${RESET}`);
  },
  warn(msg: string): void {
    console.log(`${YELLOW}${msg}${RESET}`);
  },
  error(msg: string): void {
    console.error(`${RED}${msg}${RESET}`);
  },
  dim(msg: string): void {
    console.log(`${DIM}${msg}${RESET}`);
  },
  bold(msg: string): void {
    console.log(`${BOLD}${msg}${RESET}`);
  },
  plain(msg: string): void {
    console.log(msg);
  },
};
