# Investment Case Reconstruction & What-Must-Be-True Engine

## Overview

Arcstone's Investment Case Engine moves pitch-deck analysis beyond surface claims and isolated diagnostic flags into **causal venture underwriting**. It reconstructs the **implicit investment thesis** an institutional investor evaluates when underwriting a company.

The core question driving this engine is:
> **"For this startup to become a successful venture-scale company, what must be true?"**

---

## Analytical Underwriting Architecture

```
PDF / Deck Evidence
  ├── Startup Profile & Claim Evidence Map
  ├── Deck Diagnostics (Contradictions, Evidence Gaps)
  ├── Company Evaluation Context (Maturity, Archetype, Intensity)
  └── Evaluation Expectations Policy
        │
        ▼
Investment Case Engine
  ├── 1. Structured Thesis Reconstruction (Stated vs Reconstructed Causal Logic)
  ├── 2. Underwritten Mechanisms (Value Creation, GTM, Monetization, Retention, Defensibility)
  ├── 3. What-Must-Be-True Assumptions (Explicit vs Implicit, Importance, Evidence Status)
  ├── 4. Thesis Bottlenecks / Single Points of Failure
  ├── 5. Dependency Graph (No self-loops, validated nodes & edges)
  ├── 6. Second-Order Tensions & Risk Taxonomy (ACV/GTM friction, unproven durability)
  └── 7. Language Safety & Provenance Sanitation (No scores, no fundability verdicts)
        │
        ▼
Downstream Integrations
  ├── Investor Simulator (Prioritizes questions on thesis bottlenecks)
  └── Founder Recommendations (Links recommendations to unproven assumptions and risks)
```

---

## Underwriting Primitives

### 1. Reconstructed Investment Thesis
Distinguishes between:
- **Deck-Stated Thesis**: What the deck explicitly asserts.
- **Reconstructed Causal Thesis**: The logical expansion story required for the business model to scale from current traction to venture returns.

### 2. What Must Be True (WMBT)
Every investment case relies on explicit claims and implicit assumptions across key categories:
- `value_creation`: Customer pain urgency and product utility.
- `customer_acquisition`: Sales motion repeatability beyond founder network.
- `monetization`: Unit pricing and economic realization.
- `retention`: Cohort durability and net revenue expansion.
- `defensibility`: Moat creation, switching costs, and network effects.

#### Importance Taxonomy
- `critical`: Necessary condition; failure invalidates the investment thesis.
- `high`: Material driver of venture scale or economics.
- `medium`: Secondary operational assumption.

#### Evidence Taxonomy
- `supported`: Substantiated by verified deck facts/metrics.
- `partially_supported`: Partial evidence present.
- `asserted_only`: Claimed in prose without metrics.
- `unsupported`: No deck evidence provided.
- `contradictory`: Conflicting facts present across slides.
- `not_yet_testable`: Unproven due to early stage (pre-product / concept).
- `not_applicable`: Does not apply to company business model.

---

## Single Points of Failure (Thesis Bottlenecks)

A **Thesis Bottleneck** occurs when multiple downstream mechanisms (such as GTM, monetization, and retention) depend on a single unproven or founder-concentrated assumption.

*Example*: If customer acquisition relies entirely on founder-led sales and no repeatable channel proof exists, GTM repeatability is flagged as `isThesisBottleneck = true`.

---

## Language Rules & Conservatism Policy

To maintain institutional objectivity, the Investment Case Engine strictly enforces language safety:
- **No Numerical Scores**: Never outputs arbitrary grades (e.g. 75/100).
- **No Fundability Predictions**: Prohibits terms such as `fundable`, `unfundable`, `investment ready`, or `funding probability`.
- **No Provenance Fabrication**: All slide references and claim IDs are validated against actual deck evidence.
