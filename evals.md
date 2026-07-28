# Evaluation Framework

## Purpose

The evaluation checks whether the agent selects the right tools, returns clinically relevant information, refuses unsafe or out-of-scope requests, and preserves required safety language.

Automated unit tests and live evaluation are separate:

- unit tests validate deterministic application behavior without paid model calls;
- evaluation runs the deployed model through the real agent and tools.

## Dataset

`eval/test-cases.json` contains 125 cases covering all ten tools. It includes happy paths, edge cases, adversarial prompts, multi-tool workflows, safety scenarios, ambiguity, out-of-domain questions, conversation history, and bounty workflows.

A case may specify:

| Field | Meaning |
|---|---|
| `id` | Stable case identifier |
| `query` or `turns` | Single- or multi-turn input |
| `patient_id` | Optional patient context |
| `expected_tools` | Expected routing |
| `must_contain` | Required response terms |
| `must_not_contain` | Prohibited terms |
| `category` / `subcategory` | Reporting labels |
| `rubric` | Optional LLM-judge criteria |

## Grading

Two graders can run together:

1. **Deterministic substring and tool checks** verify expected routing and required or prohibited phrases. They are reproducible but can penalize semantically correct phrasing.
2. **LLM-as-judge rubric** scores response quality using `claude-haiku-4-5-20251001`. It captures semantics better but introduces model cost and nondeterminism.

Results report both rather than treating either as ground truth. Grader agreement is included.

## Running

Requires `ANTHROPIC_API_KEY`:

```bash
npm run eval
npm run eval -- --rubric
```

Useful filters:

```bash
npm run eval -- --id=gs-001
npm run eval -- --category=safety
npm run eval -- --sequential
npm run eval -- --concurrency=3
npm run eval -- --resume
```

Sequential mode is preferred for latency measurement. Parallel runs can introduce throttling and distort per-case latency.

## Runner behavior

For each case, the runner:

1. invokes the agent with isolated session state;
2. records selected tools, response, latency, tokens, and cost when available;
3. applies deterministic assertions;
4. optionally invokes the rubric judge;
5. records failures without silently converting configuration errors into scores.

Results are written to `eval/results.json`. Published summaries must identify the model, date, dataset size, grader, and whether results are current or historical.

## Adding cases

Add a stable, uniquely identified case to `eval/test-cases.json`. Assertions should target clinically meaningful facts or safety behavior, not incidental wording. New cases should include the narrowest applicable category and avoid duplicating an existing scenario.

Current measured results and limitations are in [`docs/eval-results.md`](docs/eval-results.md).
