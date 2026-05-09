import type { AgentFile, ScoreResult, Warning } from './types';

const TEST_KEYWORDS = ['test', 'tests', 'testing', 'validate', 'validation', 'lint', 'build', 'typecheck'];
const SECURITY_KEYWORDS = ['security', 'secret', 'secrets', 'credential', 'credentials', 'privacy', 'sensitive data', 'token'];
const STYLE_KEYWORDS = ['style', 'naming', 'convention', 'conventions', 'project structure'];

function contentContains(files: AgentFile[], keywords: string[]): boolean {
  const instructionTypes = new Set(['generic_instruction', 'rule', 'prompt']);
  for (const file of files) {
    if (!instructionTypes.has(file.type)) continue;
    const lower = file.rawContent.toLowerCase();
    if (keywords.some((kw) => lower.includes(kw))) return true;
  }
  return false;
}

export function calculateScore(files: AgentFile[]): ScoreResult {
  let score = 0;
  const explanation: string[] = [];

  const hasAgentsMd = files.some((f) => f.subtype === 'agents_md');
  if (hasAgentsMd) {
    score += 20;
    explanation.push('Found AGENTS.md: +20');
  }

  const hasProjectInstruction = files.some(
    (f) => f.subtype === 'claude_md' || f.subtype === 'gemini_md' || f.subtype === 'copilot_instructions'
  );
  if (hasProjectInstruction) {
    score += 15;
    explanation.push('Found project-wide instruction files: +15');
  }

  const hasRules = files.some((f) => f.type === 'rule');
  if (hasRules) {
    score += 15;
    explanation.push('Found rule files: +15');
  }

  const hasSkillsOrCommands = files.some(
    (f) => f.type === 'skill' || f.subtype === 'command_md'
  );
  if (hasSkillsOrCommands) {
    score += 15;
    explanation.push('Found skill or command files: +15');
  }

  const hasMcp = files.some((f) => f.type === 'mcp_config');
  if (hasMcp) {
    score += 10;
    explanation.push('Found MCP config: +10');
  }

  const hasTestGuidance = contentContains(files, TEST_KEYWORDS);
  if (hasTestGuidance) {
    score += 10;
    explanation.push('Found validation/test guidance: +10');
  }

  const hasSecurityGuidance = contentContains(files, SECURITY_KEYWORDS);
  if (hasSecurityGuidance) {
    score += 10;
    explanation.push('Found security guidance: +10');
  }

  const hasStyleGuidance = contentContains(files, STYLE_KEYWORDS);
  if (hasStyleGuidance) {
    score += 5;
    explanation.push('Found style/convention guidance: +5');
  }

  return { score: Math.min(score, 100), explanation };
}

export function generateWarnings(files: AgentFile[], score: ScoreResult): Warning[] {
  const warnings: Warning[] = [];

  const hasAgentsMd = files.some((f) => f.subtype === 'agents_md');
  if (!hasAgentsMd) {
    warnings.push({
      severity: 'medium',
      category: 'missing_agents_md',
      message: 'No AGENTS.md found. Consider adding one for universal agent instructions.',
    });
  }

  const hasSecurityGuidance = score.explanation.some((e) => e.includes('security'));
  if (!hasSecurityGuidance) {
    warnings.push({
      severity: 'medium',
      category: 'missing_security_guidance',
      message: 'No security boundary guidance found in agent instruction files.',
    });
  }

  const hasTestGuidance = score.explanation.some((e) => e.includes('validation/test'));
  if (!hasTestGuidance) {
    warnings.push({
      severity: 'medium',
      category: 'missing_test_guidance',
      message: 'No validation or test command guidance found in agent instruction files.',
    });
  }

  const hasRules = files.some((f) => f.type === 'rule');
  if (!hasRules) {
    warnings.push({
      severity: 'low',
      category: 'missing_rules',
      message: 'No AI coding rule files found (.cursor/rules/*.mdc or similar).',
    });
  }

  const hasSkillsOrCommands = files.some(
    (f) => f.type === 'skill' || f.subtype === 'command_md'
  );
  if (!hasSkillsOrCommands) {
    warnings.push({
      severity: 'low',
      category: 'missing_skills_commands',
      message: 'No skill folders or command files found.',
    });
  }

  return warnings;
}
