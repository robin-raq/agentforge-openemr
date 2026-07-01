# AgentForge Eval Results

> **Provenance & methodology.** These results are from a **historical run on
> 2026-03-02** against the now-retired model `claude-sonnet-4-20250514`.
> Pass/fail is **substring-graded** (keyword assertions on the response text),
> **not** the LLM-as-judge rubric — the rubric is a separate opt-in pass
> (`npm run eval -- --rubric`) and was not run for these numbers, so
> `rubric_avg_score` is `"N/A"` in `eval/results.json`. The current default
> model is `claude-sonnet-4-5` (configurable via `MODEL`); a **current 125-case
> run on it (with the repaired rubric)** is in the *Current run* section below —
> it sits beside, and does **not** replace, this historical result. Source of
> truth for the historical run: `eval/results.json`.

## Current run — Sonnet 4.5 (2026-07-01, repaired rubric)

Re-measured on the current default model `claude-sonnet-4-5`, all 125 cases,
substring **and** LLM-judge rubric (judge `claude-haiku-4-5-20251001`).

| Metric | Value |
|--------|-------|
| Substring pass | **81.6% (102/125)** |
| Rubric pass (≥3.5) | **82.4% (103/125)**, avg **4.34 / 5** |
| Grader agreement | 70.4% (88/125) |
| p50 / p95 latency | 7.5s / 34.3s |
| Source citation · disclaimer · verification_correct | 125/125 · 125/125 · 125/125 |
| Scope violations · hallucination flags | 0 · 5/125 |
| Total cost · avg per run | $1.66 · $0.013 |

**Interpretation.** Substring pass dropped from the historical 87.2% (Sonnet 4)
to 81.6% (Sonnet 4.5), largely because the brittle substring assertions
penalize valid tool-selection differences (golden set 8/10 vs 10/10). The
rubric — 82.4%, avg 4.34/5 — confirms answer **quality** stayed high. This is
the case for grading by rubric, not substring alone.

---

## Summary (historical · substring-graded · Sonnet 4)
- **Eval pass rate:** 87.2% (109/125) — substring-graded
- **Performance targets met:** 4 of 7 (see below)
- **Unit Tests:** 494 passing (+ 9 skipped) — current (`npm test`)
- **Tools Covered:** 10/10
- **Eval Cases:** 125
- **p50 Latency:** 6.2s
- **p95 Latency:** 28.4s (above the multi-step latency target — see below)

## Performance Targets — 4 of 7 met
| Target | Threshold | Actual | Met |
|--------|-----------|--------|-----|
| Golden-set pass rate | 100% | 100% (10/10) | ✅ |
| Eval pass rate | ≥ 80% | 87.2% | ✅ |
| Hallucination rate | ≤ 5% | 3.2% | ✅ |
| Verification accuracy | ≥ 90% | 99.2% | ✅ |
| Single-tool latency (avg) | < 5000 ms | 6986 ms | ❌ |
| Multi-step latency (avg) | < 15000 ms | 24914 ms | ❌ |
| Tool success rate | ≥ 95% | 94.0% | ❌ |

The three misses are latency- and tool-reliability-related; the flagship
discharge fan-out is the slowest path (p95 28.4s). They are stated here rather
than hidden — owning them is the honest posture for a clinical-safety project.

## Category Breakdown
| Category | Passed | Total | Rate |
|----------|--------|-------|------|
| Golden Sets | 10 | 10 | 100% |
| Multi-tool | 3 | 5 | 60% |
| Edge Cases | 6 | 9 | 67% |
| Adversarial | 20 | 22 | 91% |
| Safety | 6 | 7 | 86% |
| Query Variation | 7 | 8 | 88% |
| Drug Interactions | 4 | 5 | 80% |
| Complex Queries | 2 | 4 | 50% |
| Bounty: Encounters | 3 | 3 | 100% |
| Bounty: Med Rec | 1 | 2 | 50% |
| Bounty: Discharge | 2 | 2 | 100% |
| Bounty: Workflows | 2 | 2 | 100% |
| Bounty: Edge Cases | 1 | 1 | 100% |
| Bounty: Safety | 2 | 2 | 100% |
| Discharge Instr. | 4 | 4 | 100% |
| Appointments | 3 | 3 | 100% |
| DailyMed | 2 | 2 | 100% |
| Workflows | 3 | 3 | 100% |
| ambiguous | 4 | 4 | 100% |
| typo_resilience | 2 | 3 | 67% |
| out_of_domain | 3 | 4 | 75% |
| phi_boundary | 3 | 3 | 100% |
| knowledge_boundary | 3 | 3 | 100% |
| multi_turn_chain | 3 | 3 | 100% |
| robustness | 3 | 3 | 100% |
| conversation_history | 2 | 3 | 67% |
| consistency | 2 | 2 | 100% |
| latency | 3 | 3 | 100% |

## Tool Usage
| Tool | Calls |
|------|-------|
| `get_patient_summary` | 26 |
| `get_encounter_data` | 22 |
| `drug_interaction_check` | 18 |
| `get_lab_results` | 17 |
| `get_medications` | 15 |
| `save_to_chart` | 15 |
| `allergy_check` | 8 |
| `generate_discharge_instructions` | 8 |
| `reconcile_medications` | 5 |
| `draft_discharge_summary` | 4 |
