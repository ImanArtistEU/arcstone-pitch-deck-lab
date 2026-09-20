# Evaluation Context Foundation & Context Engine

## Overview

Arcstone's **Evaluation Context Engine** establishes a canonical, pure-deterministic company evaluation context (`CompanyEvaluationContext`) before running downstream analytical models (thesis evaluator, Q&A simulator, recommendations engine).

Rather than judging every startup against a generic, static VC checklist, Arcstone evaluates a pitch deck through the lens of:
1. **Declared Stage vs. Observed Operating Maturity**: Separating what a company asks for / claims (e.g. "Pre-Seed") from its observed empirical traction (e.g. `early_market_evidence` vs `repeatable_growth`).
2. **Business Model Archetype**: Customizing expectation dimensions for B2B SaaS, Marketplace, Consumer, Deeptech, Developer Tools, or AI Applications.
3. **Sales Motion & Customer Model**: Evaluating CAC/LTV, contract size, sales velocity, and distribution alignment.
4. **Capital & Regulatory Intensity**: Adjusting expectations for gross margins, R&D timelines, and regulatory milestones.

---

## Canonical Data Structure

```typescript
export interface CompanyEvaluationContext {
  declaredStage: DeclaredStageContext;
  observedMaturity: ObservedMaturityContext;
  businessModel: BusinessModelContext;
  customerSalesMotion: CustomerSalesMotionContext;
  capitalRegulatory: CapitalRegulatoryContext;
  functionalMaturity: FunctionalMaturity;
  contextWarnings: ContextWarning[];
  evidenceReferences: EvidenceReference[];
  metadata: {
    engineVersion: string;
    evaluatedAtISO: string;
    overallContextConfidence: 'high' | 'medium' | 'low';
  };
}
```

---

## Pure Deterministic Rules

The context engine (`src/lib/deck/evaluation-context.ts`) strictly enforces:
- **Zero Gemini API calls**: Pure typescript logic derived from `StartupProfile`, `ClaimEvidenceMap`, and `DeckDiagnostics`.
- **Zero system clock (`Date.now()`) or randomness**: Guaranteed deterministic output for regression test stability.
- **No fake defaults**: Unknown stage stays `unknown`; missing profile fields remain explicit low-confidence context.
