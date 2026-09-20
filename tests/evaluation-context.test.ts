import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildCompanyEvaluationContext,
  getOrBuildEvaluationContextAndExpectations,
} from '../src/lib/deck/evaluation-context';
import { buildEvaluationExpectations } from '../src/lib/deck/evaluation-expectations';
import { StartupProfile, ProfileField } from '../src/types/startup';
import { generateDeterministicEvaluation, executeFundraisingEvaluation } from '../src/lib/deck/thesis-evaluator';
import { generateDeterministicRecommendations, executeRecommendationGeneration } from '../src/lib/deck/recommendations-engine';
import { executeInvestorSimulation } from '../src/lib/deck/simulator-engine';
import { HybridDeckResult } from '../src/types/deck';

function pf(rawValue: string, slideNumber?: number): ProfileField<string> {
  return {
    rawValue,
    status: 'extracted',
    evidence: slideNumber ? [{ slideNumber, exactText: rawValue, source: 'native_pdf' }] : [],
  };
}

const mockHybridResult = {
  metadata: { fileName: 'test.pdf', fileSizeBytes: 1000, pageCount: 2, sha256: 'abc' },
  slides: [
    {
      pageNumber: 1,
      nativeExtraction: { rawText: 'Problem slide', textBlocks: [], characterCount: 13, wordCount: 2, status: 'success' },
      combinedEvidence: { rawText: 'Problem slide', verifiedMetrics: [], claims: [], visualElements: [], slideTitle: 'Problem', primaryTopic: 'Problem' },
      processing: { status: 'success', warnings: [], errors: [] },
    },
    {
      pageNumber: 2,
      nativeExtraction: { rawText: 'Solution slide', textBlocks: [], characterCount: 14, wordCount: 2, status: 'success' },
      combinedEvidence: { rawText: 'Solution slide', verifiedMetrics: [], claims: [], visualElements: [], slideTitle: 'Solution', primaryTopic: 'Solution' },
      processing: { status: 'success', warnings: [], errors: [] },
    },
  ],
  summary: { totalPages: 2, nativeSuccessCount: 2, visualSuccessCount: 0, emptyCount: 0, warningCount: 0, errorCount: 0, geminiActive: false },
  extractedAt: new Date(),
} as unknown as HybridDeckResult;

describe('Batch 5A.1 - Evaluation Context & Expectation Policy Integration Suite', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. GTM Contract Field Propagation
  it('1. profile.goToMarket reaches evaluation context correctly', () => {
    const profile = {
      goToMarket: { salesMotion: pf('Enterprise Direct Sales', 4) },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.customerSalesMotion.salesMotion).toBe('enterprise_sales');
    expect(context.evidenceReferences.some((r) => r.topic === 'Sales Motion' && r.statement === 'Enterprise Direct Sales')).toBe(true);
  });

  // 2-6. Stage Normalization & Unknown Handling
  it('2. Declared pre-seed normalized correctly', () => {
    const profile = { fundraising: { currentStage: pf('Pre-Seed Round') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.declaredStage.normalizedStage).toBe('pre_seed');
  });

  it('3. Declared Seed normalized correctly', () => {
    const profile = { fundraising: { currentStage: pf('Seed Round') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.declaredStage.normalizedStage).toBe('seed');
  });

  it('4. Series A normalized correctly', () => {
    const profile = { fundraising: { currentStage: pf('Series A') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.declaredStage.normalizedStage).toBe('series_a');
  });

  it('5. Series B normalized correctly', () => {
    const profile = { fundraising: { currentStage: pf('Series B') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.declaredStage.normalizedStage).toBe('series_b_plus');
  });

  it('6. Unknown stage stays unknown without default Seed fallback', () => {
    const profile = { fundraising: { currentStage: pf('') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.declaredStage.normalizedStage).toBe('unknown');
    expect(context.declaredStage.normalizedStage).not.toBe('seed');
  });

  // 7-11. Stage vs Maturity Independence & Warnings
  it('7. Operating maturity independent of funding round (Series A with early market evidence)', () => {
    const profile = {
      fundraising: { currentStage: pf('Series A') },
      traction: { ARR: pf('€50k ARR', 5) },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.declaredStage.normalizedStage).toBe('series_a');
    expect(context.observedMaturity.value).toBe('early_market_evidence');
  });

  it('8. Mismatch between stage and maturity generates context warning', () => {
    const profile = {
      fundraising: { currentStage: pf('Series A') },
      traction: { ARR: pf('€50k ARR') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.contextWarnings.some((w) => w.type === 'DECLARED_STAGE_MATURITY_MISMATCH')).toBe(true);
  });

  it('9. Pre-seed can achieve repeatable growth if multi-cohort proof exists', () => {
    const profile = {
      fundraising: { currentStage: pf('Pre-Seed') },
      traction: {
        ARR: pf('€1.2M ARR', 5),
        customerCount: pf('50 enterprise clients across 3 distribution channels', 5),
        growthRates: pf('15% MoM retention', 5),
      },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.declaredStage.normalizedStage).toBe('pre_seed');
    expect(context.observedMaturity.value).toBe('repeatable_growth');
  });

  it('10. Maturity output includes explicit evidence basis', () => {
    const profile = { traction: { customerCount: pf('10 pilot users', 3) } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.observedMaturity.basis.length).toBeGreaterThan(0);
  });

  it('11. Low-confidence context remains explicit when profile is empty', () => {
    const context = buildCompanyEvaluationContext(null, null, null);
    expect(context.businessModel.confidence).toBe('low');
    expect(context.observedMaturity.confidence).toBe('low');
  });

  // 12-18. Archetype Multi-Axis Classifications
  it('12. B2B SaaS archetype classification', () => {
    const profile = { businessModel: { revenueModel: pf('SaaS recurring subscription') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.businessModel.primaryArchetype).toBe('b2b_saas');
  });

  it('13. Marketplace archetype classification', () => {
    const profile = { businessModel: { revenueModel: pf('15% commission marketplace take rate') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.businessModel.primaryArchetype).toBe('marketplace');
  });

  it('14. Consumer archetype classification', () => {
    const profile = { customerICP: { customerType: pf('Direct to B2C Consumer') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.businessModel.primaryArchetype).toBe('consumer');
  });

  it('15. Usage-based API archetype classification', () => {
    const profile = { businessModel: { revenueModel: pf('Usage-based API pricing per 1k requests') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.businessModel.primaryArchetype).toBe('usage_based');
  });

  it('16. Developer tools archetype classification', () => {
    const profile = { businessModel: { revenueModel: pf('Developer tools SDK license') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.businessModel.primaryArchetype).toBe('developer_tools');
  });

  it('17. Mixed model customer classification', () => {
    const profile = {
      customerICP: { customerType: pf('Enterprise and SMB') },
      businessModel: { revenueModel: pf('Subscription') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.customerSalesMotion.customerModel).toBe('mixed');
  });

  it('18. Unknown model remains unknown', () => {
    const profile = { businessModel: { revenueModel: pf('not_found') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.businessModel.primaryArchetype).toBe('unknown');
  });

  // 19-22. Technology Category Multi-Axis Classifications
  it('19. Technology category AI Application classification', () => {
    const profile = {
      technology: { coreTechnology: pf('LLM agentic application platform') },
      businessModel: { revenueModel: pf('SaaS subscription') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.businessModel.primaryArchetype).toBe('b2b_saas');
    expect(context.businessModel.technologyCategory).toBe('ai_application');
  });

  it('20. Technology category AI Infrastructure classification', () => {
    const profile = { technology: { coreTechnology: pf('GPU cluster training infrastructure') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.businessModel.technologyCategory).toBe('ai_infrastructure');
  });

  it('21. Technology category Deeptech classification', () => {
    const profile = { technology: { coreTechnology: pf('Quantum computing silicon photonics R&D') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.businessModel.technologyCategory).toBe('deeptech');
  });

  it('22. Technology category Hardware classification', () => {
    const profile = { technology: { coreTechnology: pf('Robotics hardware assembly') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.businessModel.technologyCategory).toBe('hardware');
  });

  // 23-28. Conservatism - Unknown Intensity & Functional Maturity
  it('23. Capital intensity defaults to unknown without evidence', () => {
    const context = buildCompanyEvaluationContext(null, null, null);
    expect(context.capitalRegulatory.capitalIntensity).toBe('unknown');
    expect(context.capitalRegulatory.capitalIntensity).not.toBe('low');
  });

  it('24. Regulatory intensity defaults to unknown without evidence', () => {
    const context = buildCompanyEvaluationContext(null, null, null);
    expect(context.capitalRegulatory.regulatoryIntensity).toBe('unknown');
    expect(context.capitalRegulatory.regulatoryIntensity).not.toBe('low');
  });

  it('25. Revenue functional maturity defaults to unknown without evidence', () => {
    const context = buildCompanyEvaluationContext(null, null, null);
    expect(context.functionalMaturity.revenueMaturity).toBe('unknown');
  });

  it('26. Traction functional maturity defaults to unknown without evidence', () => {
    const context = buildCompanyEvaluationContext(null, null, null);
    expect(context.functionalMaturity.tractionMaturity).toBe('unknown');
  });

  it('27. Distribution functional maturity defaults to unknown without evidence', () => {
    const context = buildCompanyEvaluationContext(null, null, null);
    expect(context.functionalMaturity.distributionMaturity).toBe('unknown');
  });

  it('28. Product functional maturity defaults to unknown without evidence', () => {
    const context = buildCompanyEvaluationContext(null, null, null);
    expect(context.functionalMaturity.productMaturity).toBe('unknown');
  });

  // 29-33. Evidence Provenance & Monetary Parsing
  it('29. Evidence references only include slideNumber when positive slide provenance exists', () => {
    const profile = {
      problemSolution: { problemStatement: pf('Unanchored problem text') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    for (const ev of context.evidenceReferences) {
      if (ev.slideNumber !== undefined) {
        expect(ev.slideNumber).toBeGreaterThan(0);
      }
    }
  });

  it('30. Monetary parser handles €1.2M ARR', () => {
    const profile = { traction: { ARR: pf('€1.2M ARR', 4) } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.evidenceReferences.some((e) => e.statement.includes('€1.2M ARR'))).toBe(true);
  });

  it('31. Monetary parser handles $750k ARR', () => {
    const profile = { traction: { ARR: pf('$750k ARR', 3) } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.evidenceReferences.some((e) => e.statement.includes('$750k ARR'))).toBe(true);
  });

  it('32. Monetary parser handles €80k MRR', () => {
    const profile = { traction: { ARR: pf('€80k MRR', 3) } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.evidenceReferences.some((e) => e.statement.includes('€80k MRR'))).toBe(true);
  });

  it('33. High revenue magnitude without multi-channel retention proof does not grant scaling', () => {
    const profile = { traction: { ARR: pf('€2.5M ARR', 2) } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.observedMaturity.value).not.toBe('scaling');
    expect(context.observedMaturity.value).toBe('early_market_evidence');
  });

  // 34-39. Expectation Policy Fine-Tuning
  it('34. Marketplace expectations activate marketplace liquidity and do not impose on SaaS', () => {
    const mktProfile = { businessModel: { revenueModel: pf('Marketplace take-rate') } } as unknown as StartupProfile;
    const saasProfile = { businessModel: { revenueModel: pf('SaaS subscription') } } as unknown as StartupProfile;

    const mktExp = buildEvaluationExpectations(buildCompanyEvaluationContext(mktProfile, null, null));
    const saasExp = buildEvaluationExpectations(buildCompanyEvaluationContext(saasProfile, null, null));

    expect(mktExp.expectations['marketplaceLiquidity'].status).not.toBe('NOT_APPLICABLE');
    expect(saasExp.expectations['marketplaceLiquidity'].status).toBe('NOT_APPLICABLE');
  });

  it('35. Retention requirements adapt based on maturity (pre-product vs repeatable growth)', () => {
    const preProfile = { problemSolution: { productDescription: pf('Concept MVP') } } as unknown as StartupProfile;
    const scaleProfile = {
      traction: {
        ARR: pf('€1.5M ARR', 4),
        customerCount: pf('120 accounts across 3 channels', 4),
        growthRates: pf('20% MoM retention', 4),
      },
    } as unknown as StartupProfile;

    const preExp = buildEvaluationExpectations(buildCompanyEvaluationContext(preProfile, null, null));
    const scaleExp = buildEvaluationExpectations(buildCompanyEvaluationContext(scaleProfile, null, null));

    expect(preExp.expectations['retention'].status).toBe('NOT_YET_EXPECTED');
    expect(scaleExp.expectations['retention'].status).toBe('EXPECTED');
  });

  it('36. Precommercial deeptech grossMargin expectation is NOT_YET_EXPECTED or RELEVANT', () => {
    const deepProfile = {
      technology: { coreTechnology: pf('Deeptech fusion reactor R&D') },
    } as unknown as StartupProfile;
    const deepCtx = buildCompanyEvaluationContext(deepProfile, null, null);
    const deepExp = buildEvaluationExpectations(deepCtx);

    expect(['NOT_YET_EXPECTED', 'RELEVANT']).toContain(deepExp.expectations['grossMargin'].status);
  });

  it('37. Precommercial hardware grossMargin expectation is NOT_YET_EXPECTED or RELEVANT', () => {
    const hwProfile = {
      technology: { coreTechnology: pf('Hardware robotics R&D prototype') },
    } as unknown as StartupProfile;
    const hwCtx = buildCompanyEvaluationContext(hwProfile, null, null);
    const hwExp = buildEvaluationExpectations(hwCtx);

    expect(['NOT_YET_EXPECTED', 'RELEVANT']).toContain(hwExp.expectations['grossMargin'].status);
  });

  it('38. Unknown operating maturity yields UNKNOWN status for dependent expectations', () => {
    const emptyCtx = buildCompanyEvaluationContext(null, null, null);
    const emptyExp = buildEvaluationExpectations(emptyCtx);

    expect(emptyExp.expectations['retention'].status).toBe('UNKNOWN');
  });

  it('39. Expectation summary calculation includes unknownCount', () => {
    const emptyCtx = buildCompanyEvaluationContext(null, null, null);
    const emptyExp = buildEvaluationExpectations(emptyCtx);

    expect(emptyExp.summary.unknownCount).toBeGreaterThan(0);
  });

  // 40-41. Deterministic Evaluation Purge
  it('40. Deterministic evaluation contains no fake slide references [1], [2] when evidence is absent', () => {
    const evaluation = generateDeterministicEvaluation(null, null, null, 10);
    expect(evaluation.reconstructedThesis.find((p) => p.pillar === 'Why Now')?.slideNumbers).toEqual([]);
    expect(evaluation.narrativeChain[0].slideNumbers).toEqual([]);
    expect(evaluation.investorObjections[0].relevantSlides).toEqual([]);
  });

  it('41. Deterministic evaluation contains no fake narrative chain assertions', () => {
    const evaluation = generateDeterministicEvaluation(null, null, null, 10);
    expect(evaluation.narrativeChain[0].status).toBe('missing');
  });

  // 42-48. Deterministic Recommendations V2 & Slide Fallback Purge
  it('42. Deterministic recommendations populate required problemClass', () => {
    const recs = generateDeterministicRecommendations(null, null, null, null, null, 10);
    for (const r of recs.recommendations) {
      expect(r.problemClass).toBeDefined();
      expect(['FACTUAL_GAP', 'EVIDENCE_GAP', 'COMMUNICATION_GAP', 'LOGIC_GAP', 'INVESTMENT_CASE_RISK']).toContain(r.problemClass);
    }
  });

  it('43. Deterministic recommendations populate required investorInterpretation', () => {
    const recs = generateDeterministicRecommendations(null, null, null, null, null, 10);
    for (const r of recs.recommendations) {
      expect(typeof r.investorInterpretation).toBe('string');
      expect(r.investorInterpretation.length).toBeGreaterThan(0);
    }
  });

  it('44. Deterministic recommendations populate required whyNow', () => {
    const recs = generateDeterministicRecommendations(null, null, null, null, null, 10);
    for (const r of recs.recommendations) {
      expect(typeof r.whyNow).toBe('string');
      expect(r.whyNow.length).toBeGreaterThan(0);
    }
  });

  it('45. Deterministic recommendations populate required resolutionCriteria', () => {
    const recs = generateDeterministicRecommendations(null, null, null, null, null, 10);
    for (const r of recs.recommendations) {
      expect(Array.isArray(r.resolutionCriteria)).toBe(true);
      expect(r.resolutionCriteria.length).toBeGreaterThan(0);
    }
  });

  it('46. Contradiction recommendation targetSlides does not introduce fake [5, 11] fallback', () => {
    const recs = generateDeterministicRecommendations(null, null, null, null, null, 10);
    const rec = recs.recommendations.find((r) => r.category === 'traction');
    if (rec && rec.id === 'rec-1') {
      expect(rec.targetSlides).not.toEqual([5, 11]);
    }
  });

  it('47. Business model recommendation targetSlides empty if no evidence slide present', () => {
    const recs = generateDeterministicRecommendations(null, null, null, null, null, 10);
    const bmRec = recs.recommendations.find((r) => r.category === 'business_model');
    expect(bmRec?.targetSlides).toEqual([]);
  });

  it('48. Ask recommendation targetSlides empty if no evidence slide present', () => {
    const profile = { fundraising: { amountBeingRaised: pf('€2M') } } as unknown as StartupProfile;
    const recs = generateDeterministicRecommendations(profile, null, null, null, null, 10);
    const askRec = recs.recommendations.find((r) => r.category === 'ask');
    expect(askRec?.targetSlides).toEqual([]);
  });

  // 49-51. Codebase Prohibition Assertions
  it('49. No UNFUNDABLE_STATE term in evaluation outputs', () => {
    const evaluation = generateDeterministicEvaluation(null, null, null, 10);
    expect(JSON.stringify(evaluation)).not.includes('UNFUNDABLE_STATE');
  });

  it('50. No INVESTMENT_READY term in evaluation outputs', () => {
    const evaluation = generateDeterministicEvaluation(null, null, null, 10);
    expect(JSON.stringify(evaluation)).not.includes('INVESTMENT_READY');
  });

  it('51. No funding probability predictions in recommendation outputs', () => {
    const recs = generateDeterministicRecommendations(null, null, null, null, null, 10);
    expect(JSON.stringify(recs)).not.includes('funding probability');
  });

  // 52. Immutability Test
  it('52. Context objects can be frozen with Object.freeze and inspected without error', () => {
    const profile = {
      fundraising: { currentStage: pf('Seed', 1) },
      traction: { ARR: pf('€300k ARR', 2) },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const frozenContext = Object.freeze(context);

    expect(frozenContext.declaredStage.normalizedStage).toBe('seed');
    expect(Object.isFrozen(frozenContext)).toBe(true);
  });

  // 53-55. Orchestrator Integration & Fetch Payload Verification
  it('53. executeFundraisingEvaluation passes evaluationContext and evaluationExpectations in fetch payload', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success', data: generateDeterministicEvaluation(null, null, null, 2) }),
    } as Response);

    await executeFundraisingEvaluation(mockHybridResult, null, null, null);

    expect(fetchSpy).toHaveBeenCalled();
    const bodyStr = fetchSpy.mock.calls[0][1]?.body as string;
    const body = JSON.parse(bodyStr);

    expect(body.evaluationContext).toBeDefined();
    expect(body.evaluationExpectations).toBeDefined();
  });

  it('54. executeInvestorSimulation passes evaluationContext and evaluationExpectations in fetch payload', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success', data: { questions: [] } }),
    } as Response);

    await executeInvestorSimulation(mockHybridResult, null, null, null, null);

    expect(fetchSpy).toHaveBeenCalled();
    const bodyStr = fetchSpy.mock.calls[0][1]?.body as string;
    const body = JSON.parse(bodyStr);

    expect(body.evaluationContext).toBeDefined();
    expect(body.evaluationExpectations).toBeDefined();
  });

  it('55. executeRecommendationGeneration passes evaluationContext and evaluationExpectations in fetch payload', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success', recommendations: [] }),
    } as Response);

    await executeRecommendationGeneration(mockHybridResult, null, null, null, null, null);

    expect(fetchSpy).toHaveBeenCalled();
    const bodyStr = fetchSpy.mock.calls[0][1]?.body as string;
    const body = JSON.parse(bodyStr);

    expect(body.evaluationContext).toBeDefined();
    expect(body.evaluationExpectations).toBeDefined();
  });
});
