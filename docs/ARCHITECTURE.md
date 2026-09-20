# Arcstone Pitch Deck Reviewer - System Architecture

## Core Analytical Flow

```
[Pitch Deck Document / PDF]
       │
       ▼
[Extraction Pipeline]
  ├── Hybrid Slide Extractor (Native Text + Gemini Vision)
  ├── Extract Claims (`ClaimEvidenceMap`)
  ├── Extract Profile (`StartupProfile`)
  └── Run Diagnostics (`DeckDiagnostics`)
       │
       ▼
[Evaluation Context Engine] (PURE DETERMINISTIC - ZERO GEMINI)
  ├── `buildCompanyEvaluationContext()`
  │     ├── Declared Stage vs Observed Maturity
  │     ├── Business Model Archetype & Customer Motion
  │     ├── Capital / Regulatory Intensity
  │     └── Context Warnings
  └── `buildEvaluationExpectations()`
        └── 19-Dimension Expectation Policy Matrix
       │
       ▼
[Analytical Engine Stack]
  ├── Thesis Evaluator (`evaluate-thesis`)
  ├── Investment Case Engine (`reconstruct-investment-case`) [BATCH 5B]
  ├── Q&A Simulator (`simulate-qa`)
  └── Recommendations Engine (`generate-recommendations`)
```

---

## File Organization

- **Types**:
  - `src/types/evaluation-context.ts`: Canonical context interfaces & enums.
  - `src/types/investment-case.ts`: Underwriting primitives (`WhatMustBeTrue`, `InvestmentCaseMechanism`, `InvestmentCase`).
  - `src/types/recommendations.ts`: Problem taxonomy V2 & recommendation contracts.
- **Lib Logic**:
  - `src/lib/deck/evaluation-context.ts`: Deterministic context builder.
  - `src/lib/deck/evaluation-expectations.ts`: Expectation policy builder.
  - `src/lib/deck/investment-case-engine.ts`: Hybrid Investment Case Reconstruction & What-Must-Be-True engine.
  - `src/lib/deck/thesis-evaluator.ts`: 14-dimension thesis evaluation orchestrator.
  - `src/lib/deck/simulator-engine.ts`: Institutional investor Q&A simulator.
  - `src/lib/deck/recommendations-engine.ts`: Actionable founder recommendations builder.
- **API Routes**:
  - `src/app/api/deck/evaluate-thesis/route.ts`: Context-aware thesis evaluation route.
  - `src/app/api/deck/reconstruct-investment-case/route.ts`: Investment Case Reconstruction route.
  - `src/app/api/deck/simulate-qa/route.ts`: Context-aware Q&A simulation route.
  - `src/app/api/deck/generate-recommendations/route.ts`: Context-aware recommendations route.
- **Tests**:
  - `tests/evaluation-context.test.ts`: Evaluation context test suite.
  - `tests/investment-case.test.ts`: Investment Case Reconstruction test suite (60+ tests).
