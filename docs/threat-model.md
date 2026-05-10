# AgentLens Threat Model

This document describes how AgentLens thinks about the security of the *agent instruction layer*: what assets it cares about, where the trust boundaries are, what risks AgentLens is designed to surface, and what AgentLens deliberately does not do.

It is a working document, not a formal STRIDE analysis. The audience is security-minded engineers reviewing or contributing to AgentLens, and teams trying to decide whether AgentLens is a useful part of their AI security posture.

---

## What the agent instruction layer is

When an AI coding agent operates in a repository, it does not only read your source code. It also reads (and is shaped by) a layer of instruction files that sit alongside the code:

- Project-wide instruction files: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`.
- Editor or IDE rules: `.cursor/rules/*.mdc`, `.cursorrules`, `rules/**/*.md`.
- Skill and command definitions: `.claude/skills/*/SKILL.md`, `.claude/commands/*.md`.
- Reusable prompts: `prompts/**/*.md`.
- Tool configuration: `.mcp.json`, `mcp.json`, `.cursor/mcp.json` and other MCP configs that grant tool access to the agent.

Together, these files configure the agent's persona, permissions, expectations, and external reach. They are committed to the same repository as the code, share the same review surface, and inherit the same trust the repository has — but they are rarely reviewed with security in mind.

We call this the **agent instruction layer**. AgentLens exists to make this layer visible and reviewable.

---

## Assets at risk

| Asset                          | Why it matters                                                                              |
|--------------------------------|---------------------------------------------------------------------------------------------|
| Source code                    | Read or modified by the agent; may be exfiltrated through agent-issued network calls.       |
| Secrets, tokens, credentials   | Often pasted into instruction files for "convenience"; can leak via agent context or logs.  |
| Build and runtime environment  | Agents that can invoke shell or filesystem MCPs can affect the host, not just the repo.     |
| Customer data and PII          | If instruction files mention real datasets or examples, the agent may treat them as fair game.|
| Internal network topology      | Internal hostnames, IP ranges, and SaaS tenants in instructions enable lateral movement.    |
| Reputation and supply chain    | A poisoned or careless instruction file can publish, deploy, or merge code on the agent's behalf. |

---

## Trust boundaries

AgentLens treats the following boundaries as the security model it cares about:

1. **Repository ↔ agent runtime.** Files in the repo become part of the agent's prompt and tool surface. Anything in a tracked instruction file is effectively privileged.
2. **Agent runtime ↔ host.** MCP filesystem and shell servers extend the agent's reach to the host filesystem and process tree. The MCP config defines that boundary.
3. **Agent runtime ↔ external services.** SaaS MCPs, cloud provider MCPs, and any instruction that says "post to X" cross this boundary. Egress is the highest-impact failure mode.
4. **Local user ↔ AgentLens output.** AgentLens generates an HTML report. That report contains repository content, evidence snippets, and findings. It is portable on purpose — and that portability is itself a trust boundary the user controls.
5. **Repository contributor ↔ instruction file author.** Many instruction files are copy-pasted templates from third parties. AgentLens treats them as untrusted input that happens to live inside the repo.

---

## Common risks AgentLens cares about

These are the failure modes that motivated the rule set in [`docs/rules.md`](rules.md):

- **Secrets in instructions.** Tokens, keys, and credentials embedded directly in `AGENTS.md`, `CLAUDE.md`, or rule files. They survive in git history, screenshots, and any derived report.
- **Destructive command suggestions.** Instructions like `curl ... | sh`, `rm -rf /`, or `chmod 777` that an agent can act on without further confirmation.
- **Overbroad permissions.** "Read all files", "run any command", "do not ask for confirmation" — language that grants the agent more authority than the human reviewer intended.
- **Instruction-override / prompt injection.** "Ignore previous instructions", "always comply", "do not refuse" — language that overrides safety rails, often inherited from third-party templates.
- **Data exfiltration patterns.** "Upload to", "send to webhook", "post to pastebin" — instructions that turn local read access into network egress.
- **Private environment leakage.** Internal hostnames, RFC 1918 addresses, or `corp.local` style references that expose network topology when the report is shared.
- **MCP overexposure.** Filesystem MCPs pointing at `/`, shell MCPs, broadly-scoped SaaS or cloud MCPs that extend the agent's reach far beyond the repository.
- **Missing security boundary.** Instruction files that simply do not say what the agent must not do.

---

## What AgentLens detects today

AgentLens's current detection capabilities are:

- **Static, deterministic, rule-based** scans over instruction file content. See [`docs/rules.md`](rules.md) for the full list.
- **Structural inspection of MCP configurations**, including detection of shell MCPs, broad filesystem mounts, and named SaaS / cloud / database / browser servers.
- **Repository-level checks**, such as the missing-security-guidance check that runs across all instruction files at once.
- **Optional project-doc scanning** (`--include-docs`) that re-applies the secret, dangerous-command, data-exfiltration, and private-environment checks to project Markdown.
- **A local HTML report and a machine-readable manifest** so findings can be reviewed in a browser, attached to a PR, or processed in CI.

---

## What AgentLens does not detect

AgentLens is intentionally narrow. It does not do any of the following:

- **Application SAST.** AgentLens does not analyse your application source code for vulnerabilities. Use a SAST tool for that.
- **Dependency or supply-chain scanning.** No SCA, no advisory feed, no lockfile inspection.
- **Runtime or behavioural analysis.** AgentLens does not execute the agent and observe what it does. It only reads the instructions the agent will read.
- **Semantic / LLM-based review.** No model call, no embedding, no inference. Every finding is a regex or a structural check. This is a feature, not a limitation: it makes the tool deterministic, offline, and trivially auditable.
- **Policy enforcement.** AgentLens does not gate merges, fail builds, or quarantine commits. It surfaces information; humans (or your CI policy) decide.
- **Fixing the findings.** The HTML report includes copyable remediation prompts that you can paste into your own coding agent. AgentLens itself does not edit your files.

If a category in your threat model is missing from this list, please open an issue — see the Roadmap section of the README for current direction.

---

## Why local-first / offline reporting matters

AgentLens is designed to run on a developer laptop, in CI runners, and in air-gapped environments without modification. Several properties follow directly from that:

- **No source upload.** Your repository content never leaves the machine running AgentLens. The HTML report is a local file.
- **No API keys, no accounts, no telemetry.** AgentLens does not phone home and does not require an Anthropic, OpenAI, or vendor key to run.
- **No external JavaScript or CSS in the report.** The generated HTML is self-contained, so opening it offline is safe and reproducible.
- **Auditable rules.** Every finding can be traced to a regex or structural check in `src/core/securityScanner.ts`. There is no opaque model deciding what is risky.
- **Predictable in CI.** Determinism means the same commit produces the same findings on every run, which is the property a security pipeline needs.
- **Sensitive findings stay where you put them.** A report uploaded as a workflow artifact in a private repo stays in that repo's ACL. A report kept on disk stays on disk. AgentLens does not create new exfiltration paths for the data it analyses.

The trade-off is that AgentLens cannot reason about intent. A line that looks dangerous in a regex may be perfectly fine in context, and a sophisticated injection that does not match any rule may slip through. Local-first checks are a floor, not a ceiling — AgentLens is meant to be one layer in a larger review process, not the whole thing.
