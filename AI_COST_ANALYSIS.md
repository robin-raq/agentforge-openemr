# AI Cost Evidence

This document separates measured costs from projections. Prices and model availability change; verify the provider’s current pricing before using these figures.

## Measured

| Evidence | Amount |
|---|---:|
| Current 125-case Sonnet 4.5 evaluation | $1.66 total |
| Current evaluation average | $0.013 per case |
| Interview-verification paid calls | approximately $0.24 |

Historical development-spend and per-query estimates were measured or inferred using the retired `claude-sonnet-4-20250514` model and are not current production evidence.

## Cost drivers

- Output length dominates model cost.
- Multi-tool discharge workflows require more iterations and context than single-tool retrieval.
- The six-iteration cap bounds runaway tool loops.
- Prompt caching can reduce repeated system-prompt input charges when supported.
- FHIR and DailyMed response caching primarily reduce latency; tool results still enter model context.

## Projection method

A defensible projection should use:

```text
monthly cost =
  monthly queries
  × measured queries by workflow type
  × current input, output, and cache token prices
  + hosting, telemetry, and storage
```

Before publishing a projection:

1. capture token use by workflow type on the current model;
2. use the provider’s current pricing;
3. state user-count and query-frequency assumptions;
4. separate model, infrastructure, and observability costs;
5. show a range rather than a single precise figure; and
6. include clinical-security and compliance infrastructure omitted from the demo.

The previous 100-to-100,000-user tables were removed because their precision exceeded the available evidence.
