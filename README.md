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

> AgentLens is not yet published to npm. For now, install it by cloning and building this repository locally (see below). Once published, you'll be able to install it globally with `npm install -g agentlens` or run it directly with `npx agentlens`.

### Local Development Usage

Clone and build AgentLens locally:

```bash
git clone https://github.com/yunkewang/agentlens
cd agentlens
npm install
npm run build
npm install -g .
```

This installs the `agentlens` command globally on your machine.

### Running AgentLens Against a Target Repo

You do **not** need to clone the target repository yourself. AgentLens accepts a public GitHub URL directly, clones the target repo internally into a temporary directory, scans it, and writes a self-contained HTML report to the `--out` directory.

**Scan a public GitHub repo (recommended):**

```bash
agentlens build https://github.com/affaan-m/everything-claude-code --out ./agentlens-report-claude-code
open ./agentlens-report-claude-code/report.html
```

This writes the interactive HTML report to `./agentlens-report-claude-code/report.html`.

**Scan a local repo:**

```bash
agentlens build ./my-repo --out ./agentlens-report
open ./agentlens-report/report.html
```

### Future npm Usage

Once AgentLens is published to npm, no local clone or build will be required:

```bash
# Install globally
npm install -g agentlens

# Or run without installing
npx agentlens build https://github.com/affaan-m/everything-claude-code --out ./agentlens-report-claude-code
```

### Commands

```bash
# Build a report for a public GitHub repo
agentlens build https://github.com/affaan-m/everything-claude-code --out ./agentlens-report-claude-code
open ./agentlens-report-claude-code/report.html

# Build a report for a local repo
agentlens build ./my-repo --out ./agentlens-report
open ./agentlens-report/report.html

# Scan only and write manifest.json
agentlens scan ./my-repo --out ./agentlens-scan

# Build and serve the report through a local web server
agentlens serve https://github.com/affaan-m/everything-claude-code --out ./agentlens-report-claude-code --port 4321
```

**`build`** generates `report.html` and `manifest.json` in the output folder.  
**`serve`** builds the report and opens it through a local web server.  
**`--port`** belongs to `serve`, not `build`.

Remote GitHub URL scanning supports public repos only. Private repos can be scanned by cloning locally first.

### Options

| Flag | Description |
|------|-------------|
| `-o, --out <path>` | Output directory |
| `-p, --port <number>` | Port for `serve` command (default: 4321) |
| `-v, --verbose` | Verbose output |
| `--include-docs` | Also include README and Markdown project documentation in the report |
| `--max-docs <number>` | Max project docs to include (default: 100). Requires `--include-docs`. |
| `--max-file-size <bytes>` | Skip project doc files larger than this many bytes (default: 1048576). Requires `--include-docs`. |

### Include Project Docs

By default, AgentLens focuses on the agent instruction layer. To also include README and Markdown documentation, use:

```bash
agentlens build https://github.com/affaan-m/everything-claude-code --out ./agentlens-report-claude-code --include-docs
open ./agentlens-report-claude-code/report.html
```

This is useful when you want the report to explain how the project works, not just its agent rules and skills.

When `--include-docs` is enabled, AgentLens also discovers `README.md`, `README.*.md`, and Markdown / MDX files under `docs/`, `guides/`, `examples/`, `.ai/`, `.github/`, and the rest of the repository (excluding `node_modules`, `.git`, `dist`, `build`, `coverage`, `vendor`, `.next`, `out`, `target`, `tmp`, and `temp`). Discovered files are listed in a new **Project Docs** tab and included in `manifest.json` as entries with `"type": "project_doc"`.

> **Note:** Large repositories may contain many Markdown files. AgentLens limits project docs by default and skips generated/build folders. Raise the limits with `--max-docs` and `--max-file-size` if you need to capture more.

The Instruction Map and the Agent Readiness Score remain focused on agent instruction files. Project docs are also passed through the security scanner — findings from project documentation are tagged with `source: "project_doc"` so reviewers can tell them apart from findings on agent instruction files. The "missing security guidance" check still only looks at agent instruction files.

### Troubleshooting

If `agentlens` is not found after `npm install -g .`, you can either re-run the install from the AgentLens repo root, or invoke the CLI directly from the build output:

```bash
node dist/cli.js build https://github.com/affaan-m/everything-claude-code --out ./agentlens-report-claude-code
open ./agentlens-report-claude-code/report.html
```

---

## Output

AgentLens writes:

```
<output-folder>/
  manifest.json
  report.html
```

- `report.html` is the interactive, self-contained HTML report.
- `manifest.json` is the machine-readable scan output.
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
| **Project Docs** *(when `--include-docs` is used)* | README and Markdown docs grouped by top-level folder, with heading outlines and rendered markdown |
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
