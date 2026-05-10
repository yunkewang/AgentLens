# Running AgentLens in GitHub Actions

AgentLens is a local-first CLI, but it works well in CI. A common pattern is to run it on every pull request that touches your agent instruction layer and upload the generated report as a build artifact, so reviewers can download an interactive HTML report and quickly inspect what changed.

This is most useful for PRs that change any of:

- `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`
- `.cursor/**` (Cursor rules and MCP config)
- `.claude/**` (Claude commands and skills)
- `.mcp.json`, `mcp.json`, or other MCP configuration files
- `prompts/**` and `rules/**` directories

## Minimal example

Drop the following workflow into `.github/workflows/agentlens.yml` in your own repository:

```yaml
name: AgentLens

on:
  pull_request:
    paths:
      - "AGENTS.md"
      - "CLAUDE.md"
      - "GEMINI.md"
      - ".github/copilot-instructions.md"
      - ".cursor/**"
      - ".claude/**"
      - ".mcp.json"
      - "mcp.json"
      - "prompts/**"
      - "rules/**"

jobs:
  agentlens:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run AgentLens
        run: npx --yes agentlens build . --out ./agentlens-report

      - name: Upload AgentLens report
        uses: actions/upload-artifact@v4
        with:
          name: agentlens-report
          path: ./agentlens-report
```

After the workflow runs, the `agentlens-report` artifact contains a self-contained `report.html` and a machine-readable `manifest.json`. Reviewers can download it from the run page and open the HTML report locally — no backend, no account, no source upload.

## Notes

- AgentLens is not yet published to npm. Until it is, replace `npx --yes agentlens` with a local build step (`npm install && npm run build`) inside the same workflow, or pin to a specific tag once published.
- The report intentionally includes repository instruction content, internal paths, MCP server names, and any matched evidence. Treat it as sensitive — uploading as a workflow artifact is fine for private repositories, but review before sharing externally.
- AgentLens is deterministic and rule-based. It does not call out to any LLM and does not require any API keys or secrets in your workflow.
- The CLI exits with status 0 even when findings are present. If you want to fail the build on findings, parse `agentlens-report/manifest.json` in a follow-up step. AgentLens does not impose a policy on its own.

## Manifest snapshot for reviewers

If you also want a quick text summary in the PR checks log, you can echo the manifest counts:

```yaml
      - name: Print summary
        run: |
          node -e "const m=require('./agentlens-report/manifest.json'); \
            console.log('Posture:', m.security.posture); \
            console.log('Findings:', JSON.stringify(m.security.findingsCount));"
```

The exact manifest shape is documented inline in `manifest.json` — the security section includes `posture`, `findingsCount`, and a `findings` array.
