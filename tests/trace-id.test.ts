import { describe, it, expect, vi } from "vitest";
import * as otel from "@opentelemetry/api";
import { getActiveTraceId } from "../src/config";

// Covers both tracing paths for the honest trace_id (Phase 10):
//  - disabled / no active span    -> null (never a fabricated id)
//  - enabled with a recording span -> the real provider trace id

describe("getActiveTraceId", () => {
  it("returns null when no span is active (tracing disabled / no provider)", () => {
    expect(getActiveTraceId()).toBeNull();
  });

  it("returns the real trace id when a recording span is active", () => {
    const realTraceId = "a".repeat(32);
    const spy = vi.spyOn(otel.trace, "getActiveSpan").mockReturnValue({
      spanContext: () => ({ traceId: realTraceId, spanId: "b".repeat(16), traceFlags: 1 }),
    } as unknown as otel.Span);
    expect(getActiveTraceId()).toBe(realTraceId);
    spy.mockRestore();
  });

  it("returns null for a non-recording (all-zero) span — never a fake id", () => {
    const spy = vi.spyOn(otel.trace, "getActiveSpan").mockReturnValue({
      spanContext: () => ({ traceId: "0".repeat(32), spanId: "0".repeat(16), traceFlags: 0 }),
    } as unknown as otel.Span);
    expect(getActiveTraceId()).toBeNull();
    spy.mockRestore();
  });
});
