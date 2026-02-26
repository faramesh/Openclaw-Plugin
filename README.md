# Faramesh plugin for OpenClaw

**npm package:** `@faramesh/openclaw` · **Plugin id:** `openclaw`

Governance for every tool call: **Allow**, **Ask** (human approval), or **Deny** — enforced at the code level before execution, immune to prompt injection.

## Install

```bash
openclaw plugins install @faramesh/openclaw
```

Then add `openclaw` to `plugins.allow` in your OpenClaw config.

No other config needed if Faramesh runs at `http://127.0.0.1:8000`. To point at a different server:

```yaml
plugins:
  allow:
    - openclaw
  entries:
    openclaw:
      config:
        base_url: "http://your-faramesh-server:8000"
        api_key: "your-api-key"   # optional
```

You can also set `FARAMESH_BASE_URL` and `FARAMESH_API_KEY` as environment variables instead.

## What it does

Before every tool call (bash, file, browser, network, etc.) the plugin submits the action to Faramesh (`POST /v1/actions`). Every call is recorded in the Faramesh dashboard. The outcome is one of:

| Outcome | What the agent sees |
|---|---|
| **Allow** | Nothing — the tool runs. |
| **Pending approval** | `[Faramesh PENDING]` — waits for a human to approve in the dashboard. |
| **Denied by policy** | `[Faramesh DENY]` — blocked by a policy rule. |
| **Denied by human** | `[Faramesh DENY]` — a human denied it in the dashboard. |
| **Service unreachable** | `[Faramesh ERROR]` — fail-closed, tool does not run. |

The included **skill** teaches the agent how to explain each outcome to the user and where to approve or change policy.

## Requirements

- OpenClaw (gateway or TUI)
- Faramesh server — [Horizon (managed)](https://faramesh.dev) or [self-hosted](https://faramesh.dev/docs/installing-faramesh)
