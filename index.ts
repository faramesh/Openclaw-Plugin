import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import {
  getFarameshApiKey,
  getFarameshBaseUrlDefault,
  getHostnameId,
} from "./env.js";

const TOOL_CATEGORY_MAP: Record<string, string> = {
  bash: "bash",
  shell: "bash",
  exec: "bash",
  terminal: "bash",
  read: "filesystem",
  write: "filesystem",
  edit: "filesystem",
  list_dir: "filesystem",
  glob: "filesystem",
  grep: "filesystem",
  file_search: "filesystem",
  multi_edit: "filesystem",
  browser: "browser",
  browser_navigate: "browser",
  browser_click: "browser",
  browser_type: "browser",
  browser_snapshot: "browser",
  web_fetch: "network",
  web_search: "network",
  http: "network",
  curl: "network",
  canvas: "canvas",
  notebook: "canvas",
};

function resolveCategory(toolName: string): string {
  const normalized = toolName.toLowerCase().replace(/[-\s]/g, "_");
  if (TOOL_CATEGORY_MAP[normalized]) return TOOL_CATEGORY_MAP[normalized];
  for (const [key, cat] of Object.entries(TOOL_CATEGORY_MAP)) {
    if (normalized.startsWith(key) || normalized.includes(key)) return cat;
  }
  return "other";
}

interface FarameshConfig {
  base_url?: string;
  timeout_ms?: number;
  fail_closed?: boolean;
  agent_id_override?: string;
  api_key?: string;
  /** When > 0, after creating a pending-approval action we poll Faramesh until approved/denied or this many ms. Set to 0 (default) to block immediately and tell the user to approve in the dashboard, then retry. */
  wait_for_approval_ms?: number;
  /** Dashboard URL for "manage policy" / "approve here" links. Default: base_url with port 3000 (Vue app). */
  dashboard_url?: string;
}

interface FarameshCheckResponse {
  id?: string;
  action_id?: string;
  status?: string;
  decision?: string;
  reason?: string;
  reason_code?: string;
  risk_level?: string;
  outcome?: string;
  approval_token?: string;
  category?: string;
}

interface CheckOnlyResponse {
  decision?: string;
  status?: string;
  reason?: string;
  reason_code?: string;
  category?: string;
}

/** Blocked by Faramesh policy (immediate deny). */
function formatPolicyDeny(reason: string, reasonCode: string, category: string, dashboardUrl: string): string {
  return `Blocked by Faramesh policy. Reason: ${reason}. Code: ${reasonCode}. Category: ${category}. Manage policy: ${dashboardUrl}`;
}

/** Waiting approval from Faramesh UI — short message for the agent to show the user. */
function formatPending(actionId: string | undefined, dashboardUrl: string): string {
  const idPart = actionId ? ` Action ID: ${actionId}.` : "";
  return `Waiting approval from Faramesh UI.${idPart} Approve at ${dashboardUrl}, then ask me to try again.`;
}

/** Blocked by human (denied in Faramesh UI after pending). */
function formatHumanDenied(): string {
  return "Blocked by human: this action was denied in the Faramesh UI.";
}

function formatTimeout(actionId: string, dashboardUrl: string): string {
  return `Approval window expired. Action ID: ${actionId}. You can still approve at ${dashboardUrl} and ask me to try again.`;
}

function formatUnreachable(message: string): string {
  return `[Faramesh ERROR] Governance service unreachable (fail-closed). ${message}`;
}

const RETRY_BACKOFF_MS = 100;

async function fetchWithRetry(
  url: string,
  options: Omit<RequestInit, "signal">,
  timeoutMs: number,
  retries = 1,
): Promise<Response> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      const isRetryable = res.status >= 500 || res.status === 408;
      if (res.ok || attempt === retries || !isRetryable) return res;
      lastErr = new Error(`Faramesh returned ${res.status}`);
    } catch (e) {
      clearTimeout(timer);
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt === retries) throw lastErr;
    }
  }
  throw lastErr ?? new Error("fetchWithRetry failed");
}

async function checkOnly(
  baseUrl: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
  apiKey?: string,
): Promise<CheckOnlyResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const tenant = (payload?.context as Record<string, unknown>)?.tenant_id ?? "demo";
  headers["X-Tenant-ID"] = String(tenant);

  const res = await fetchWithRetry(
    `${baseUrl}/v1/actions/check`,
    { method: "POST", headers, body: JSON.stringify(payload) },
    timeoutMs,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Faramesh check returned ${res.status}: ${text}`);
  }
  return (await res.json()) as CheckOnlyResponse;
}

async function createAction(
  baseUrl: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
  apiKey?: string,
): Promise<FarameshCheckResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const tenant = (payload?.context as Record<string, unknown>)?.tenant_id ?? "demo";
  headers["X-Tenant-ID"] = String(tenant);

  const res = await fetchWithRetry(
    `${baseUrl}/v1/actions`,
    { method: "POST", headers, body: JSON.stringify(payload) },
    timeoutMs,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Faramesh returned ${res.status}: ${text}`);
  }
  return (await res.json()) as FarameshCheckResponse;
}

const POLL_INTERVAL_MS = 2000;

async function getActionStatus(
  baseUrl: string,
  actionId: string,
  timeoutMs: number,
  apiKey?: string,
  tenant = "demo",
): Promise<{ status?: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  headers["X-Tenant-ID"] = String(tenant);

  const res = await fetchWithRetry(
    `${baseUrl}/v1/actions/${encodeURIComponent(actionId)}`,
    { method: "GET", headers },
    timeoutMs,
  );
  if (!res.ok) return {};
  const data = (await res.json()) as { status?: string };
  return data;
}

async function waitForApproval(
  baseUrl: string,
  actionId: string,
  waitMs: number,
  apiKey?: string,
  tenant = "demo",
): Promise<"approved" | "denied" | "timeout"> {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const { status } = await getActionStatus(baseUrl, actionId, 10000, apiKey, tenant);
    const s = status?.toLowerCase();
    if (s === "approved" || s === "allowed") return "approved";
    if (s === "denied") return "denied";
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return "timeout";
}

const plugin = {
  id: "openclaw",
  name: "Faramesh Governance",
  description:
    "Intercepts every tool call and routes it through Faramesh for policy-based Allow/Ask/Deny governance, audit logging, and human approval workflows.",

  configSchema: {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      base_url: { type: "string" as const, default: "http://127.0.0.1:8000" },
      timeout_ms: { type: "number" as const, default: 5000 },
      fail_closed: { type: "boolean" as const, default: true },
      agent_id_override: { type: "string" as const },
      api_key: { type: "string" as const },
      wait_for_approval_ms: { type: "number" as const, default: 0 },
      dashboard_url: { type: "string" as const },
    },
  },

  register(api: OpenClawPluginApi) {
    const entries = (api as any).config?.plugins?.entries;
    const rawConfig =
      (api as { pluginConfig?: FarameshConfig }).pluginConfig
      // Preferred id (what `openclaw plugins install @faramesh/openclaw` uses)
      ?? entries?.openclaw?.config
      // Back-compat: allow legacy configs that used "faramesh" as the plugin id
      ?? entries?.faramesh?.config
      ?? (api as any).config
      ?? {};
    const cfg: FarameshConfig = typeof rawConfig === "object" && rawConfig !== null ? rawConfig : {};
    const baseUrl = (cfg.base_url ?? getFarameshBaseUrlDefault()).replace(/\/+$/, "");
    const timeoutMs = cfg.timeout_ms ?? 5000;
    const failClosed = cfg.fail_closed ?? true;
    const apiKey = cfg.api_key ?? getFarameshApiKey();
    const waitForApprovalMs = Math.max(0, cfg.wait_for_approval_ms ?? 0);
    const runtimeId = getHostnameId();
    const dashboardUrl =
      (cfg.dashboard_url?.trim() && cfg.dashboard_url.replace(/\/+$/, "")) ||
      baseUrl.replace(/:8000(\/?)$/, ":3000$1") ||
      baseUrl;

    api.on(
      "before_tool_call",
      async (
        event: { toolName: string; params: Record<string, unknown> },
        ctx: { agentId?: string; sessionKey?: string; toolName: string },
      ) => {
        const agentId = cfg.agent_id_override ?? ctx.agentId ?? "openclaw";
        const category = resolveCategory(event.toolName);

        const payload = {
          agent_id: agentId,
          tool: event.toolName,
          operation: "run",
          params: event.params,
          context: {
            session_key: ctx.sessionKey,
            source: "openclaw",
            category,
            runtime_id: runtimeId,
          },
        };

        try {
          // Always create an action so every tool call appears in the Faramesh dashboard (audit visibility).
          const result = await createAction(baseUrl, payload, timeoutMs, apiKey);
          const status = (result.status ?? result.decision ?? "").toLowerCase();
          const actionId = result.id ?? result.action_id;
          const tenant = (payload?.context as Record<string, unknown>)?.tenant_id as string | undefined ?? "demo";

          if (status === "allowed" || status === "allow") return undefined;

          if (status === "denied" || status === "deny") {
            const reason = result.reason ?? `Blocked by policy (${event.toolName})`;
            const code = result.reason_code ?? "faramesh-deny";
            const category = result.category ?? resolveCategory(event.toolName);
            const isHumanDenied = (code ?? "").toLowerCase() === "human_denied" || /human|denied by human/i.test(reason ?? "");
            return {
              block: true,
              blockReason: isHumanDenied ? formatHumanDenied() : formatPolicyDeny(reason, code, category, dashboardUrl),
            };
          }

          // pending_approval: block immediately so the agent can tell the user to approve in the dashboard (no silent polling).
          if (waitForApprovalMs > 0 && actionId) {
            const outcome = await waitForApproval(baseUrl, actionId, waitForApprovalMs, apiKey, tenant);
            if (outcome === "approved") return undefined;
            if (outcome === "denied") {
              return {
                block: true,
                blockReason: formatHumanDenied(),
              };
            }
            return {
              block: true,
              blockReason: formatTimeout(actionId, dashboardUrl),
            };
          }

          return {
            block: true,
            blockReason: formatPending(actionId, dashboardUrl),
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);

          if (failClosed) {
            return {
              block: true,
              blockReason: formatUnreachable(message),
            };
          }

          return undefined;
        }
      },
      { priority: 1000 },
    );
  },
};

export default plugin;
