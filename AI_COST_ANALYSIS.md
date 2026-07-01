# AI Cost Analysis

**Last updated:** March 2025
**Model:** Claude Sonnet 4.5 (`claude-sonnet-4-5`, default; configurable via `MODEL`) via Anthropic API
**Pricing:** $3.00/1M input, $15.00/1M output, $0.30/1M cache read — *the dev-spend and per-query figures below are **historical**, measured on the now-retired `claude-sonnet-4-20250514`. Verify current Sonnet 4.5 pricing before quoting live projections.*

---

## 1. Development & Testing Costs

### Actual Token Usage Per Query (Observed)

| Query Type | Avg Input | Avg Output | Cache Read | Avg Cost |
|------------|-----------|------------|------------|----------|
| Single-tool (meds, labs, summary) | ~1,500 | ~800 | ~1,700 | ~$0.017 |
| Multi-tool (discharge summary) | ~6,000 | ~2,500 | ~1,700 | ~$0.056 |
| Complex (discharge instructions + DailyMed) | ~12,000 | ~5,000 | ~1,700 | ~$0.111 |
| **Weighted average** | **~3,000** | **~1,500** | **~1,700** | **~$0.032** |

*Note: Prompt caching reduces the 1,700-token system prompt cost by 90% on repeat calls within a session (cache read at $0.30/1M vs $3.00/1M). Cache read tokens are not counted as input tokens.*

### Token Breakdown Per Query

| Component | Input Tokens | Output Tokens |
|-----------|--------------|---------------|
| System prompt (cached after 1st call) | 0 (cache read: ~1,700) | 0 |
| User message + context | 30–80 | 0 |
| Tool call iteration 1 (call + result) | 200–400 | 150–300 |
| Tool call iteration 2 (if multi-step) | 300–2,000 | 150–500 |
| Tool call iteration 3 (if complex) | 500–5,000 | 200–1,000 |
| Final response synthesis | 100–200 | 300–3,000 |
| **Single-tool total** | **~1,500** | **~800** |
| **Multi-tool total** | **~6,000** | **~2,500** |
| **Complex total** | **~12,000** | **~5,000** |

### Development Spend

| Activity | API Calls | Est. Tokens (Input) | Est. Tokens (Output) | Est. Cost |
|----------|-----------|---------------------|----------------------|-----------|
| Eval runs (125 cases × ~6 runs) | ~750 | ~2.3M | ~1.1M | ~$24 |
| Manual development & debugging | ~250 | ~750K | ~375K | ~$8 |
| Integration testing | ~100 | ~300K | ~150K | ~$3 |
| **Total development** | **~1,100** | **~3.4M** | **~1.6M** | **~$35** |

| Cost Category | Amount |
|---------------|--------|
| **LLM API (Claude Sonnet 4)** | **~$35** |
| Observability (Langfuse free tier) | $0 |
| Hosting (Railway Hobby) | ~$5 |
| **Total development cost** | **~$40** |

### Verification Overhead

The post-LLM verification layer (`applyVerification`) runs on every response but adds zero LLM cost — it operates on raw tool result JSON using deterministic rules (regex matching, threshold checks), not additional LLM calls. The only cost is ~1-2ms of server CPU time per request.

---

## 2. Production Cost Projections

### Assumptions

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Queries per user per day | 3 | Clinicians average 3 clinical lookups per shift |
| Active days per month | 22 | Weekday clinical shifts |
| Avg input tokens per query | 3,000 | Weighted across single-tool and multi-tool queries |
| Avg output tokens per query | 1,500 | Weighted average |
| Cache read tokens per query | 1,700 | System prompt cached within session |
| Tool calls per query (avg) | 2.1 | Based on eval data (most queries: 1-3 tools) |
| Verification overhead (LLM) | $0 | Deterministic, no additional LLM calls |

### Monthly Cost by User Scale

| | 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|---|-----------|-------------|--------------|---------------|
| **Monthly queries** | 6,600 | 66,000 | 660,000 | 6,600,000 |
| Input tokens | 19.8M | 198M | 1.98B | 19.8B |
| Output tokens | 9.9M | 99M | 990M | 9.9B |
| Cache read tokens | 11.2M | 112M | 1.12B | 11.2B |
| **LLM cost** | **$211** | **$2,112** | **$21,120** | **$211,200** |
| Observability (Langfuse) | $0 (free) | $29 | $79 | $529 |
| Hosting (Railway) | $10 | $30 | $200 | $2,000 |
| **Total monthly** | **~$221** | **~$2,171** | **~$21,399** | **~$213,729** |
| **Cost per user/month** | **$2.21** | **$2.17** | **$2.14** | **$2.14** |
| **Cost per query** | **$0.033** | **$0.033** | **$0.032** | **$0.032** |

### LLM Cost Calculation

```
Input cost  = input_tokens × $3.00 / 1M
Output cost = output_tokens × $15.00 / 1M
Cache cost  = cache_read_tokens × $0.30 / 1M

Per query = (3,000 × $3/1M) + (1,500 × $15/1M) + (1,700 × $0.30/1M)
         = $0.009 + $0.0225 + $0.00051
         = ~$0.032
```

---

## 3. Cost Optimization Strategies

### 3.1 Model Routing (Estimated 40-60% Savings)

Route simple queries (single-tool lookups) to Claude Haiku ($1/$5 per 1M) and reserve Sonnet for complex multi-tool workflows:

| | 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|---|-----------|-------------|--------------|---------------|
| LLM cost (hybrid) | ~$95 | ~$950 | ~$9,500 | ~$95,000 |
| **Savings vs Sonnet-only** | **55%** | **55%** | **55%** | **55%** |

*Assumes 70% of queries are simple (routed to Haiku) and 30% are complex (Sonnet).*

### 3.2 Prompt Caching (Already Implemented)

The 1,700-token system prompt is cached via Anthropic's prompt caching. Within a session, repeat calls pay $0.30/1M instead of $3.00/1M for the cached portion — a 90% reduction on system prompt tokens. This saves ~$0.005/query (~15% of per-query cost).

### 3.3 Response Caching (Already Implemented)

FHIR and DailyMed responses are cached with TTL (5-minute FHIR, 24-hour DailyMed). This reduces external API latency but doesn't directly reduce LLM costs (tool results still flow through the LLM). The primary benefit is latency reduction (2-4s saved on DailyMed calls).

### 3.4 Max Iterations Cap (Already Implemented)

`maxIterations: 6` prevents runaway tool-calling loops. Without this, a confused agent could make 10+ tool calls, multiplying token costs 3-5×. The cap ensures worst-case cost is bounded.

---

## 4. Cost Drivers & Sensitivity

### Primary Cost Driver: Output Tokens (70% of LLM Cost)

| Component | % of LLM Cost |
|-----------|---------------|
| Output tokens ($15/1M) | ~70% |
| Input tokens ($3/1M) | ~28% |
| Cache reads ($0.30/1M) | ~2% |

Output tokens dominate because they're 5× more expensive than input tokens. Discharge summaries and instructions are the most expensive queries due to long generated responses (~3,000-5,000 output tokens).

### Sensitivity Analysis

| Change | Impact on Monthly Cost (1K users) |
|--------|----------------------------------|
| +1 query/user/day | +$726 (+33%) |
| Switch to Haiku (all queries) | -$1,480 (-70%) |
| Double output length | +$1,485 (+70%) |
| Prompt caching disabled | +$330 (+15%) |
| Add RAG/vector search step | +$500-800 (+25-37%) |

---

## 5. Infrastructure Costs

| Component | Free Tier | Paid Tier | Notes |
|-----------|-----------|-----------|-------|
| **Anthropic API** | No free tier | Pay per token | See LLM costs above |
| **Langfuse** | 50K observations/mo | $29/mo (100K obs) | ~2-3 observations per query |
| **Railway** | N/A | $5-20/mo base | Scales with traffic |
| **DailyMed API** | Free (public API) | Free | NLM/NIH, no rate limit issues at clinical scale |
| **OpenFDA API** | Free (public API) | Free | 3s timeout fallback |

---

## 6. Comparison: Current Stack vs Alternatives

| Model | Input ($/1M) | Output ($/1M) | Per-Query Cost | Quality for Clinical |
|-------|--------------|---------------|----------------|---------------------|
| Claude Sonnet 4 (historical — retired; figures measured on it) | $3.00 | $15.00 | ~$0.032 | Excellent |
| Claude Sonnet 4.5 (current default) | verify | verify | verify | Excellent |
| Claude Haiku 4.5 | verify | verify | ~ | Good (simple queries) |
| GPT-4o | $5.00 | $15.00 | ~$0.038 | Comparable |
| GPT-4o-mini | $0.15 | $0.60 | ~$0.001 | Lower quality |
| Llama 3.1 70B (Groq) | ~$0.10 | ~$0.10 | ~$0.0004 | Untested for clinical |

*Source: Anthropic, OpenAI, Groq pricing (March 2025).*

---

*This analysis uses Anthropic API pricing as of March 2025. Actual costs may vary based on prompt caching hit rates, query complexity distribution, and token usage patterns. Verify current rates at [anthropic.com/pricing](https://anthropic.com/pricing).*
