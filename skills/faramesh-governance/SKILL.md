# Faramesh Governance — How to Respond to the User

Every tool call is intercepted by **Faramesh** before it runs. You will receive a structured message for every blocked or pending outcome. Use it to give clear, accurate replies.

---

## What you will (and won't) see

| Outcome | What you see |
|---|---|
| **Allowed** | Nothing — the tool runs normally. No Faramesh message. |
| **Denied by policy** | `[Faramesh DENY]` message |
| **Denied by human** | `[Faramesh DENY]` message |
| **Pending approval** | `[Faramesh PENDING]` message |
| **Approval timed out** | `[Faramesh PENDING TIMEOUT]` message |
| **Service unreachable** | `[Faramesh ERROR]` message |

---

## How to respond for each outcome

### Tool runs normally (Allowed)

The tool ran — no Faramesh message appears. You do not need to mention governance unless the user asks.

---

### `[Faramesh DENY]` — Blocked

Two sub-cases, both start with `[Faramesh DENY]`:

**Blocked by policy:**
```
[Faramesh DENY] Blocked by Faramesh policy. Reason: <reason>. Code: <code>. Category: <category>. Manage policy: <url>
```
- Tell the user the action is blocked by their governance policy.
- Quote the **Reason** from the message.
- Give the **Manage policy URL** so they can update the rule.
- Do **not** suggest equivalent commands that would hit the same policy.

Example reply: *"I can't do that — your Faramesh policy blocks this action. Reason: [reason from message]. You can update the rule at: [url from message]."*

**Blocked by human:**
```
[Faramesh DENY] Blocked by human: this action was denied in the Faramesh UI. Review at: <url>
```
- Tell the user a person explicitly denied this action in the Faramesh dashboard.
- Do not retry unless the user specifically asks you to submit it again.

Example reply: *"This action was denied by a human reviewer in the Faramesh dashboard. You can review the decision at: [url from message]."*

---

### `[Faramesh PENDING]` — Waiting for approval

```
[Faramesh PENDING] Waiting for approval. Action ID: <id>. Approve at <url>, then ask me to try again.
```
- Tell the user the action is **paused, waiting for someone to approve it**.
- Give the **Action ID** and **dashboard URL** from the message.
- Tell them: once they approve, they should **ask you to try again** and you will run it.

Example reply: *"This action needs approval before it can run. I've submitted it to Faramesh (Action ID: [id]). Please open [url], find the pending action, and approve or deny it. Once approved, ask me to try again."*

---

### `[Faramesh PENDING TIMEOUT]` — Approval window expired

```
[Faramesh PENDING TIMEOUT] Approval window expired. Action ID: <id>. You can still approve at <url> and ask me to try again.
```
- Tell the user the approval window expired, but the action **can still be approved**.
- Give the dashboard URL and Action ID from the message.
- Tell them: approve it in the dashboard, then ask you to retry.

Example reply: *"The approval window expired before anyone responded. You can still approve Action ID [id] at [url] — once you do, ask me to run this again."*

---

### `[Faramesh ERROR]` — Service unreachable

```
[Faramesh ERROR] Governance service unreachable (fail-closed). <details>
```
- Tell the user that Faramesh could not be reached and the action was **not run** (fail-closed by default).
- Suggest checking that the Faramesh server is running and the plugin is configured correctly (`base_url`, `api_key`).

Example reply: *"The Faramesh governance service is unreachable, so I didn't run that action. Please check that Faramesh is running and the plugin's base_url is correct."*

---

## Policy categories (for your reference)

Tool calls are grouped into categories: **Bash**, **File System**, **Browser**, **Network**, **Canvas**, **Other**. Each can be set to Allow, Ask (require approval), or Deny in the Faramesh dashboard. When the user asks what you can run, tell them it depends on their active Faramesh policy and point them to the Policy / Governance page in the dashboard.
