# AgentForge Eval Results

## Summary
- **Pass Rate:** 81.6% (102/125)
- **Unit Tests:** 479 passing
- **Tools Covered:** 10/10
- **Eval Cases:** 125
- **p50 Latency:** 6.2s
- **p95 Latency:** 27.4s

## Category Breakdown
| Category | Passed | Total | Rate |
|----------|--------|-------|------|
| Golden Sets | 10 | 10 | 100% |
| Multi-tool | 3 | 5 | 60% |
| Edge Cases | 5 | 9 | 56% |
| Adversarial | 20 | 22 | 91% |
| Safety | 4 | 7 | 57% |
| Query Variation | 7 | 8 | 88% |
| Drug Interactions | 4 | 5 | 80% |
| Complex Queries | 2 | 4 | 50% |
| Bounty: Encounters | 2 | 3 | 67% |
| Bounty: Med Rec | 1 | 2 | 50% |
| Bounty: Discharge | 2 | 2 | 100% |
| Bounty: Workflows | 2 | 2 | 100% |
| Bounty: Edge Cases | 0 | 1 | 0% |
| Bounty: Safety | 2 | 2 | 100% |
| Discharge Instr. | 3 | 4 | 75% |
| Appointments | 2 | 3 | 67% |
| DailyMed | 2 | 2 | 100% |
| Workflows | 3 | 3 | 100% |
| ambiguous | 4 | 4 | 100% |
| typo_resilience | 3 | 3 | 100% |
| out_of_domain | 3 | 4 | 75% |
| phi_boundary | 2 | 3 | 67% |
| knowledge_boundary | 3 | 3 | 100% |
| multi_turn_chain | 3 | 3 | 100% |
| robustness | 3 | 3 | 100% |
| conversation_history | 2 | 3 | 67% |
| consistency | 2 | 2 | 100% |
| latency | 3 | 3 | 100% |

## Tool Usage
| Tool | Calls |
|------|-------|
| `get_patient_summary` | 23 |
| `get_encounter_data` | 20 |
| `drug_interaction_check` | 17 |
| `get_lab_results` | 17 |
| `save_to_chart` | 15 |
| `get_medications` | 14 |
| `generate_discharge_instructions` | 8 |
| `allergy_check` | 6 |
| `reconcile_medications` | 5 |
| `draft_discharge_summary` | 4 |
