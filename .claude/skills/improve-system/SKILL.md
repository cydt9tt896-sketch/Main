---
name: improve-system
description: Audit the current project and its Claude Code setup, find the highest-leverage improvements (correctness, tests, tooling, docs, CI, developer experience, Claude config), apply the safe ones, and report the rest as a prioritized list. Use when the user runs /improve-system or asks to "improve the system", "tighten up this repo", "what should we fix next", or wants a general health pass rather than a specific change.
argument-hint: "[area or path to focus on] [--report-only]"
---

# Improve system

A health pass over whatever "the system" is here: the repository, its tooling, and how
Claude Code works in it. Goal: leave it measurably better, with every change small,
verified, and explained.

## Arguments

- A focus (e.g. `tests`, `ci`, `docs`, `claude`, `src/api`) narrows the audit to that area.
- `--report-only` means change nothing; produce the prioritized list only.
- No arguments: audit everything, apply quick wins, report the rest.

## 1. Survey (read-only)

Build a picture before judging anything. Run these in parallel where possible:

- `git status`, `git log --oneline -20`, and the file tree (skip `node_modules`, `.git`, build output).
- Manifests and tooling: `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Makefile`,
  lockfiles, linters/formatters configs, `Dockerfile`, `.github/workflows/`.
- Docs: `README*`, `CONTRIBUTING*`, `docs/`.
- Claude setup: `CLAUDE.md`, `.claude/settings.json`, `.claude/skills/`, `.claude/agents/`, hooks.
- Run the project's own checks if they exist (tests, lint, typecheck, build) and record
  what passes, fails, or is missing. Note how long they take.

If the repository is empty or nearly so, say so plainly and switch to **bootstrap mode**:
ask what the project is meant to be, then propose a minimal skeleton (README, `.gitignore`,
CLAUDE.md, a test/lint command, a SessionStart hook for cloud sessions). Don't invent a stack.

## 2. Assess

Check each area and note concrete findings with file:line evidence. Skip areas that don't apply.

| Area | Look for |
|---|---|
| Correctness | Failing tests or build, obvious bugs, unhandled errors, TODO/FIXME hotspots |
| Tests | Missing test command, untested core modules, slow or flaky suites |
| Tooling | No formatter/linter, inconsistent configs, outdated or unpinned deps |
| CI | No CI, CI not running tests/lint, red default branch |
| Security | Committed secrets, `.env` not ignored, risky deps (`npm audit`/`pip-audit` if available) |
| Docs | README missing setup/run/test steps, stale instructions |
| Dev experience | No one-command setup, missing `.gitignore` entries, dead code, huge files |
| Claude setup | No or stale CLAUDE.md, missing test/lint commands in it, repeated permission prompts, no SessionStart hook for cloud sessions, repeated manual workflows that deserve a skill |

## 3. Prioritize

Score each finding by **impact** (what breaks or slows down without it) and **effort**.
Order: broken things first, then high-impact/low-effort, then the rest. Cap the list at
~10 items; drop trivia.

Classify each item:
- **Quick win** — local, low-risk, verifiable in this session (add `.gitignore` entries,
  fix a failing lint, write the CLAUDE.md, add a missing test script).
- **Needs a decision** — changes behavior, APIs, dependencies, or architecture.

## 4. Apply (skip with `--report-only`)

- Apply quick wins only. Keep each one minimal and in the style of the surrounding code.
- After each change, re-run the relevant check to prove it works. Revert anything that
  doesn't verify.
- Never: delete user data, rewrite git history, upgrade major dependency versions, disable
  or skip tests, or touch secrets. Those go in the report as "needs a decision".
- Don't commit or push unless the user asked; leave changes in the working tree.

## 5. Report

End with a short summary in chat:

1. **What I changed** — one line each, with file paths and the check that verified it.
2. **Recommended next** — remaining items, highest priority first, each with why it matters
   and rough effort.
3. **Couldn't check** — anything blocked (missing tools, no network, no tests to run).

Be specific and honest: if a check failed or was skipped, say so. Offer to tackle the top
recommended item next.
