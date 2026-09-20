# Arcstone VC Underwriting & Expectation Policy Model

## Core Philosophy

Venture Capital underwriting is fundamentally about assessing risk, mechanisms, and core assumptions required for an investment thesis to succeed. Arcstone's analytical engines do **NOT**:
- Calculate arbitrary overall "deck scores" (no 82/100, no 7.5/10).
- Classify companies as `UNFUNDABLE_STATE` or `INVESTMENT_READY`.
- Estimate "investment probabilities".

Instead, Arcstone assesses:
1. **What Must Be True**: What core assumptions (market size, ACV, sales repeatability, retention) must hold for this investment thesis to work?
2. **Expectation Policy**: What dimensions are `EXPECTED`, `RELEVANT`, `OPTIONAL`, `NOT_YET_EXPECTED`, or `NOT_APPLICABLE` given this specific stage, maturity, and archetype?
3. **Underwriting Problem Taxonomy**:
   - `FACTUAL_GAP`: Information needed to evaluate the claim is absent.
   - `EVIDENCE_GAP`: Claim exists but support is insufficient.
   - `COMMUNICATION_GAP`: Relevant facts appear to exist but are poorly communicated.
   - `LOGIC_GAP`: Stated facts do not form a coherent strategic/economic story.
   - `INVESTMENT_CASE_RISK`: Deck communicates situation clearly, but investor would reasonably see unresolved underlying risk.

---

## Dimension Expectations Matrix

| Dimension | Pre-Product / Concept | Early Market Evidence | Repeatable Growth / Scaling |
| :--- | :--- | :--- | :--- |
| **Problem & Solution** | `EXPECTED` | `EXPECTED` | `EXPECTED` |
| **Traction & Velocity** | `OPTIONAL` / `RELEVANT` | `EXPECTED` | `EXPECTED` |
| **Retention & Cohorts** | `NOT_YET_EXPECTED` | `RELEVANT` | `EXPECTED` |
| **Sales Repeatability** | `NOT_YET_EXPECTED` | `NOT_YET_EXPECTED` | `EXPECTED` |
| **Marketplace Liquidity** | `RELEVANT` (Marketplace) | `EXPECTED` (Marketplace) | `EXPECTED` (Marketplace) |
| **Clinical Validation** | `EXPECTED` (Biotech/Health) | `EXPECTED` (Biotech/Health) | `EXPECTED` (Biotech/Health) |

---

## Language & Communication Safety

To maintain institutional trust, Arcstone engines strictly use uncertainty-safe language when framing investor pushback:
- *Safe*: "Without retention cohort data, an investor may be unable to determine whether growth is durable."
- *Unsafe*: "Investors will think customers are churning."
