# Future Work

This document outlines known limitations of the current MVP and planned improvements for production readiness.

## Known Limitations (MVP)

These items are acknowledged gaps in the current build. The agent runs with **mock data by default**, so no real PHI is exposed.

| Finding | Severity | Notes |
|---------|----------|-------|
| No authentication layer | High | No user auth; relies on network-level access control (OpenEMR iframe) |
| Document endpoints lack authorization | High | CRUD operations on `/api/documents/:id` have no patient-scope or role checks |
| Patient scope is post-execution | Medium | Tools execute before scope violation is detected; data accessed but response blocked |
| Session history persisted in plaintext | Medium | `data/sessions.json` contains chat history unencrypted on disk |
| TLS verification disabled in dev | Medium | `NODE_TLS_REJECT_UNAUTHORIZED=0` for self-signed certs; must enable in production |
| No CSRF tokens | Medium | State-changing endpoints unprotected; mitigated by CORS origin restriction |
| CSP allows `unsafe-inline` | Low | Required for current inline JS/CSS; extract to separate files to remove |
| Regex-based injection detection | Low | Bypassable via encoding/homoglyphs; defense-in-depth with LLM system prompt |

## Security Hardening

- [ ] Add authentication middleware (JWT or session-based) with role-based access control
- [ ] Implement document-level authorization so only the owning clinician can edit/finalize
- [ ] Move patient scope enforcement before tool execution (pre-execution guard)
- [ ] Encrypt session storage on disk or migrate to Redis/database-backed sessions
- [ ] Enable TLS certificate verification in production
- [ ] Add CSRF tokens to all state-changing endpoints
- [ ] Extract inline JS/CSS to separate files and remove `unsafe-inline` from CSP
- [ ] Strengthen prompt injection detection with embedding-based classifiers

## Eval & Robustness

- [ ] Expand eval dataset from 125 to 250+ cases for broader coverage
- [ ] Improve weaker eval categories: complex queries (50%), multi-tool chains (60%), typo resilience (67%)
- [ ] Add deterministic consistency tests (run same query N times, assert identical output)
- [ ] Add latency regression tests with per-tool SLA thresholds
- [ ] Implement retry logic for LLM non-determinism in multi-step workflows

## Agent Capabilities

- [ ] Add vital signs trending tool (plot vitals over time with alerts for abnormal trends)
- [ ] Add clinical notes search tool (full-text search across progress notes and encounter docs)
- [ ] Support multi-patient comparison queries (e.g., "compare labs for patient A vs B")
- [ ] Add RAG over clinical guidelines (UpToDate, ClinicalKey) for evidence-based recommendations
- [ ] Support image/PDF attachment handling for lab reports and imaging results

## Performance & Scalability

- [ ] Implement connection pooling for FHIR API calls
- [ ] Add Redis-backed caching layer (replace in-memory request-scoped cache)
- [ ] Implement request queuing for high-concurrency scenarios
- [ ] Add horizontal scaling support with shared session storage
- [ ] Profile and optimize p95 latency (currently 28.4s) for multi-tool chains

## Observability

- [ ] Attribute LLM reasoning time to individual tool calls for more meaningful per-tool latency
- [ ] Add cost tracking dashboard with daily/weekly spend alerts
- [ ] Implement A/B testing framework for prompt variations
- [ ] Add user satisfaction tracking (thumbs up/down correlation with confidence scores)
- [ ] Build alerting pipeline for safety violations and error rate spikes

## Frontend & UX

- [ ] Add print-friendly discharge instruction layout
- [ ] Implement accessibility audit and WCAG 2.1 AA compliance
- [ ] Add keyboard navigation for all interactive elements
- [ ] Support dark mode / high-contrast themes for clinical environments
- [ ] Add mobile-responsive layout for tablet use at bedside

## Infrastructure

- [ ] Migrate from Railway to HIPAA-compliant hosting (AWS GovCloud, Azure Healthcare APIs)
- [ ] Set up CI/CD pipeline with automated eval runs on every PR
- [ ] Add staging environment for pre-production testing
- [ ] Implement database-backed document storage (replace in-memory JSON)
- [ ] Add automated backup and disaster recovery for session and document data
