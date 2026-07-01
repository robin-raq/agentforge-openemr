import { describe, it, expect, afterEach } from "vitest";
import {
  getJudgeModel,
  assertRubricConfigured,
  checkQualityGate,
  type RubricResult,
} from "../eval/rubric-judge";

// These tests are hermetic — they never call the Anthropic API. They lock in
// the Phase 10 fixes: a valid judge model id, up-front key validation, and a
// quality gate that can never read a never-run judge as "passed".

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;
const ORIGINAL_MODEL = process.env.RUBRIC_JUDGE_MODEL;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
  if (ORIGINAL_MODEL === undefined) delete process.env.RUBRIC_JUDGE_MODEL;
  else process.env.RUBRIC_JUDGE_MODEL = ORIGINAL_MODEL;
});

describe("rubric judge configuration", () => {
  it("defaults to a valid Haiku 4.5 judge model", () => {
    delete process.env.RUBRIC_JUDGE_MODEL;
    expect(getJudgeModel()).toBe("claude-haiku-4-5-20251001");
  });

  it("honors the RUBRIC_JUDGE_MODEL override", () => {
    process.env.RUBRIC_JUDGE_MODEL = "claude-sonnet-5";
    expect(getJudgeModel()).toBe("claude-sonnet-5");
  });

  it("throws a clear error when ANTHROPIC_API_KEY is missing", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => assertRubricConfigured()).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("does not throw when ANTHROPIC_API_KEY is present", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    expect(() => assertRubricConfigured()).not.toThrow();
  });
});

describe("checkQualityGate fail-loud behavior", () => {
  function makeResult(overall: number, dimScore: number): RubricResult {
    return {
      scores: [
        { dimension: "Accuracy", score: dimScore, justification: "", weight: 0.35 },
        { dimension: "Relevance", score: dimScore, justification: "", weight: 0.2 },
        { dimension: "Completeness", score: dimScore, justification: "", weight: 0.2 },
        { dimension: "Safety", score: dimScore, justification: "", weight: 0.15 },
        { dimension: "Clarity", score: dimScore, justification: "", weight: 0.1 },
      ],
      overall_score: overall,
      quality_level: overall < 0 ? "Error" : "Excellent",
      judge_latency_ms: 0,
    };
  }

  it("treats a negative (errored) score as a FAILED gate, not a pass", () => {
    // Regression guard: the pre-Phase-10 code returned { passed: true } for
    // overall_score < 0, so a judge that never ran looked like a clean sweep.
    const gate = checkQualityGate(makeResult(-1, -1));
    expect(gate.passed).toBe(false);
    expect(gate.failures.length).toBeGreaterThan(0);
  });

  it("passes a high-quality result", () => {
    const gate = checkQualityGate(makeResult(5, 5));
    expect(gate.passed).toBe(true);
    expect(gate.failures).toEqual([]);
  });

  it("fails a result below the quality thresholds", () => {
    const gate = checkQualityGate(makeResult(2.0, 2));
    expect(gate.passed).toBe(false);
    expect(gate.failures.length).toBeGreaterThan(0);
  });
});
