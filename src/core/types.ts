export type FileType =
  | 'generic_instruction'
  | 'rule'
  | 'skill'
  | 'mcp_config'
  | 'prompt';

export type FileSubtype =
  | 'agents_md'
  | 'claude_md'
  | 'gemini_md'
  | 'copilot_instructions'
  | 'cursor_mdc'
  | 'cursorrules'
  | 'claude_skill'
  | 'mcp_json'
  | 'prompt_md'
  | 'command_md'
  | 'rule_md'
  | 'unknown';

export type RiskSeverity = 'high' | 'medium' | 'low';

export interface Risk {
  severity: RiskSeverity;
  category: string;
  message: string;
  path?: string;
}

export interface AgentFile {
  type: FileType;
  subtype: FileSubtype;
  path: string;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  risks: Risk[];
  contentPreview: string;
  rawContent: string;
  renderedContent?: string;
}

export interface Warning {
  severity: RiskSeverity;
  category: string;
  message: string;
}

export interface ScoreResult {
  score: number;
  explanation: string[];
}

export interface RepoSummary {
  score: number;
  scoreExplanation: string[];
  counts: {
    genericInstructions: number;
    rules: number;
    skills: number;
    mcpConfigs: number;
    prompts: number;
  };
}

export interface RepoInfo {
  source: string;
  name: string;
  scannedAt: string;
}

export interface Manifest {
  repo: RepoInfo;
  summary: RepoSummary;
  files: AgentFile[];
  warnings: Warning[];
}

export interface ScanOptions {
  out?: string;
  verbose?: boolean;
}

export interface BuildOptions {
  out?: string;
  verbose?: boolean;
}

export interface ServeOptions {
  out?: string;
  port?: number;
  verbose?: boolean;
}
