/**
 * Zero-cost structural smoke test for the eval harness.
 *
 * Validates that the eval dataset and the (repaired) rubric judge are
 * structurally sound WITHOUT making any paid API calls — suitable for CI.
 * Exits non-zero on any failure so the workflow fails correctly.
 */
import * as fs from "fs";
import * as path from "path";
import {
  getJudgeModel,
  checkQualityGate,
  type RubricResult,
} from "./rubric-judge";

function fail(msg: string): never {
  console.error(`❌ eval smoke: ${msg}`);
  process.exit(1);
}

// 1) Dataset parses and has the expected shape.
const casesPath = path.join(__dirname, "test-cases.json");
const raw = JSON.parse(fs.readFileSync(casesPath, "utf-8"));
const cases: Array<Record<string, unknown>> = Array.isArray(raw)
  ? raw
  : (raw.cases ?? raw.test_cases ?? []);
if (cases.length < 100) fail(`expected >=100 eval cases, found ${cases.length}`);
for (const c of cases) {
  if (!c.id) fail(`a case is missing an id`);
  if (!c.query && !c.turns) fail(`case ${c.id} has neither query nor turns`);
}

// 2) Repaired rubric judge: valid model id, no paid call.
const judge = getJudgeModel();
if (!/^claude-/.test(judge)) fail(`judge model looks invalid: ${judge}`);

// 3) Fail-loud gate regression: a negative score must NOT read as passed.
const errored: RubricResult = {
  scores: [],
  overall_score: -1,
  quality_level: "Error",
  judge_latency_ms: 0,
};
if (checkQualityGate(errored).passed) {
  fail("checkQualityGate treated a negative (errored) score as passed");
}

console.log(
  `✅ eval smoke: ${cases.length} cases valid · judge=${judge} · fail-loud gate OK`
);
