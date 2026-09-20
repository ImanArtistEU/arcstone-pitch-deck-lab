import { describe, it, expect } from 'vitest';
import { buildCompanyEvaluationContext } from '../src/lib/deck/evaluation-context';
import { buildEvaluationExpectations } from '../src/lib/deck/evaluation-expectations';
import { StartupProfile, ProfileField } from '../src/types/startup';
import { generateDeterministicEvaluation } from '../src/lib/deck/thesis-evaluator';
import { generateDeterministicRecommendations } from '../src/lib/deck/recommendations-engine';

function pf(rawValue: string): ProfileField<string> {
  return { rawValue, status: 'extracted', evidence: [] };
}

describe('Batch 5A - Evaluation Context & Underwriting Foundation', () => {
  // Test 1: profile.goToMarket reaches thesis evaluation context
  it('1. profile.goToMarket reaches evaluation context correctly', () => {
    const profile = {
      goToMarket: {
        salesMotion: pf('Enterprise Direct Sales'),
      },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.customerSalesMotion.salesMotion).toBe('enterprise_sales');
    expect(context.evidenceReferences.some((r) => r.topic === 'Sales Motion' && r.statement === 'Enterprise Direct Sales')).toBe(true);
  });

  // Tests 2-5: Stage Normalization
  it('2. Declared pre-seed normalized correctly', () => {
    const profile = {
      fundraising: { currentStage: pf('Pre-Seed Round') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.declaredStage.normalizedStage).toBe('pre_seed');
  });

  it('3. Declared Seed normalized correctly', () => {
    const profile = {
      fundraising: { currentStage: pf('Seed Round') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.declaredStage.normalizedStage).toBe('seed');
  });

  it('4. Series A normalized correctly', () => {
    const profile = {
      fundraising: { currentStage: pf('Series A') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.declaredStage.normalizedStage).toBe('series_a');
  });

  it('5 & 6. Unknown stage stays unknown without default Seed fallback', () => {
    const profile = {
      fundraising: { currentStage: pf('') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.declaredStage.normalizedStage).toBe('unknown');
    expect(context.declaredStage.normalizedStage).not.toBe('seed');
  });

  // Tests 7-11: Operating Maturity & Confidence
  it('7 & 8. Operating maturity independent of funding round (Series A can have early-market-evidence)', () => {
    const profile = {
      fundraising: { currentStage: pf('Series A') },
      traction: { ARR: pf('€50k ARR') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.declaredStage.normalizedStage).toBe('series_a');
    expect(context.observedMaturity.value).toBe('early_market_evidence');
    expect(context.contextWarnings.some((w) => w.type === 'DECLARED_STAGE_MATURITY_MISMATCH')).toBe(true);
  });

  it('9. Pre-seed can have advanced traction maturity', () => {
    const profile = {
      fundraising: { currentStage: pf('Pre-Seed') },
      traction: {
        ARR: pf('€1.2M ARR'),
        customerCount: pf('50 enterprise clients'),
        growthRates: pf('15% MoM'),
      },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.declaredStage.normalizedStage).toBe('pre_seed');
    expect(context.observedMaturity.value).toBe('repeatable_growth');
  });

  it('10. Maturity output includes evidence basis', () => {
    const profile = {
      traction: { customerCount: pf('10 pilot users') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.observedMaturity.basis.length).toBeGreaterThan(0);
  });

  it('11. Low-confidence context remains explicit when profile is empty', () => {
    const context = buildCompanyEvaluationContext(null, null, null);
    expect(context.businessModel.confidence).toBe('low');
    expect(context.observedMaturity.confidence).toBe('low');
  });

  // Tests 12-16: Business Model Archetypes
  it('12. B2B SaaS classification', () => {
    const profile = {
      businessModel: { revenueModel: pf('SaaS recurring subscription') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.businessModel.primaryArchetype).toBe('b2b_saas');
  });

  it('13. Marketplace classification', () => {
    const profile = {
      businessModel: { revenueModel: pf('15% commission marketplace take rate') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.businessModel.primaryArchetype).toBe('marketplace');
  });

  it('14. Consumer classification', () => {
    const profile = {
      customerICP: { customerType: pf('Direct to B2C Consumer') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.businessModel.primaryArchetype).toBe('consumer');
  });

  it('15. Mixed model classification', () => {
    const profile = {
      customerICP: { customerType: pf('Enterprise and SMB') },
      businessModel: { revenueModel: pf('Subscription') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.customerSalesMotion.customerModel).toBe('mixed');
  });

  it('16. Unknown model remains unknown', () => {
    const profile = {
      businessModel: { revenueModel: pf('not_found') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.businessModel.primaryArchetype).toBe('unknown');
  });

  // Tests 17-21: Expectation Policy
  it('17 & 18. Marketplace expectations activate marketplace metrics and do not impose on SaaS', () => {
    const mktProfile = {
      businessModel: { revenueModel: pf('Marketplace take-rate') },
    } as unknown as StartupProfile;
    const saasProfile = {
      businessModel: { revenueModel: pf('SaaS subscription') },
    } as unknown as StartupProfile;

    const mktCtx = buildCompanyEvaluationContext(mktProfile, null, null);
    const saasCtx = buildCompanyEvaluationContext(saasProfile, null, null);

    const mktExp = buildEvaluationExpectations(mktCtx);
    const saasExp = buildEvaluationExpectations(saasCtx);

    expect(mktExp.expectations['marketplaceLiquidity'].status).not.toBe('NOT_APPLICABLE');
    expect(saasExp.expectations['marketplaceLiquidity'].status).toBe('NOT_APPLICABLE');
  });

  it('19 & 20. Retention requirements adapt based on maturity (Pre-product vs Repeatable Growth)', () => {
    const preProdProfile = {
      problemSolution: { productDescription: pf('Concept MVP') },
    } as unknown as StartupProfile;
    const scaleProfile = {
      traction: {
        ARR: pf('€1.5M ARR'),
        customerCount: pf('120 customers'),
        growthRates: pf('20% MoM'),
      },
    } as unknown as StartupProfile;

    const preCtx = buildCompanyEvaluationContext(preProdProfile, null, null);
    const scaleCtx = buildCompanyEvaluationContext(scaleProfile, null, null);

    const preExp = buildEvaluationExpectations(preCtx);
    const scaleExp = buildEvaluationExpectations(scaleCtx);

    expect(preExp.expectations['retention'].status).toBe('NOT_YET_EXPECTED');
    expect(scaleExp.expectations['retention'].status).toBe('EXPECTED');
  });

  it('21. Deeptech expectations do not blindly require SaaS metrics', () => {
    const deepProfile = {
      technology: { coreTechnology: pf('Quantum hardware R&D') },
    } as unknown as StartupProfile;
    const deepCtx = buildCompanyEvaluationContext(deepProfile, null, null);
    const deepExp = buildEvaluationExpectations(deepCtx);

    expect(deepExp.expectations['defensibility'].status).toBe('EXPECTED');
    expect(deepExp.expectations['grossMargin'].status).toBe('EXPECTED');
  });

  // Tests 22-26: Problem Taxonomy & Fallback Integrity
  it('25 & 26. Deterministic fallback uses empty slide references when absent and avoids fake confidence', () => {
    const evaluation = generateDeterministicEvaluation(null, null, null, 10);
    expect(evaluation.reconstructedThesis.find((p) => p.pillar === 'Why Now')?.slideNumbers).toEqual([]);
    expect(evaluation.dimensions.find((d) => d.dimensionName === 'Defensibility')?.status).toBe('UNDERDEVELOPED');
  });

  // Tests 27-33: Recommendations & Language Safety
  it('27 & 30-33. Recommendation contains problemClass, investorInterpretation, whyNow, and resolutionCriteria', () => {
    const profile = {
      fundraising: { amountBeingRaised: pf('€2M') },
    } as unknown as StartupProfile;
    const recs = generateDeterministicRecommendations(profile, null, null, null, null, 10);
    expect(recs.recommendations.length).toBeGreaterThan(0);
    const askRec = recs.recommendations.find((r) => r.category === 'ask');
    expect(askRec).toBeDefined();
    expect(askRec?.problemClass).toBe('COMMUNICATION_GAP');
    expect(askRec?.investorInterpretation).toBeDefined();
    expect(askRec?.whyNow).toBeDefined();
    expect(askRec?.resolutionCriteria).toBeDefined();
  });

  it('28 & 29. No UNFUNDABLE_STATE or investment probability terminology in codebase outputs', () => {
    const evaluation = generateDeterministicEvaluation(null, null, null, 10);
    const jsonStr = JSON.stringify(evaluation);
    expect(jsonStr).not.includes('UNFUNDABLE_STATE');
    expect(jsonStr).not.includes('INVESTMENT_READY');
    expect(jsonStr).not.includes('probability');
  });

  // Tests 36-37: Immutability and Determinism
  it('36 & 37. Context objects are deterministic and produce identical outputs for identical inputs', () => {
    const profile = {
      fundraising: { currentStage: pf('Seed') },
      traction: { ARR: pf('€300k') },
    } as unknown as StartupProfile;
    const ctx1 = buildCompanyEvaluationContext(profile, null, null);
    const ctx2 = buildCompanyEvaluationContext(profile, null, null);

    expect(ctx1).toEqual(ctx2);
  });
});
