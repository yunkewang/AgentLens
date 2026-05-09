# AgentLens

**See how AI agents see your repo.**

AgentLens is a local-first CLI that scans your repository's agent instruction layer and generates an interactive, self-contained HTML report.

It discovers, parses, visualizes, and reviews files such as AGENTS.md, CLAUDE.md, GEMINI.md, AI coding rules, skill folders, command files, prompt files, and MCP configs.

No backend. No account. No source upload. The report works offline as a portable HTML artifact.

---

## Why HTML?

Agent instruction files are not meant to be reviewed linearly.

Markdown is good for writing instructions.
HTML is better for exploring, filtering, auditing, and acting on them.

AgentLens generates an interactive HTML artifact with:

- Agent Readiness scoring
- Security Review findings
- Instruction Map
- MCP exposure summary
- Searchable file details
- Collapsible raw content
- Copyable fix prompts
- Embedded machine-readable manifest data

The report remains local-first and portable:

- no backend
- no account
- no external JavaScript
- no external CSS
- no source upload

---

## What AgentLens Reviews

AgentLens reviews the agent instruction layer of a repository.

It looks for:

- project-wide instructions
- AI coding rules
- skill folders
- command files
- prompt files
- MCP configs
- security boundary guidance
- risky instruction patterns
- dangerous commands
- possible secret references
- broad MCP exposure

AgentLens does not perform general application SAST. It does not scan your app code for vulnerabilities. It focuses on the instructions and tool configs that AI coding agents may follow.

---

## Security Review

AgentLens includes a deterministic, local security review for agent instruction files.

It can flag:

- possible secrets or credential references
- dangerous shell commands
- weak agent boundaries
- prompt-injection-like override language
- external data movement instructions
- private environment details
- broad MCP filesystem access
- external MCP tool exposure
- missing security boundary guidance

> "Your code may be secure, but your agent instructions may not be."

The scanner is:

- **local-only** — no repo content is uploaded
- **deterministic and rule-based** — no LLM or semantic analysis
- **human-reviewed** — findings should be reviewed and triaged by a human

---

## Supported Files

### Project-wide Instructions

- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `.github/copilot-instructions.md`

### Rules

- `.cursor/rules/*.mdc`
- `.cursor/rules/**/*.mdc`
- `.cursorrules`
- `rules/**/*.md`

### Skills and Commands

- `.claude/skills/*/SKILL.md`
- `.claude/skills/**/SKILL.md`
- `.claude/commands/*.md`
- `.claude/commands/**/*.md`

### MCP Configs

- `.mcp.json`
- `mcp.json`
- `.cursor/mcp.json`

### Prompts

- `prompts/*.md`
- `prompts/**/*.md`

---

## Usage

### Install

```bash
npm install -g agentlens
```

Or run without installing:

```bash
npx agentlens build ./my-repo
```

Or build from source:

```bash
git clone https://github.com/yunkewang/agentlens
cd agentlens
npm install
npm run build
```

### Commands

```bash
# Scan a local repo and write manifest.json
agentlens scan ./my-repo

# Build the interactive HTML report
agentlens build ./my-repo

# Build and open in browser
agentlens serve ./my-repo

# Scan a public GitHub repo
agentlens build https://github.com/user/repo
```

Remote GitHub URL scanning supports public repos only.
Private repos can be scanned by cloning them locally first and running AgentLens against the local path.

### Options

| Flag | Description |
|------|-------------|
| `-o, --out <path>` | Custom output directory |
| `-p, --port <number>` | Port for serve command (default: 4321) |
| `-v, --verbose` | Verbose output |

---

## Output

AgentLens generates:

```
.agentlens/
  manifest.json
  report.html
```

- `manifest.json` is machine-readable scan results.
- `report.html` is a self-contained interactive report.
- `report.html` can be opened locally, shared as a file, or uploaded as a CI artifact.

---

## Example Report Sections

The HTML report includes:

| Section | Description |
|---------|-------------|
| **Overview** | Readiness score, security posture, file counts, top findings |
| **Security Review** | Filterable findings by severity and category, with fix prompt buttons |
| **Instruction Map** | Visual grouped map of all discovered instruction files |
| **Files** | Searchable file cards with rendered content and raw view |
| **Rules** | MDC rule files with glob patterns and metadata |
| **Skills** | Skill folders with SKILL.md and related files |
| **MCP** | MCP server configs with exposure findings highlighted |
| **Fix Prompts** | Copyable remediation prompts for each security finding |
| **Raw Manifest** | Pretty-printed embedded manifest JSON |

---

## Example Terminal Output

```
AgentLens build complete.

Repo: examples/sample-agent-repo
Agent Readiness Score: 85 / 100
Security Posture: caution

Found:
  - Generic Instructions: 2
  - Rules: 1
  - Skills: 1
  - MCP Configs: 1
  - Prompts / Commands: 0

Security Review:
  - High: 0
  - Medium: 1
  - Low: 1
  - Info: 0

Report:
  .agentlens/report.html

Manifest:
  .agentlens/manifest.json
```

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

## Local-First Privacy Model

AgentLens is designed for private and enterprise repositories.

- It reads files locally.
- It does not upload source code.
- It does not require an API key.
- It does not require a hosted backend.
- It does not use external JavaScript in generated reports.
- It can scan private repos after they are cloned locally.

> **Note:** Generated reports may contain sensitive repository instruction content, internal paths, internal URLs, MCP configuration details, or security findings. Review the report before sharing it externally.

---

## MVP Limitations

- Remote GitHub URL scanning supports public repos only. Private repos can be scanned after cloning locally.
- Security review is deterministic and rule-based; no LLM or semantic analysis yet.
- No continuous monitoring or scheduled scans.
- No PR comments yet; GitHub Actions support is planned.
- No PDF export; HTML report is the primary shareable output.
- No plugin system yet.

---

## Roadmap

- GitHub Actions integration for CI-based agent instruction review
- More agent instruction formats, including `.windsurfrules`, additional Copilot/Gemini/Codex patterns, and custom prompt files
- Diff mode to compare agent instruction changes across branches, commits, or PRs
- Configurable security rules and allowlists
- Optional authenticated remote GitHub scanning
- VS Code extension
- Optional hosted/team workflows for organizations

---

## Design Principles

- Local-first
- Vendor-neutral
- HTML-native reports
- Deterministic security checks
- Portable static output
- Human-readable and machine-readable output
- Useful before adding any AI recommendations

---

## Positioning

AgentLens is not tied to any single AI coding product.

It supports common instruction formats used across AI coding workflows, but the goal is broader:

**Map, inspect, and secure the instruction layer of AI-native repositories.**

---

## License

MIT
