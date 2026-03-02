# AgentForge Eval Results

## Summary
- **Pass Rate:** 87.2% (109/125)
- **Unit Tests:** 479 passing
- **Tools Covered:** 10/10
- **Eval Cases:** 125
- **p50 Latency:** 6.2s
- **p95 Latency:** 28.4s

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
