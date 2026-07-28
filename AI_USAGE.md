# AI Usage

AI tools materially assisted development and verification of this repository.

## Tools used

- Claude Code (Opus 4.x) for implementation, tests, documentation review, and verification.
- Claude Sonnet 4.5 as the application runtime model.
- Claude Haiku 4.5 as the optional evaluation rubric judge.
- Browser automation for end-to-end demo verification.

## Material assistance

AI assisted with:

- implementing and testing the agent, tools, verification layer, and evaluation harness;
- migrating away from a retired model identifier;
- repairing the rubric-judge path and making misconfiguration fail loudly;
- fixing TypeScript errors exposed by full type checking;
- reconciling documentation with measured evidence;
- running browser-based demonstration workflows; and
- reviewing security and production-readiness gaps.

## Human review and corrections

All submitted changes and claims were manually reviewed. Material corrections included:

- restoring a valid test-count claim after checking the source;
- replacing a trace test that did not exercise the real import path;
- rejecting Sonnet 5 after paid calls exposed incompatibility with the pinned LangChain adapter;
- correcting hidden type errors that an earlier type-check invocation had not surfaced;
- correcting evaluation labels and removing unsupported “verified” claims; and
- preserving historical evaluation artifacts while separating them from the current Sonnet 4.5 run.

## Validation

The repository was validated with clean installation, linting, type checking, 494 passing unit tests, build output, paid end-to-end smoke tests, and a 125-case Sonnet 4.5 evaluation with deterministic and rubric grading.

AI output was treated as proposed work, not evidence. Claims were retained only when supported by repository state, tests, or recorded runs.

## Limitations

Authentication, role-based access control, pre-execution patient scoping, encrypted durable storage, licensed drug-interaction data, and production clinical validation remain incomplete. See [SECURITY.md](SECURITY.md) and [FUTURE_WORK.md](FUTURE_WORK.md).
