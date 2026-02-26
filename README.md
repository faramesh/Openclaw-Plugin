# Faramesh plugin for OpenClaw

**npm package:** `@faramesh/openclaw` — Plugin id in OpenClaw config: **openclaw**.

Governance for every tool call: **Allow**, **Ask** (human approval), or **Deny** via the Faramesh policy engine. All interception happens in code (before execution), so it’s immune to prompt injection.

## One-line install

**From npm (recommended):**

```bash
openclaw plugins install @faramesh/openclaw
```

**From a local clone of this repo:**

```bash
git clone https://github.com/faramesh/Openclaw-Plugin.git
cd Openclaw-Plugin
openclaw plugins install .
# or link for development:
openclaw plugins install -l .
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

For full Faramesh server setup, see the [Faramesh documentation](https://faramesh.dev).
