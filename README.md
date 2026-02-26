# Faramesh plugin for OpenClaw

**npm package:** `@faramesh/openclaw` — Plugin id in OpenClaw config: **openclaw**.

Governance for every tool call: **Allow**, **Ask** (human approval), or **Deny** via the Faramesh policy engine. All interception happens in code (before execution), so it’s immune to prompt injection.

## One-line install

**From npm:**
```bash
openclaw plugins install @faramesh/openclaw
```

**From a local checkout (this repo on your machine):**
```bash
cd /Users/xquark_home/Faramesh-Nexus/openclaw-test
openclaw plugins install ./extensions/faramesh
# or link for development:
openclaw plugins install -l ./extensions/faramesh
```

**One-command script (install + next steps):**
```bash
./scripts/install-faramesh.sh
```

Add **openclaw** to `plugins.allow`. No other config needed if Faramesh runs at `http://127.0.0.1:8000`. Otherwise set `FARAMESH_BASE_URL` or `plugins.entries.openclaw.config.base_url` and optional `api_key`. (For legacy configs that already use `faramesh` as the plugin id, the plugin will still read `plugins.entries.faramesh` as a fallback.)

## What it does

- **Before every tool run** (bash, file, browser, etc.), the plugin sends the action to Faramesh (`POST /v1/actions`). Every call is registered in the Faramesh UI. Depending on policy you get:
  - **Allow** — tool runs (action still recorded).
  - **Pending** — "Waiting approval from Faramesh UI. Approve at &lt;url&gt;, then ask me to try again." User approves in dashboard, then retries.
  - **Blocked by Faramesh policy** — "Blocked by Faramesh policy. Reason: …"
  - **Blocked by human** — If a pending action was denied in the UI: "Blocked by human: this action was denied in the Faramesh UI."
- **Plugin = code-level** (like SecureClaw’s “Tier 1: Plugin”). No skill required for interception.
- **Skill** (optional): The plugin includes a small skill so the agent can explain “pending approval” / “denied” to the user. Improves UX only.

## Requirements

- OpenClaw (gateway or TUI).
- Faramesh server (Horizon or self-hosted) running; use `FARAMESH_DEMO=1` for local testing.

## Publishing to npm (maintainers)

1. Bump `version` in `package.json`.
2. Update CHANGELOG if present.
3. From this directory: `npm pack` (dry-run; check contents).
4. Log in to npm: `npm login` (ensure access to `@faramesh` scope).
5. Publish: `npm publish --access public` (use OTP if 2FA enabled).
6. Verify: `npm view @faramesh/openclaw version`.

See [E2E_FARAMESH_TEST_GUIDE.md](../../E2E_FARAMESH_TEST_GUIDE.md) for full setup and testing.
