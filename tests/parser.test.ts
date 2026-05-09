import path from 'path';
import { parseMarkdownFile, parseMdcFile, parseSkillFolder, parseMcpConfig } from '../src/core/parser';

const SAMPLE = path.resolve(__dirname, '../examples/sample-agent-repo');

describe('parser', () => {
  describe('parseMarkdownFile', () => {
    it('extracts title from AGENTS.md', async () => {
      const file = await parseMarkdownFile(
        path.join(SAMPLE, 'AGENTS.md'),
        'generic_instruction',
        'agents_md',
        SAMPLE
      );
      expect(file.title).toBe('AGENTS.md');
      expect(file.rawContent).toContain('Project Instructions');
      expect(file.contentPreview.length).toBeLessThanOrEqual(300);
      expect(file.renderedContent).toContain('<h');
    });

    it('sets relative path', async () => {
      const file = await parseMarkdownFile(
        path.join(SAMPLE, 'CLAUDE.md'),
        'generic_instruction',
        'claude_md',
        SAMPLE
      );
      expect(file.path).toBe('CLAUDE.md');
    });
  });

  describe('parseMdcFile', () => {
    it('extracts frontmatter metadata', async () => {
      const file = await parseMdcFile(
        path.join(SAMPLE, '.cursor/rules/sample-rule.mdc'),
        SAMPLE
      );
      expect(file.type).toBe('rule');
      expect(file.subtype).toBe('cursor_mdc');
      expect(file.metadata.description).toBe('Example TypeScript project rule');
      expect(file.metadata.alwaysApply).toBe(false);
      const globs = file.metadata.globs as string[];
      expect(globs).toContain('**/*.ts');
    });

    it('parses body content', async () => {
      const file = await parseMdcFile(
        path.join(SAMPLE, '.cursor/rules/sample-rule.mdc'),
        SAMPLE
      );
      expect(file.rawContent).toContain('TypeScript');
      expect(file.contentPreview).toBeTruthy();
    });
  });

  describe('parseSkillFolder', () => {
    it('extracts skill metadata', async () => {
      const file = await parseSkillFolder(
        path.join(SAMPLE, '.claude/skills/sample-skill/SKILL.md'),
        SAMPLE
      );
      expect(file.type).toBe('skill');
      expect(file.subtype).toBe('claude_skill');
      expect(file.title).toBe('Sample Review Skill');
      expect(file.metadata.folder).toBe('.claude/skills/sample-skill');
    });

    it('lists related files', async () => {
      const file = await parseSkillFolder(
        path.join(SAMPLE, '.claude/skills/sample-skill/SKILL.md'),
        SAMPLE
      );
      const related = file.metadata.relatedFiles as string[];
      expect(related).toContain('checklist.md');
    });
  });

  describe('parseMcpConfig', () => {
    it('parses server names from mcpServers', async () => {
      const file = await parseMcpConfig(
        path.join(SAMPLE, '.mcp.json'),
        SAMPLE
      );
      expect(file.type).toBe('mcp_config');
      const servers = file.metadata.servers as string[];
      expect(servers).toContain('filesystem');
      expect(servers).toContain('github');
    });

    it('uses filename as title', async () => {
      const file = await parseMcpConfig(
        path.join(SAMPLE, '.mcp.json'),
        SAMPLE
      );
      expect(file.title).toBe('.mcp.json');
    });
  });
});
