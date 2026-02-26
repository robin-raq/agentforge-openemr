import "dotenv/config";
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

export function getDataSource(): DataSource {
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

    return new FhirDataSource({
      fhirBaseUrl,
      apiBaseUrl,
      tokenUrl,
      clientId,
      clientSecret: process.env.FHIR_CLIENT_SECRET,
      username,
      password,
      scope: process.env.FHIR_SCOPE,
    });
  }
  return new MockDataSource();
}

function isPlaceholderKey(key: string): boolean {
  return key.includes("...");
}

export function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || isPlaceholderKey(key)) {
    throw new Error("ANTHROPIC_API_KEY is required — replace the placeholder in .env");
  }
  return key;
}

export const PORT = parseInt(process.env.PORT || "3000", 10);

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
  } catch {
    // @langfuse/langchain not installed or init failed
  }
  return [];
}

export function warnInsecureTls(): void {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    console.warn(
      "WARNING: NODE_TLS_REJECT_UNAUTHORIZED=0 — TLS certificate verification is disabled. Do not use in production."
    );
  }
}
