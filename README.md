# AgentLens

**See how AI agents see your repo.**

AgentLens is a local-first CLI and static report generator that discovers, parses, and visualizes agent instruction files such as AGENTS.md, CLAUDE.md, GEMINI.md, AI coding rules, skill folders, and MCP configs.

No backend. No account. No source upload.

---

## Install

```bash
npm install -g agentlens
```

Or run without installing:

```bash
npx agentlens scan ./my-repo
```

Or build from source:

```bash
git clone https://github.com/yunkewang/agentlens
cd agentlens
npm install
npm run build
node dist/cli.js scan ./examples/sample-agent-repo
```

---

## Usage

### Scan a local repo

```bash
agentlens scan ./my-repo
```

Discovers agent files, scores agent readiness, and writes `.agentlens/manifest.json`.

### Scan a public GitHub repo

```bash
agentlens scan https://github.com/user/repo
```

Clones the repo to a temp directory, scans it, then cleans up.

### Build a report

```bash
agentlens build ./my-repo
agentlens build https://github.com/user/repo
```

Generates `.agentlens/manifest.json` and `.agentlens/report.html`.

### Serve the report locally

```bash
agentlens serve ./my-repo
```

Builds the report and opens it in your browser at `http://localhost:4321`.

### Options

| Flag | Description |
|------|-------------|
| `-o, --out <path>` | Custom output directory |
| `-p, --port <number>` | Port for serve command (default: 4321) |
| `-v, --verbose` | Verbose output |

---

## Supported Files

| File | Type |
|------|------|
| `AGENTS.md` | Generic instruction |
| `CLAUDE.md` | Generic instruction |
| `GEMINI.md` | Generic instruction |
| `.github/copilot-instructions.md` | Generic instruction |
| `.cursor/rules/*.mdc` | AI coding rule (with YAML frontmatter) |
| `.cursorrules` | AI coding rule |
| `.claude/skills/*/SKILL.md` | Claude skill folder |
| `.mcp.json`, `mcp.json`, `.cursor/mcp.json` | MCP server config |
| `.claude/commands/*.md` | Claude command |
| `prompts/**/*.md` | Prompt file |
| `rules/**/*.md` | Rule file |

---

## Example Terminal Output

```
AgentLens scan complete.

Repo: ./customer-project
Agent Readiness Score: 78 / 100

Found:
  - 2 instruction file(s) (AGENTS.md, CLAUDE.md, etc.)
  - 1 rule file(s)
  - 1 skill folder(s)
  - 1 MCP config(s)

Warnings:
  - No security boundary guidance found in agent instruction files.

Manifest: .agentlens/manifest.json
```

---

## Report Output

After `build`, the following files are generated:

```
.agentlens/
  manifest.json   — Machine-readable scan results
  report.html     — Self-contained static HTML report
```

The HTML report includes:
- Agent Readiness Score with explanation
- Warnings grouped by severity
- All discovered instruction files with rendered Markdown
- Rule files with frontmatter metadata (globs, alwaysApply)
- Skill folders with related file listings
- MCP configs with server names and risk notes

---

## Agent Readiness Score

| Factor | Points |
|--------|--------|
| AGENTS.md found | +20 |
| Project-wide instruction file (CLAUDE.md, etc.) | +15 |
| Rule files found | +15 |
| Skill or command files found | +15 |
| MCP config found and parseable | +10 |
| Test/validation guidance in instructions | +10 |
| Security guidance in instructions | +10 |
| Style/convention guidance | +5 |

Maximum: 100 points.

---

## Privacy

AgentLens is **local-first**:

- No data is uploaded anywhere.
- No API keys required.
- No login required.
- Public GitHub repos are cloned locally to a temporary directory and deleted after scanning.
- The generated `report.html` is a self-contained static file you can share selectively.

Your instruction files may contain sensitive information (internal tool names, IP addresses, workflow details). Review the risk warnings in the report before sharing it externally.

---

## MVP Limitations

- Public GitHub repos only (no private repo support without manual clone)
- No AI-generated recommendations
- No continuous monitoring
- No PR comments or CI integration
- No PDF export
- Risk scanner uses pattern matching only (no semantic analysis)
- No plugin system

---

## Roadmap

- Private GitHub repo support (via personal access token)
- GitHub Actions integration
- VS Code extension
- More file format support (`.windsurfrules`, `system_prompt.txt`, etc.)
- Diff mode: compare agent readiness across branches
- Team dashboard (optional hosted tier)

---

## License

MIT
