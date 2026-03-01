import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted runs before vi.mock hoisting, so MockChatAnthropic is available in the factory
const { MockChatAnthropic } = vi.hoisted(() => {
  const MockChatAnthropic = vi.fn(() => ({ /* mock LLM */ }));
  return { MockChatAnthropic };
});

vi.mock("@langchain/anthropic", () => ({
  ChatAnthropic: MockChatAnthropic,
}));

// Mock other deps similarly to agent.stream.test.ts
vi.mock("langchain/agents", () => ({
  createToolCallingAgent: vi.fn(() => ({})),
  AgentExecutor: {
    fromAgentAndTools: vi.fn(() => ({
      invoke: vi.fn(),
      streamEvents: vi.fn(),
    })),
  },
}));

vi.mock("@langchain/core/prompts", () => ({
  ChatPromptTemplate: { fromMessages: vi.fn(() => ({})) },
  MessagesPlaceholder: vi.fn(() => ({})),
}));

vi.mock("@langchain/core/messages", () => ({
  HumanMessage: vi.fn((content: string) => ({ content, _getType: () => "human" })),
  AIMessage: vi.fn((content: string) => ({ content, _getType: () => "ai" })),
  SystemMessage: vi.fn((opts: unknown) => ({ ...(opts as object), _getType: () => "system" })),
}));

vi.mock("@langchain/core/callbacks/base", () => ({
  BaseCallbackHandler: class {
    name = "base";
  },
}));

vi.mock("../src/tools/get-patient-summary", () => ({ getPatientSummary: vi.fn(() => ({})) }));
vi.mock("../src/tools/get-medications", () => ({ getMedications: vi.fn(() => ({})) }));
vi.mock("../src/tools/drug-interaction-check", () => ({ drugInteractionCheck: vi.fn(() => ({})) }));
vi.mock("../src/tools/allergy-check", () => ({ allergyCheck: vi.fn(() => ({})) }));
vi.mock("../src/tools/lab-results", () => ({ getLabResults: vi.fn(() => ({})) }));
vi.mock("../src/tools/get-encounter-data", () => ({ getEncounterData: vi.fn(() => ({})) }));
vi.mock("../src/tools/reconcile-medications", () => ({ reconcileMedications: vi.fn(() => ({})) }));
vi.mock("../src/tools/draft-discharge-summary", () => ({ draftDischargeSummary: vi.fn(() => ({})) }));
vi.mock("../src/tools/generate-discharge-instructions", () => ({ generateDischargeInstructions: vi.fn(() => ({})) }));
vi.mock("../src/tools/save-to-chart", () => ({ saveToChart: vi.fn(() => ({})) }));
vi.mock("../src/config", () => ({
  getDataSource: vi.fn(() => ({})),
  getAnthropicApiKey: vi.fn(() => "test-key"),
}));
vi.mock("../src/data/cached-datasource", () => ({
  CachedDataSource: vi.fn((ds: unknown) => ds),
}));
vi.mock("../src/verification/verification", () => ({
  applyVerification: vi.fn((response: string, toolCalls: unknown[]) => ({
    response,
    safetyAlerts: [],
    toolCalls,
  })),
}));

// Import the module under test — mocks are hoisted above this
import * as agentModule from "../src/agent";

describe("LLM singleton", () => {
  beforeEach(() => {
    MockChatAnthropic.mockClear();
    // Reset the singleton between tests
    (agentModule as any).resetSharedLlm();
  });

  it("getSharedLlm returns a ChatAnthropic instance", () => {
    (agentModule as any).getSharedLlm();
    expect(MockChatAnthropic).toHaveBeenCalledOnce();
  });

  it("getSharedLlm returns the same instance on subsequent calls", () => {
    const llm1 = (agentModule as any).getSharedLlm();
    const llm2 = (agentModule as any).getSharedLlm();
    expect(llm1).toBe(llm2);
    expect(MockChatAnthropic).toHaveBeenCalledOnce(); // Only created once
  });

  it("resetSharedLlm clears the singleton", () => {
    const llm1 = (agentModule as any).getSharedLlm();
    (agentModule as any).resetSharedLlm();
    const llm2 = (agentModule as any).getSharedLlm();
    expect(llm1).not.toBe(llm2);
    expect(MockChatAnthropic).toHaveBeenCalledTimes(2);
  });
});

describe("dead code removal", () => {
  it("does not export getExecutor", () => {
    expect((agentModule as any).getExecutor).toBeUndefined();
  });

  it("does not export resetExecutor", () => {
    expect((agentModule as any).resetExecutor).toBeUndefined();
  });
});
