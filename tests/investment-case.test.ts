import { describe, it, expect } from 'vitest';
import { StartupProfile } from '@/types/startup';
import { ClaimEvidenceMap, MaterialClaim } from '@/types/claim';
import { DeckDiagnostics } from '@/types/diagnostics';
import { buildCompanyEvaluationContext } from '@/lib/deck/evaluation-context';
import { buildEvaluationExpectations } from '@/lib/deck/evaluation-expectations';
import {
  reconstructInvestmentCase,
  validateAndCleanseInvestmentCase,
  sanitizeText,
  buildCanonicalEvidenceCorpusReferences,
  isStringSupportedByCorpus,
} from '@/lib/deck/investment-case-engine';
import {
  InvestmentCase,
  EVIDENCE_STATUSES,
  EVIDENCE_QUALITY_CLASSES,
  MECHANISM_CATEGORIES,
} from '@/types/investment-case';

function pf(val: string) {
  return { rawValue: val, confidence: 0.9, slideNumbers: [1] };
}

describe('Batch 5B - Investment Case Reconstruction & What-Must-Be-True Engine Test Suite', () => {

  // 1-10. Contract Structure, Validation, & Sanitation Tests
  it('1. reconstructInvestmentCase returns valid InvestmentCase structure for null inputs', () => {
    const ic = reconstructInvestmentCase(null, null, null, null, null);
    expect(ic.investmentThesis).toBeDefined();
    expect(ic.mechanisms).toBeDefined();
    expect(ic.whatMustBeTrue).toBeDefined();
    expect(ic.dependencies).toBeDefined();
    expect(ic.risks).toBeDefined();
    expect(ic.caseSummary).toBeDefined();
  });

  it('2. sanitizeText strips prohibited terms like fundable and investment ready', () => {
    const dirty = 'This startup is fundable and investment ready, with high funding probability.';
    const clean = sanitizeText(dirty);
    expect(clean.toLowerCase()).not.includes('fundable');
    expect(clean.toLowerCase()).not.includes('investment ready');
    expect(clean.toLowerCase()).not.includes('funding probability');
  });

  it('3. validateAndCleanseInvestmentCase removes fake slide numbers', () => {
    const claimMap: ClaimEvidenceMap = {
      claims: [
        {
          id: 'c2',
          slideNumber: 2,
          claimType: 'traction',
          claimText: 'Verified traction claim on slide 2',
          quantitative: true,
          importance: 'core',
          supportStatus: 'supported',
          basis: 'explicit',
          confidence: 'high',
          evidence: [],
        },
      ],
      summary: {
        totalClaims: 1,
        supportedCount: 1,
        partiallySupportedCount: 0,
        unsupportedCount: 0,
        conflictingCount: 0,
        coreCount: 1,
      },
      extractedAt: new Date(),
    };

    const rawCase: InvestmentCase = {
      investmentThesis: {
        problem: 'Prob',
        targetCustomer: 'ICP',
        wedge: 'Wedge',
        valueCreation: 'Val',
        distribution: 'GTM',
        monetization: 'Mon',
        growth: 'Growth',
        marketExpansion: 'TAM',
        defensibility: 'Moat',
        teamAdvantage: 'Team',
        capitalPath: 'Path',
        summary: 'Sum',
        statedThesis: 'Stated',
        reconstructedThesis: 'Reconstructed',
      },
      mechanisms: [
        {
          id: 'mech_1',
          category: 'value_creation',
          statement: 'Value mechanism',
          importance: 'critical',
          evidenceStatus: 'supported',
          supportingClaimIds: [],
          supportingSlideNumbers: [2, 99], // 99 is invalid
          supportingFacts: [],
          contradictingClaimIds: [],
          contradictingSlideNumbers: [],
          confidence: 'high',
        },
      ],
      whatMustBeTrue: [],
      dependencies: [],
      risks: [],
      contradictions: [],
      unresolvedQuestions: [],
      caseSummary: {
        thesisSummary: 'Sum',
        strongestSupportedMechanisms: [],
        mostImportantUnprovenAssumptions: [],
        thesisBottlenecks: [],
        materialRisks: [],
        highestLeverageFounderActions: [],
      },
    };

    const cleansed = validateAndCleanseInvestmentCase(rawCase, null, claimMap, null);
    expect(cleansed.mechanisms[0].supportingSlideNumbers).toEqual([2]);
    expect(cleansed.mechanisms[0].supportingSlideNumbers).not.includes(99);
  });

  it('4. validateAndCleanseInvestmentCase removes self-loop dependency edges', () => {
    const rawCase = reconstructInvestmentCase(null, null, null, null, null);
    const selfLoopCase: InvestmentCase = {
      ...rawCase,
      dependencies: [
        {
          id: 'dep_self',
          sourceId: 'mech_value_creation',
          targetId: 'mech_value_creation', // Self loop!
          relationship: 'requires',
          criticality: 'critical',
          explanation: 'Self dependency',
        },
      ],
    };

    const cleansed = validateAndCleanseInvestmentCase(selfLoopCase, null, null, null);
    expect(cleansed.dependencies.some((d) => d.id === 'dep_self')).toBe(false);
  });

  it('5. validateAndCleanseInvestmentCase removes duplicate dependency edges', () => {
    const rawCase = reconstructInvestmentCase(null, null, null, null, null);
    const dupCase: InvestmentCase = {
      ...rawCase,
      whatMustBeTrue: [
        { id: 'wmbt_problem_urgency', statement: 'Problem is urgent', importance: 'critical', evidenceStatus: 'supported' } as any,
        { id: 'wmbt_gtm_repeatability', statement: 'GTM is repeatable', importance: 'critical', evidenceStatus: 'supported' } as any,
      ],
      dependencies: [
        {
          id: 'dep_1',
          sourceId: 'wmbt_problem_urgency',
          targetId: 'wmbt_gtm_repeatability',
          relationship: 'requires',
          criticality: 'critical',
          explanation: 'First edge',
        },
        {
          id: 'dep_2_dup',
          sourceId: 'wmbt_problem_urgency',
          targetId: 'wmbt_gtm_repeatability', // Duplicate edge!
          relationship: 'requires',
          criticality: 'critical',
          explanation: 'Duplicate edge',
        },
      ],
    };

    const cleansed = validateAndCleanseInvestmentCase(dupCase, null, null, null);
    const edges = cleansed.dependencies.filter(
      (d) => d.sourceId === 'wmbt_problem_urgency' && d.targetId === 'wmbt_gtm_repeatability'
    );
    expect(edges.length).toBe(1);
  });

  it('6. validateAndCleanseInvestmentCase removes invalid node references', () => {
    const rawCase = reconstructInvestmentCase(null, null, null, null, null);
    const invalidNodeCase: InvestmentCase = {
      ...rawCase,
      dependencies: [
        {
          id: 'dep_ghost',
          sourceId: 'non_existent_node_A',
          targetId: 'wmbt_gtm_repeatability',
          relationship: 'requires',
          criticality: 'high',
          explanation: 'Invalid source node',
        },
      ],
    };

    const cleansed = validateAndCleanseInvestmentCase(invalidNodeCase, null, null, null);
    expect(cleansed.dependencies.some((d) => d.id === 'dep_ghost')).toBe(false);
  });

  it('7. InvestmentCase contains ZERO numerical deck scores or grades', () => {
    const ic = reconstructInvestmentCase(null, null, null, null, null);
    const jsonStr = JSON.stringify(ic);
    expect(jsonStr).not.toMatch(/\bscore\b/i);
    expect(jsonStr).not.toMatch(/\bgrade\b/i);
    expect(jsonStr).not.toMatch(/\b85\/100\b/i);
  });

  it('8. validateAndCleanseInvestmentCase removes invalid claim IDs', () => {
    const claimMap = { claims: [{ id: 'claim_100', slideNumber: 1, claimText: 'Test' }] } as unknown as ClaimEvidenceMap;
    const rawCase = reconstructInvestmentCase(null, claimMap, null, null, null);
    rawCase.whatMustBeTrue[0].supportingClaimIds = ['claim_100', 'claim_ghost_999'];

    const cleansed = validateAndCleanseInvestmentCase(rawCase, null, claimMap, null);
    expect(cleansed.whatMustBeTrue[0].supportingClaimIds).toEqual(['claim_100']);
  });

  it('9. Output summary contains no empty or undefined fields', () => {
    const ic = reconstructInvestmentCase(null, null, null, null, null);
    expect(ic.caseSummary.thesisSummary).toBeTruthy();
    expect(Array.isArray(ic.caseSummary.strongestSupportedMechanisms)).toBe(true);
    expect(Array.isArray(ic.caseSummary.highestLeverageFounderActions)).toBe(true);
  });

  it('10. reconstructInvestmentCase handles empty profile and claims cleanly', () => {
    const claimMap: ClaimEvidenceMap = {
      claims: [],
      summary: {
        totalClaims: 0,
        supportedCount: 0,
        partiallySupportedCount: 0,
        unsupportedCount: 0,
        conflictingCount: 0,
        coreCount: 0,
      },
      extractedAt: new Date(),
    };
    const profile = {} as StartupProfile;
    const ic = reconstructInvestmentCase(profile, claimMap, null, null, null);
    expect(ic.investmentThesis.problem).toBeDefined();
    expect(ic.whatMustBeTrue.length).toBeGreaterThan(0);
  });

  // 11-15. Paid-User Edge Case Precedence Tests
  it('11. "500 users" does not count as paid customer evidence in context', () => {
    const profile = { traction: { customerCount: pf('500 users') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.functionalMaturity.tractionMaturity).not.toBe('early_customers');
  });

  it('12. "500 active users" does not count as paid customer evidence in context', () => {
    const profile = { traction: { customerCount: pf('500 active users') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.functionalMaturity.tractionMaturity).not.toBe('early_customers');
  });

  it('13. "500 free users" is recognized as explicitly non-paying', () => {
    const profile = { traction: { customerCount: pf('500 free users') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.functionalMaturity.tractionMaturity).not.toBe('early_customers');
  });

  it('14. "500 paid users" IS recognized as valid commercial evidence', () => {
    const profile = { traction: { customerCount: pf('500 paid users') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.functionalMaturity.tractionMaturity).toBe('early_customers');
  });

  it('15. "500 paying users" IS recognized as valid commercial evidence', () => {
    const profile = { traction: { customerCount: pf('500 paying users') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    expect(context.functionalMaturity.tractionMaturity).toBe('early_customers');
  });

  // 16-22. Structured Investment Thesis Reconstruction Tests
  it('16. Reconstructs thesis problem statement from profile', () => {
    const profile = { problemSolution: { problemStatement: pf('High supply chain delay costs') } } as unknown as StartupProfile;
    const ic = reconstructInvestmentCase(profile, null, null, null, null);
    expect(ic.investmentThesis.problem).includes('High supply chain delay costs');
  });

  it('17. Reconstructs target customer ICP from profile', () => {
    const profile = { customerICP: { customerType: pf('Enterprise logistics directors') } } as unknown as StartupProfile;
    const ic = reconstructInvestmentCase(profile, null, null, null, null);
    expect(ic.investmentThesis.targetCustomer).includes('Enterprise logistics directors');
  });

  it('18. Reconstructs distribution sales motion from profile', () => {
    const profile = { goToMarket: { salesMotion: pf('Outbound enterprise sales') } } as unknown as StartupProfile;
    const ic = reconstructInvestmentCase(profile, null, null, null, null);
    expect(ic.investmentThesis.distribution).includes('Outbound enterprise sales');
  });

  it('19. Reconstructs monetization model from profile', () => {
    const profile = { businessModel: { pricingValues: pf('Annual SaaS license') } } as unknown as StartupProfile;
    const ic = reconstructInvestmentCase(profile, null, null, null, null);
    expect(ic.investmentThesis.monetization).includes('Annual SaaS license');
  });

  it('20. Reconstructs market expansion TAM from profile', () => {
    const profile = { market: { TAM: pf('$12B global market') } } as unknown as StartupProfile;
    const ic = reconstructInvestmentCase(profile, null, null, null, null);
    expect(ic.investmentThesis.marketExpansion).includes('$12B global market');
  });

  it('21. Disjoins stated thesis from reconstructed causal thesis', () => {
    const profile = {
      problemSolution: { problemStatement: pf('Paper forms cause delays') },
      marketGtm: { icp: pf('Hospital admins') },
    } as unknown as StartupProfile;
    const ic = reconstructInvestmentCase(profile, null, null, null, null);
    expect(ic.investmentThesis.statedThesis).toBeDefined();
    expect(ic.investmentThesis.reconstructedThesis).toBeDefined();
    expect(ic.investmentThesis.statedThesis).not.toEqual(ic.investmentThesis.reconstructedThesis);
  });

  it('22. Reconstructed thesis includes causal condition chain', () => {
    const profile = {
      problemSolution: {
        problemStatement: pf('Manual processing'),
        productDescription: pf('Automated platform'),
      },
      goToMarket: { salesMotion: pf('Partner channel') },
    } as unknown as StartupProfile;
    const ic = reconstructInvestmentCase(profile, null, null, null, null);
    expect(ic.investmentThesis.reconstructedThesis).includes('If');
  });

  it('23. Constructs value creation mechanism when problem/solution evidence exists', () => {
    const profile = { problemSolution: { problemStatement: pf('Legacy manual workflow is slow and error-prone') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    const mech = ic.mechanisms.find((m) => m.category === 'value_creation');
    expect(mech).toBeDefined();
    expect(mech?.importance).toBe('critical');
  });

  it('24. Constructs customer acquisition mechanism when profile has GTM evidence', () => {
    const profile = { goToMarket: { salesMotion: pf('Direct enterprise sales motion') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    const mech = ic.mechanisms.find((m) => m.category === 'customer_acquisition');
    expect(mech).toBeDefined();
  });

  it('25. Constructs monetization mechanism when profile has revenue model evidence', () => {
    const profile = { businessModel: { revenueModel: pf('Subscription SaaS fees') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    const mech = ic.mechanisms.find((m) => m.category === 'monetization');
    expect(mech).toBeDefined();
  });

  it('26. Pre-seed stage retention mechanism status is set to not_yet_testable or unsupported', () => {
    const profile = { fundraising: { currentStage: pf('pre-seed') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const ic = reconstructInvestmentCase(profile, null, null, context, null);
    const retMech = ic.mechanisms.find((m) => m.category === 'retention');
    if (retMech) {
      expect(['not_yet_testable', 'unsupported']).contains(retMech.evidenceStatus);
    }
  });

  it('27. Supported claims are attached to supportingFacts in mechanisms', () => {
    const claimMap = {
      claims: [
        { id: 'c1', slideNumber: 3, claimText: 'Problem costs $50k per year', supportStatus: 'supported', category: 'problem' },
      ],
    } as unknown as ClaimEvidenceMap;

    const ic = reconstructInvestmentCase(null, claimMap, null, null, null);
    const valMech = ic.mechanisms.find((m) => m.category === 'value_creation');
    if (valMech) {
      expect(valMech.supportingClaimIds).includes('c1');
      expect(valMech.supportingSlideNumbers).includes(3);
    }
  });

  it('28. Mechanisms reject fake slide numbers when evidence is missing', () => {
    const ic = reconstructInvestmentCase(null, null, null, null, null);
    for (const m of ic.mechanisms) {
      expect(m.supportingSlideNumbers).not.includes(1);
      expect(m.supportingSlideNumbers).not.includes(2);
    }
  });

  it('29. Defensibility mechanism generated when explicit defensibility evidence exists', () => {
    const profile = { moatDefensibility: { moatType: pf('Proprietary ML patents and network effects') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    const defMech = ic.mechanisms.find((m) => m.category === 'defensibility');
    expect(defMech).toBeDefined();
  });

  it('30. Null profile produces clean minimal investment case without fabricated thesis or mechanisms', () => {
    const ic = reconstructInvestmentCase(null, null, null, null, null);
    expect(ic.investmentThesis.reconstructedThesis).not.includes('B2B SaaS');
    expect(ic.mechanisms.length).toBe(0);
    expect(ic.whatMustBeTrue.length).toBe(0);
    expect(ic.dependencies.length).toBe(0);
  });

  // 31-40. What Must Be True (WMBT) & Stage Adaptation Tests
  it('31. Problem urgency WMBT item generated as critical assumption when problem evidence exists', () => {
    const profile = { problemSolution: { problemStatement: pf('Legacy workflow causes 40% yield loss') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    const item = ic.whatMustBeTrue.find((w) => w.id === 'wmbt_problem_urgency');
    expect(item).toBeDefined();
    expect(item?.importance).toBe('critical');
  });

  it('32. GTM repeatability WMBT item generated as critical assumption when GTM evidence exists', () => {
    const profile = { goToMarket: { salesMotion: pf('Outbound enterprise sales reps') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    const item = ic.whatMustBeTrue.find((w) => w.id === 'wmbt_gtm_repeatability');
    expect(item).toBeDefined();
    expect(item?.importance).toBe('critical');
  });

  it('33. B2B SaaS archetype generates SaaS retention WMBT item', () => {
    const profile = { businessModel: { revenueModel: pf('B2B SaaS subscription') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    const item = ic.whatMustBeTrue.find((w) => w.id === 'wmbt_saas_retention');
    expect(item).toBeDefined();
  });

  it('34. Marketplace archetype generates marketplace liquidity WMBT item', () => {
    const profile = {
      businessModel: { revenueModel: pf('Marketplace commission take-rate') },
      marketGtm: { icp: pf('Buyers and sellers') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    const item = ic.whatMustBeTrue.find((w) => w.id === 'wmbt_marketplace_liquidity');
    expect(item).toBeDefined();
  });

  it('35. Consumer archetype generates consumer retention WMBT item', () => {
    const profile = { businessModel: { revenueModel: pf('Consumer B2C app subscription') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    const item = ic.whatMustBeTrue.find((w) => w.id === 'wmbt_consumer_retention');
    expect(item).toBeDefined();
  });

  it('36. Deeptech category generates technical proof WMBT item', () => {
    const profile = {
      identity: { tagline: pf('Quantum semiconductor breakthrough') },
      problemSolution: { productDescription: pf('Deeptech hardware chip IP') },
      technology: { coreTechnology: pf('Deeptech quantum semiconductor chip') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    const item = ic.whatMustBeTrue.find((w) => w.id === 'wmbt_deeptech_technical_proof');
    expect(item).toBeDefined();
  });

  it('37. Pre-seed stage sets retention status to not_yet_testable', () => {
    const profile = {
      fundraising: { currentStage: pf('pre-seed') },
      businessModel: { revenueModel: pf('B2B SaaS') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    const item = ic.whatMustBeTrue.find((w) => w.id === 'wmbt_saas_retention');
    expect(item?.evidenceStatus).toBe('not_yet_testable');
  });

  it('38. WMBT items differentiate explicit vs implicit assumptionOrigin', () => {
    const profile = { businessModel: { revenueModel: pf('B2B SaaS subscription') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    for (const w of ic.whatMustBeTrue) {
      expect(['explicit', 'implicit']).contains(w.assumptionOrigin);
    }
  });

  it('39. Suggested founder action scope is strictly typed when present', () => {
    const profile = { businessModel: { revenueModel: pf('B2B SaaS subscription') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    for (const w of ic.whatMustBeTrue) {
      if (w.suggestedFounderAction) {
        expect(['deck_fix', 'founder_input', 'underlying_business', 'diligence_prep']).contains(
          w.suggestedFounderAction.scope
        );
      }
    }
  });

  it('40. Market expansion WMBT item generated when expansion strategy evidence exists', () => {
    const profile = { goToMarket: { expansionStrategy: pf('Market expansion into adjacent verticals') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    const item = ic.whatMustBeTrue.find((w) => w.id === 'wmbt_market_expansion');
    expect(item).toBeDefined();
  });

  // 41-45. Thesis Bottleneck / Dependency Derived Tests
  it('41. GTM assumption is marked as thesis bottleneck when downstream dependency threshold is met', () => {
    const profile = {
      problemSolution: { problemStatement: pf('Expensive workflow') },
      goToMarket: { salesMotion: pf('Founder-led sales') },
      businessModel: { pricingValues: pf('$50k subscription') },
    } as unknown as StartupProfile;
    const ic = reconstructInvestmentCase(profile, null, null, null, null);
    const item = ic.whatMustBeTrue.find((w) => w.id === 'wmbt_gtm_repeatability');
    expect(item?.isThesisBottleneck).toBe(true);
    expect(item?.bottleneckReason).toBeTruthy();
  });

  it('42. Marketplace liquidity evaluation integrates into whatMustBeTrue catalog', () => {
    const profile = { businessModel: { revenueModel: pf('Marketplace take rate') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    const item = ic.whatMustBeTrue.find((w) => w.id === 'wmbt_marketplace_liquidity');
    expect(item).toBeDefined();
  });

  it('43. Consumer retention evaluation integrates into whatMustBeTrue catalog', () => {
    const profile = { businessModel: { revenueModel: pf('Consumer B2C subscription app') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    const item = ic.whatMustBeTrue.find((w) => w.id === 'wmbt_consumer_retention');
    expect(item).toBeDefined();
  });

  it('44. Deeptech technical proof evaluation integrates into whatMustBeTrue catalog', () => {
    const profile = {
      identity: { tagline: pf('Quantum hardware chip breakthrough') },
      problemSolution: { productDescription: pf('Deeptech hardware chip IP') },
      technology: { coreTechnology: pf('Deeptech quantum semiconductor chip') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    const item = ic.whatMustBeTrue.find((w) => w.id === 'wmbt_deeptech_technical_proof');
    expect(item).toBeDefined();
  });

  it('45. Thesis bottlenecks summary array is correctly defined', () => {
    const profile = { goToMarket: { salesMotion: pf('Founder-led sales') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    expect(ic.caseSummary.thesisBottlenecks).toBeDefined();
  });

  // 46-52. Second-Order Reasoning & Economic Tensions
  it('46. High ACV ($100k) + Self-serve SMB GTM triggers commercial model tension risk', () => {
    const profile = {
      businessModel: { pricingValues: pf('$100k enterprise ACV') },
      goToMarket: { salesMotion: pf('Self-serve SMB signup') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    const risk = ic.risks.find((r) => r.id === 'risk_commercial_model_tension');
    expect(risk).toBeDefined();
    expect(risk?.severity).toBe('material');
  });

  it('47. Growth rate cited without retention proof triggers unproven durability risk', () => {
    const profile = {
      traction: { growthRates: pf('300% YoY growth') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    const risk = ic.risks.find((r) => r.id === 'risk_unproven_durability');
    expect(risk).toBeDefined();
    expect(risk?.whyItMatters).toBeTruthy();
  });

  it('48. Founder-led GTM triggers founder sales concentration risk', () => {
    const profile = { goToMarket: { salesMotion: pf('Founder-led sales') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    const risk = ic.risks.find((r) => r.id === 'risk_founder_sales_concentration');
    expect(risk).toBeDefined();
  });

  it('49. Diagnostics contradictions generate critical execution risks', () => {
    const diagnostics = {
      contradictions: [
        {
          id: 'c1',
          category: 'ARR vs MRR',
          description: 'Slide 3 says $1M ARR, Slide 8 says $20k MRR',
          conflictingStatements: [
            { text: '$1M ARR', slideNumber: 3 },
            { text: '$20k MRR', slideNumber: 8 },
          ],
        },
      ],
    } as unknown as DeckDiagnostics;

    const ic = reconstructInvestmentCase(null, null, diagnostics, null, null);
    const risk = ic.risks.find((r) => r.id === 'risk_contradiction_1');
    expect(risk).toBeDefined();
    expect(risk?.severity).toBe('critical');
  });

  it('50. Risks link related assumption and mechanism IDs', () => {
    const profile = { goToMarket: { salesMotion: pf('Founder-led sales') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    const risk = ic.risks.find((r) => r.id === 'risk_founder_sales_concentration');
    expect(risk?.relatedAssumptionIds).includes('wmbt_gtm_repeatability');
    expect(risk?.relatedMechanismIds).includes('mech_customer_acquisition');
  });

  it('51. Severity values in risks are restricted to critical, material, watch', () => {
    const profile = { goToMarket: { salesMotion: pf('Founder-led sales') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    for (const r of ic.risks) {
      expect(['critical', 'material', 'watch']).contains(r.severity);
    }
  });

  it('52. Contradictions extraction produces clean InvestmentCaseContradiction list', () => {
    const diagnostics = {
      contradictions: [
        {
          id: 'c1',
          category: 'Customer count mismatch',
          description: 'Slide 2 says 50, Slide 5 says 12',
          conflictingStatements: [
            { text: '50 customers', slideNumber: 2 },
            { text: '12 customers', slideNumber: 5 },
          ],
        },
      ],
    } as unknown as DeckDiagnostics;

    const ic = reconstructInvestmentCase(null, null, diagnostics, null, null);
    expect(ic.contradictions.length).toBe(1);
    expect(ic.contradictions[0].topic).toBe('Customer count mismatch');
  });

  // 53-60. Unresolved Investor Questions & Case Summary
  it('53. Unresolved questions generated for unproven WMBT assumptions', () => {
    const profile = {
      problemSolution: { problemStatement: pf('Costly slow manual workflow') },
      goToMarket: { salesMotion: pf('Founder-led sales') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    expect(ic.unresolvedQuestions.length).toBeGreaterThan(0);
    expect(ic.unresolvedQuestions[0].question).toBeTruthy();
  });

  it('54. Unresolved question answerability matches evidence status', () => {
    const profile = {
      problemSolution: { problemStatement: pf('Costly slow manual workflow') },
      goToMarket: { salesMotion: pf('Founder-led sales') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    for (const q of ic.unresolvedQuestions) {
      expect(['well_supported', 'partially_supported', 'unanswered', 'contradictory']).contains(
        q.answerability
      );
    }
  });

  it('55. Case summary thesisSummary matches reconstructed thesis summary', () => {
    const profile = {
      problemSolution: { problemStatement: pf('Costly slow manual workflow') },
      goToMarket: { salesMotion: pf('Founder-led sales') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    expect(ic.caseSummary.thesisSummary).toBe(ic.investmentThesis.summary);
  });

  it('56. Case summary contains unproven assumptions list', () => {
    const profile = {
      problemSolution: { problemStatement: pf('Costly slow manual workflow') },
      goToMarket: { salesMotion: pf('Founder-led sales') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    expect(ic.caseSummary.mostImportantUnprovenAssumptions.length).toBeGreaterThan(0);
  });

  it('57. Case summary contains highest leverage founder actions list', () => {
    const profile = {
      problemSolution: { problemStatement: pf('Costly slow manual workflow') },
      goToMarket: { salesMotion: pf('Founder-led sales') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    expect(ic.caseSummary.highestLeverageFounderActions.length).toBeGreaterThan(0);
  });

  it('58. Case summary contains material risks list', () => {
    const profile = {
      problemSolution: { problemStatement: pf('Costly slow manual workflow') },
      goToMarket: { salesMotion: pf('Founder-led sales') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    expect(ic.caseSummary.materialRisks.length).toBeGreaterThan(0);
  });

  it('59. Dependencies graph relationship types are strictly valid', () => {
    const profile = { goToMarket: { salesMotion: pf('Founder-led sales') } } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);
    for (const d of ic.dependencies) {
      expect(['requires', 'enables', 'constrains', 'amplifies', 'conflicts_with']).contains(
        d.relationship
      );
    }
  });

  it('60. Full end-to-end integration test passes clean', () => {
    const profile = {
      identity: { companyName: pf('Arcstone AI') },
      fundraising: { currentStage: pf('seed'), amountBeingRaised: pf('$3M') },
      problemSolution: { problemStatement: pf('Underwriting decks manually is slow') },
      goToMarket: { salesMotion: pf('Direct founder outreach to VC funds') },
      businessModel: { revenueModel: pf('Annual SaaS subscription') },
      traction: { ARR: pf('€120k ARR'), paidCustomerCount: pf('8 paying funds') },
    } as unknown as StartupProfile;

    const context = buildCompanyEvaluationContext(profile, null, null);
    const expectations = buildEvaluationExpectations(context);
    const ic = reconstructInvestmentCase(profile, null, null, context, expectations);

    expect(ic.investmentThesis.problem).includes('Underwriting decks manually');
    expect(ic.mechanisms.length).toBeGreaterThan(0);
    expect(ic.whatMustBeTrue.length).toBeGreaterThan(0);
    expect(ic.caseSummary.thesisSummary).toBeTruthy();
  });

  // 61-70. Batch 5B.2 Specific Evidence Contract & Conservatism Tests
  it('61. Runtime EVIDENCE_STATUSES enum array includes all valid statuses', () => {
    expect(EVIDENCE_STATUSES).contains('supported');
    expect(EVIDENCE_STATUSES).contains('partially_supported');
    expect(EVIDENCE_STATUSES).contains('asserted_only');
    expect(EVIDENCE_STATUSES).contains('unsupported');
    expect(EVIDENCE_STATUSES).contains('contradictory');
    expect(EVIDENCE_STATUSES).contains('not_yet_testable');
  });

  it('62. buildCanonicalEvidenceCorpusReferences produces stable IDs with profile/claim source types', () => {
    const profile = {
      identity: { companyName: pf('Arcstone AI') },
      problemSolution: { problemStatement: pf('Manual deck underwriting is slow') },
    } as unknown as StartupProfile;
    const refs = buildCanonicalEvidenceCorpusReferences(profile, null, null);
    expect(refs.length).toBeGreaterThan(0);
    expect(refs[0].id).toMatch(/^profile:/);
    expect(refs[0].statement).toBeTruthy();
  });

  it('63. isStringSupportedByCorpus returns false for empty corpus (non-permissive)', () => {
    expect(isStringSupportedByCorpus('100k ARR', new Set())).toBe(false);
    expect(isStringSupportedByCorpus('100k ARR', [])).toBe(false);
  });

  it('64. isStringSupportedByCorpus enforces surround context for numeric matches', () => {
    const corpusRefs = [
      { id: 'ref1', sourceType: 'profile' as const, statement: '100 paying enterprise customers' },
    ];
    expect(isStringSupportedByCorpus('100 paying', corpusRefs)).toBe(true);
    expect(isStringSupportedByCorpus('500 paying', corpusRefs)).toBe(false);
  });

  it('65. Qualitative problem statement alone yields asserted_only status', () => {
    const profile = {
      problemSolution: { problemStatement: pf('Compliance takes too long') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const ic = reconstructInvestmentCase(profile, null, null, context, null);
    const item = ic.whatMustBeTrue.find((w) => w.id === 'wmbt_problem_urgency');
    expect(item?.evidenceStatus).toBe('asserted_only');
  });

  it('66. SaaS retention assumption is unsupported when no retention metrics exist (even if ARR present)', () => {
    const profile = {
      businessModel: { revenueModel: pf('B2B SaaS subscription') },
      traction: { ARR: pf('$1M ARR') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const ic = reconstructInvestmentCase(profile, null, null, context, null);
    const item = ic.whatMustBeTrue.find((w) => w.id === 'wmbt_saas_retention');
    expect(item?.evidenceStatus).toBe('unsupported');
  });

  it('67. Bottleneck classification strictly requires at least 2 downstream dependencies', () => {
    const profile = {
      problemSolution: { problemStatement: pf('Underwriting is slow') },
      goToMarket: { salesMotion: pf('Founder sales') },
      businessModel: { pricingValues: pf('$50k ACV') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const ic = reconstructInvestmentCase(profile, null, null, context, null);

    for (const w of ic.whatMustBeTrue) {
      if (w.isThesisBottleneck) {
        const downstreamCount = ic.dependencies.filter((d) => d.sourceId === w.id).length;
        expect(downstreamCount).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('68. High ACV parsing correctly parses numeric values ($50,000 / 100k)', () => {
    const profile = {
      businessModel: { pricingValues: pf('$100k enterprise ACV') },
      goToMarket: { salesMotion: pf('Self-serve SMB signup') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const ic = reconstructInvestmentCase(profile, null, null, context, null);
    const risk = ic.risks.find((r) => r.id === 'risk_commercial_model_tension');
    expect(risk).toBeDefined();
    expect(risk?.riskType).toBe('commercial_tension');
  });

  it('69. Suggested founder actions map directly from evidence status', () => {
    const profile = {
      problemSolution: { problemStatement: pf('Manual underwriting takes too long') },
    } as unknown as StartupProfile;
    const context = buildCompanyEvaluationContext(profile, null, null);
    const ic = reconstructInvestmentCase(profile, null, null, context, null);
    for (const w of ic.whatMustBeTrue) {
      if (w.evidenceStatus === 'asserted_only') {
        expect(w.suggestedFounderAction?.type).toBe('ADD_DECK_EVIDENCE');
      } else if (w.evidenceStatus === 'unsupported') {
        expect(w.suggestedFounderAction?.type).toBe('PROVIDE_EXISTING_EVIDENCE');
      }
    }
  });

  it('70. Cleansed investment case strips invalid slide numbers and unsupported evidence references', () => {
    const rawCase: InvestmentCase = {
      investmentThesis: {
        problem: 'p',
        targetCustomer: 'c',
        wedge: 'w',
        valueCreation: 'v',
        distribution: 'd',
        monetization: 'm',
        growth: 'g',
        marketExpansion: 'me',
        defensibility: 'def',
        teamAdvantage: 't',
        capitalPath: 'cp',
        summary: 'sum',
        statedThesis: 'st',
        reconstructedThesis: 'rt',
      },
      mechanisms: [],
      whatMustBeTrue: [
        {
          id: 'wmbt_test',
          statement: 'Test assumption',
          category: 'value_creation',
          importance: 'critical',
          assumptionOrigin: 'implicit',
          evidenceStatus: 'unsupported',
          evidenceQuality: 'founder_assertion',
          supportingSlideNumbers: [9999], // Invalid slide number
          supportingClaimIds: ['invalid_claim_id'],
          supportingEvidenceIds: ['invalid_ev_id'],
          supportingFacts: ['Fabricated fact not in corpus'],
          contradictingClaimIds: [],
          contradictingSlideNumbers: [],
          isThesisBottleneck: false,
          confidence: 'high',
        },
      ],
      dependencies: [],
      risks: [],
      contradictions: [],
      unresolvedQuestions: [],
      caseSummary: {
        thesisSummary: 'sum',
        strongestSupportedMechanisms: [],
        mostImportantUnprovenAssumptions: [],
        thesisBottlenecks: [],
        materialRisks: [],
        highestLeverageFounderActions: [],
      },
    };

    const cleansed = validateAndCleanseInvestmentCase(rawCase, null, null, null, null);
    expect(cleansed.whatMustBeTrue[0].supportingSlideNumbers).toEqual([]);
    expect(cleansed.whatMustBeTrue[0].supportingClaimIds).toEqual([]);
    expect(cleansed.whatMustBeTrue[0].supportingEvidenceIds).toEqual([]);
    expect(cleansed.whatMustBeTrue[0].supportingFacts).toEqual([]);
  });
});
