import "dotenv/config";
import { trace } from "@opentelemetry/api";
import type { DataSource } from "./data/datasource";
import { MockDataSource } from "./data/mock-datasource";
import { FhirDataSource } from "./data/fhir-datasource";

function deriveFhirUrls(baseUrl: string): {
  fhirBaseUrl: string;
  apiBaseUrl: string;
  tokenUrl: string;
} {
  const url = new URL(baseUrl);
  const origin = url.origin;
  const pathParts = url.pathname.replace(/\/$/, "").split("/");
  const fhirIndex = pathParts.indexOf("fhir");
  const basePath =
    fhirIndex >= 0 ? pathParts.slice(0, fhirIndex).join("/") : "/apis/default";
  const apiPath = basePath.replace(/\/fhir$/, "") + "/api";

  return {
    fhirBaseUrl: baseUrl.replace(/\/$/, ""),
    apiBaseUrl: `${origin}${apiPath}`,
    tokenUrl: `${origin}/oauth2/default/token`,
  };
}

let cachedDataSource: DataSource | null = null;

export function getDataSource(): DataSource {
  if (cachedDataSource) return cachedDataSource;
  const source = process.env.DATA_SOURCE || "mock";
  if (source === "fhir") {
    const baseUrl = process.env.FHIR_BASE_URL;
    const clientId = process.env.FHIR_CLIENT_ID;
    const username = process.env.FHIR_USERNAME;
    const password = process.env.FHIR_PASSWORD;

    if (!baseUrl || !clientId || !username || !password) {
      throw new Error(
        "FHIR datasource requires FHIR_BASE_URL, FHIR_CLIENT_ID, FHIR_USERNAME, FHIR_PASSWORD"
      );
    }

    const { fhirBaseUrl, apiBaseUrl, tokenUrl } = deriveFhirUrls(baseUrl);

    cachedDataSource = new FhirDataSource({
      fhirBaseUrl,
      apiBaseUrl,
      tokenUrl,
      clientId,
      clientSecret: process.env.FHIR_CLIENT_SECRET,
      username,
      password,
      scope: process.env.FHIR_SCOPE,
    });
    return cachedDataSource;
  }
  cachedDataSource = new MockDataSource();
  return cachedDataSource;
}

// SEC-006: Stronger placeholder detection for secrets
export function isPlaceholderKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    key.includes("...") ||
    lower.includes("changeme") ||
    lower.includes("placeholder") ||
    lower.includes("<your") ||
    lower.includes("your_") ||
    lower.includes("replace_me") ||
    lower === "xxx" ||
    lower === "xxxx" ||
    lower.includes("todo") ||
    lower.includes("insert_") ||
    lower.includes("sk-ant-placeholder")
  );
}

export function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || isPlaceholderKey(key)) {
    throw new Error("ANTHROPIC_API_KEY is required — replace the placeholder in .env");
  }
  return key;
}

// SEC-006: PORT bounds validation
const parsedPort = parseInt(process.env.PORT || "3000", 10);
export const PORT = Number.isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535 ? 3000 : parsedPort;

let langfuseInitialized = false;

export function initLangfuse(): boolean {
  if (langfuseInitialized) return true;

  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;

  if (!secretKey || !publicKey) return false;
  if (isPlaceholderKey(secretKey) || isPlaceholderKey(publicKey)) {
    console.warn("Langfuse keys contain placeholders — observability disabled. Add real keys to .env");
    return false;
  }

  try {
    const { NodeTracerProvider } = require("@opentelemetry/sdk-trace-node");
    const { LangfuseSpanProcessor } = require("@langfuse/otel");
    const { setLangfuseTracerProvider } = require("@langfuse/tracing");

    const provider = new NodeTracerProvider({
      spanProcessors: [new LangfuseSpanProcessor()],
    });
    setLangfuseTracerProvider(provider);
    langfuseInitialized = true;
    console.log("Langfuse OTel tracing initialized");
    return true;
  } catch (err) {
    console.warn("Failed to initialize Langfuse OTel:", err instanceof Error ? err.message : err);
    return false;
  }
}

export function getLangfuseCallbacks(sessionId?: string): unknown[] {
  if (!langfuseInitialized) return [];

  try {
    const { CallbackHandler } = require("@langfuse/langchain");
    return [
      new CallbackHandler({
        sessionId: sessionId || "default",
        tags: ["agentforge"],
      }),
    ];
  } catch (err) {
    console.warn("Langfuse callback handler init failed:", err instanceof Error ? err.message : err);
  }
  return [];
}

/**
 * Return the active OpenTelemetry trace id — the real provider trace id that
 * Langfuse exports — or null if there is no active recording span. This is the
 * honest replacement for the old cosmetic trace_id: we never fabricate one.
 * When tracing is disabled or no span is active, callers get null and should
 * correlate by session_id (the Langfuse correlation key) plus request_id.
 */
export function getActiveTraceId(): string | null {
  try {
    const id: string | undefined = trace.getActiveSpan()?.spanContext()?.traceId;
    // Invalid / non-recording spans report an all-zero trace id.
    if (!id || /^0+$/.test(id)) return null;
    return id;
  } catch {
    return null;
  }
}

export function warnInsecureTls(): void {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    console.warn(
      "WARNING: NODE_TLS_REJECT_UNAUTHORIZED=0 — TLS certificate verification is disabled. Do not use in production."
    );
  }
}
