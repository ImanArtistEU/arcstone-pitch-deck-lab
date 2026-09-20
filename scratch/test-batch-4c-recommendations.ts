/**
 * Test Suite for Development Batch 4C: Actionable Founder Recommendations
 * Tests A through K
 */

import {
  selectDeterministicRecommendationSignals,
  extractKnownQuantitativeTokens,
  validateGroundedCopy,
  postProcessRecommendations,
  orderActionPlan,
  buildFounderInputChecklist,
  computeActionPlanSummary,
  generateDeterministicRecommendations,
} from '../src/lib/deck/recommendations-engine';
import {
  FounderRecommendation,
  ActionPlanResult,
} from '../src/types/recommendations';
import { StartupProfile } from '../src/types/startup';
import { ClaimEvidenceMap, MaterialClaim } from '../src/types/claim';
import { DeckDiagnostics } from '../src/types/diagnostics';
import { FundraisingEvaluation } from '../src/types/evaluation';
import { InvestorSimulatorResult } from '../src/types/simulator';

function runTests() {
  console.log('====================================================');
  console.log('RUNNING BATCH 4C TEST SUITE (TESTS A THROUGH K)');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    }
  }

  // --- Mock Fixtures ---
  const mockProfile: StartupProfile = {
    identity: {
      companyName: { status: 'extracted', rawValue: 'Nexus AI', evidence: [{ slideNumber: 1, exactText: 'Nexus AI', source: 'native_pdf' }] },
      tagline: { status: 'extracted', rawValue: 'Enterprise workflow automation', evidence: [{ slideNumber: 1, exactText: 'Enterprise workflow automation', source: 'native_pdf' }] },
      website: { status: 'not_found', evidence: [] },
      headquarters: { status: 'not_found', evidence: [] },
      foundingYear: { status: 'not_found', evidence: [] },
    },
    fundraising: {
      currentStage: { status: 'extracted', rawValue: 'Series A', evidence: [{ slideNumber: 10, exactText: 'Series A', source: 'native_pdf' }] },
      roundBeingRaised: { status: 'extracted', rawValue: 'Series A', evidence: [{ slideNumber: 10, exactText: 'Series A', source: 'native_pdf' }] },
      amountBeingRaised: { status: 'extracted', rawValue: '€5M', evidence: [{ slideNumber: 10, exactText: '€5M', source: 'native_pdf' }] },
      currency: { status: 'extracted', rawValue: 'EUR', evidence: [] },
      previousFunding: { status: 'not_found', evidence: [] },
      useOfFunds: { status: 'extracted', rawValue: '40% R&D, 40% GTM, 20% Ops', evidence: [{ slideNumber: 10, exactText: '40% R&D', source: 'native_pdf' }] },
      runway: { status: 'extracted', rawValue: '18 months', evidence: [] },
    },
    problemSolution: {
      problemStatement: { status: 'extracted', rawValue: 'Manual enterprise workflows consume hundreds of hours', evidence: [{ slideNumber: 2, exactText: 'Manual enterprise workflows', source: 'native_pdf' }] },
      targetUserPain: { status: 'not_found', evidence: [] },
      currentAlternatives: { status: 'not_found', evidence: [] },
      productDescription: { status: 'extracted', rawValue: 'Automated workflow engine for multi-system operations', evidence: [{ slideNumber: 2, exactText: 'Automated workflow engine', source: 'native_pdf' }] },
      valueProposition: { status: 'extracted', rawValue: '10x speed with zero coding setup', evidence: [{ slideNumber: 2, exactText: '10x speed', source: 'native_pdf' }] },
      keyFeatures: { status: 'not_found', evidence: [] },
      productCategory: { status: 'not_found', evidence: [] },
    },
    customerICP: {
      customerType: { status: 'extracted', rawValue: 'Enterprise operations teams', evidence: [{ slideNumber: 2, exactText: 'Enterprise operations', source: 'native_pdf' }] },
      targetSegments: { status: 'not_found', evidence: [] },
      industries: { status: 'not_found', evidence: [] },
      geography: { status: 'not_found', evidence: [] },
      buyerPersona: { status: 'not_found', evidence: [] },
      endUser: { status: 'not_found', evidence: [] },
    },
    businessModel: {
      revenueModel: { status: 'extracted', rawValue: 'Annual subscription per seat', evidence: [{ slideNumber: 3, exactText: 'Annual subscription', source: 'native_pdf' }] },
      pricingModel: { status: 'extracted', rawValue: 'Subscription', evidence: [{ slideNumber: 3, exactText: 'Subscription', source: 'native_pdf' }] },
      pricingValues: { status: 'not_found', evidence: [] },
      unitEconomics: { status: 'not_found', evidence: [] },
    },
    traction: {
      revenue: { status: 'extracted', rawValue: '€1.2M ARR', evidence: [{ slideNumber: 4, exactText: '€1.2M ARR', source: 'native_pdf' }] },
      ARR: { status: 'extracted', rawValue: '€1.2M', evidence: [{ slideNumber: 4, exactText: '€1.2M', source: 'native_pdf' }] },
      MRR: { status: 'not_found', evidence: [] },
      customerCount: { status: 'extracted', rawValue: '120 customers', evidence: [{ slideNumber: 4, exactText: '120 customers', source: 'native_pdf' }] },
      paidCustomerCount: { status: 'not_found', evidence: [] },
      userCount: { status: 'not_found', evidence: [] },
      growthRates: { status: 'extracted', rawValue: '18% MoM', evidence: [{ slideNumber: 5, exactText: '18% MoM', source: 'native_pdf' }] },
      retentionMetrics: { status: 'not_found', evidence: [] },
      churn: { status: 'not_found', evidence: [] },
      pipeline: { status: 'not_found', evidence: [] },
      notableCustomers: { status: 'not_found', evidence: [] },
    },
    goToMarket: {
      acquisitionChannels: { status: 'extracted', rawValue: 'Direct sales and inbound', evidence: [] },
      salesMotion: { status: 'not_found', evidence: [] },
      distributionStrategy: { status: 'not_found', evidence: [] },
      partnerships: { status: 'not_found', evidence: [] },
      expansionStrategy: { status: 'not_found', evidence: [] },
    },
    market: {
      TAM: { status: 'extracted', rawValue: '€8B', evidence: [{ slideNumber: 2, exactText: '€8B TAM', source: 'native_pdf' }] },
      SAM: { status: 'not_found', evidence: [] },
      SOM: { status: 'not_found', evidence: [] },
      marketGrowth: { status: 'not_found', evidence: [] },
      marketDefinition: { status: 'not_found', evidence: [] },
      marketSource: { status: 'not_found', evidence: [] },
    },
    competition: {
      namedCompetitors: { status: 'extracted', rawValue: 'Legacy RPA, Zapier', evidence: [] },
      alternatives: { status: 'not_found', evidence: [] },
      differentiationClaims: { status: 'extracted', rawValue: "Europe's fastest platform", evidence: [{ slideNumber: 9, exactText: "Europe's fastest platform", source: 'native_pdf' }] },
      positioningClaims: { status: 'not_found', evidence: [] },
    },
    team: {
      founders: [],
      teamSize: { status: 'not_found', evidence: [] },
      advisors: { status: 'not_found', evidence: [] },
    },
    technology: {
      coreTechnology: { status: 'not_found', evidence: [] },
      integrations: { status: 'not_found', evidence: [] },
      proprietaryClaims: { status: 'not_found', evidence: [] },
      aiMlClaims: { status: 'not_found', evidence: [] },
    },
    importantFacts: [],
    missingFields: ['unitEconomics'],
    extractedAt: new Date(),
  };

  const mockClaimsList: MaterialClaim[] = [
    {
      id: 'claim-tam-1',
      claimText: 'TAM is €8B across European enterprise automation',
      slideNumber: 2,
      claimType: 'market',
      supportStatus: 'unsupported',
      quantitative: true,
      importance: 'core',
      basis: 'explicit',
      confidence: 'high',
      evidence: [],
    },
    {
      id: 'claim-cust-1',
      claimText: 'Currently serve 120 enterprise customers',
      slideNumber: 4,
      claimType: 'traction',
      supportStatus: 'conflicting',
      quantitative: true,
      importance: 'core',
      basis: 'explicit',
      confidence: 'high',
      evidence: [{ id: 'ev-c4', slideNumber: 4, exactText: '120 customers', source: 'native_pdf', evidenceType: 'metric', relationship: 'Current customer count', confidence: 'high' }],
    },
    {
      id: 'claim-superlative-1',
      claimText: "Europe's fastest workflow platform",
      slideNumber: 9,
      claimType: 'competition',
      supportStatus: 'unsupported',
      quantitative: false,
      importance: 'supporting',
      basis: 'explicit',
      confidence: 'high',
      evidence: [],
    },
    {
      id: 'claim-traction-rev-1',
      claimText: '€1.2M ARR with 18% MoM revenue growth',
      slideNumber: 4,
      claimType: 'traction',
      supportStatus: 'supported',
      quantitative: true,
      importance: 'core',
      basis: 'explicit',
      confidence: 'high',
      evidence: [{ id: 'ev-c5', slideNumber: 4, exactText: '€1.2M ARR', source: 'native_pdf', evidenceType: 'metric', relationship: 'ARR metric', confidence: 'high' }],
    },
  ];

  const mockClaims: ClaimEvidenceMap = {
    claims: mockClaimsList,
    summary: {
      totalClaims: 4,
      supportedCount: 1,
      partiallySupportedCount: 0,
      unsupportedCount: 2,
      conflictingCount: 1,
      coreCount: 3,
    },
    extractedAt: new Date(),
  };

  const mockDiagnostics: DeckDiagnostics = {
    contradictions: [
      {
        id: 'diag-contra-cust',
        category: 'customer_count',
        severity: 'critical',
        description: 'Slide 4 claims 120 customers but Slide 9 claims 147.',
        conflictingStatements: [
          { slideNumber: 4, text: '120 customers', source: 'native_pdf' },
          { slideNumber: 9, text: '147 active customers', source: 'native_pdf' },
        ],
        whyConflicting: 'Inconsistent customer counts across slides in the same deck.',
        chronologyExplained: false,
        confidence: 'high',
      },
    ],
    evidenceGaps: [
      {
        id: 'diag-unsup-tam',
        claimId: 'claim-tam-1',
        claimText: 'TAM is €8B across European enterprise automation',
        claimType: 'market',
        severity: 'material',
        supportStatus: 'unsupported',
        importance: 'core',
        slideNumbers: [2],
        currentEvidenceSummary: 'Single top-down metric €8B stated without calculation.',
        missingEvidenceDescription: 'No top-down or bottom-up calculation or source citation.',
        confidence: 'high',
      },
    ],
    missingInformation: [
      {
        id: 'diag-miss-unit-econ',
        category: 'economics',
        field: 'unitEconomics',
        severity: 'material',
        context: 'No CAC, LTV, or payback period shared.',
        whyRelevant: 'Essential for evaluating Series A sales efficiency.',
      },
    ],
    ambiguities: [],
    summary: {
      totalDiagnostics: 3,
      contradictionCount: 1,
      evidenceGapCount: 1,
      missingInfoCount: 1,
      ambiguityCount: 0,
      criticalCount: 1,
      materialCount: 2,
      minorCount: 0,
    },
    extractedAt: new Date(),
  };

  const mockEvaluation: FundraisingEvaluation = {
    reconstructedThesis: [
      {
        pillar: 'Market',
        communicated: true,
        summary: 'Leading enterprise automation engine for European operations.',
        slideNumbers: [2],
      },
    ],
    dimensions: [
      {
        id: 'dim-market',
        dimensionName: 'Market Thesis',
        status: 'UNDERDEVELOPED',
        finding: '€8B TAM lacks bottom-up derivation',
        rationale: 'Top-down figure without calculation.',
        slideReferences: [2],
      },
      {
        id: 'dim-traction',
        dimensionName: 'Traction Credibility',
        status: 'CONTRADICTORY',
        finding: 'Contradiction between 120 and 147 customers',
        rationale: 'Inconsistent customer counts.',
        slideReferences: [4, 9],
      },
      {
        id: 'dim-biz',
        dimensionName: 'Business Model',
        status: 'UNDERDEVELOPED',
        finding: 'Unit economics metrics missing',
        rationale: 'No CAC or LTV details.',
        slideReferences: [3],
      },
    ],
    narrativeChain: [],
    investorObjections: [],
    strongElements: [],
    dimensionSummary: {
      strongCount: 1,
      adequateCount: 0,
      underdevelopedCount: 2,
      missingCount: 0,
      contradictoryCount: 1,
    },
    overallSynthesis: 'Developing Series A profile with strong ARR but conflicting customer count and unbacked TAM.',
    evaluatedAt: new Date(),
  };

  const mockSimulator: InvestorSimulatorResult = {
    questions: [
      {
        id: 'sim-q-cust-1',
        question: 'Slide 4 reports 120 customers while slide 9 reports 147. Which number reflects paying enterprise logos today?',
        questionType: 'TRACTION',
        priority: 'CRITICAL',
        category: 'traction',
        trigger: {
          relatedDiagnosticIds: ['diag-contra-cust'],
          relatedClaimIds: ['claim-cust-1'],
          slideNumbers: [4, 9],
          triggerSummary: 'Contradiction between slide 4 (120) and slide 9 (147)',
        },
        whyInvestorAsks: 'Assessing accuracy of reported metrics and potential metric padding.',
        currentAnswerability: 'CONTRADICTORY',
        availableEvidence: [
          { slideNumber: 4, statement: '120 customers', source: 'native_pdf' },
          { slideNumber: 9, statement: '147 active customers', source: 'native_pdf' },
        ],
        missingInformation: ['Exact count of paying contracted customers'],
        preparationGuidance: 'Explicitly state the exact paid customer count and explain the 147 includes pilots.',
        likelyFollowUps: ['What is the breakdown by ARR tier?'],
        confidence: 'high',
      },
      {
        id: 'sim-q-tam-1',
        question: 'How do you derive the €8B TAM for European enterprise automation bottom-up?',
        questionType: 'EVIDENCE',
        priority: 'HIGH',
        category: 'market',
        trigger: {
          relatedDiagnosticIds: ['diag-unsup-tam'],
          relatedClaimIds: ['claim-tam-1'],
          slideNumbers: [2],
          triggerSummary: '€8B TAM lacks methodology',
        },
        whyInvestorAsks: 'Unsubstantiated top-down TAMs signal weak commercial realism.',
        currentAnswerability: 'UNANSWERED',
        availableEvidence: [
          { slideNumber: 2, statement: '€8B TAM total addressable market', source: 'native_pdf' },
        ],
        missingInformation: ['Target accounts count and assumed ACV'],
        preparationGuidance: 'Walk through bottom-up calculation based on enterprise accounts in EU.',
        likelyFollowUps: ['What is your current ACV today?'],
        confidence: 'high',
      },
    ],
    summary: {
      totalQuestions: 2,
      wellSupportedCount: 0,
      partiallySupportedCount: 0,
      weaklySupportedCount: 0,
      unansweredCount: 1,
      contradictoryCount: 1,
      mostExposedAreas: ['traction', 'market'],
    },
    generatedAt: new Date(),
  };

  // =========================================================================
  // TEST A: Unsupported TAM thesis (€8B TAM without derivation)
  // =========================================================================
  console.log('--- Test A: Unsupported TAM Market Sizing ---');
  const signals = selectDeterministicRecommendationSignals(
    mockProfile,
    mockClaims,
    mockDiagnostics,
    mockEvaluation,
    mockSimulator
  );
  assert(signals.unsupportedClaimCount >= 1, 'Test A.1: TAM unsupported signal detected');

  const deterministicResult = generateDeterministicRecommendations(
    mockProfile,
    mockClaims,
    mockDiagnostics,
    mockEvaluation,
    mockSimulator,
    10
  );
  const deterministicRecs = deterministicResult.recommendations;

  const tamRec = deterministicRecs.find((r) => r.category === 'market');
  assert(tamRec !== undefined, 'Test A.2: Action plan creates recommendation for TAM substantiation');
  assert(tamRec?.founderInputRequired === true, 'Test A.3: TAM recommendation requires founder input');
  assert(
    tamRec?.missingInformation !== undefined && tamRec.missingInformation.length > 0,
    'Test A.4: TAM recommendation lists missing derivation info'
  );

  // =========================================================================
  // TEST B: Consolidation of existing traction evidence across slides
  // =========================================================================
  console.log('\n--- Test B: Existing Evidence Consolidation ---');
  const tractionRec = deterministicRecs.find((r) => r.category === 'traction' && r.actionType === 'RESTRUCTURE_NARRATIVE');
  assert(tractionRec !== undefined, 'Test B.1: Traction narrative restructuring recommendation generated');
  assert(Boolean(tractionRec?.targetSlides.includes(4) || tractionRec?.targetSlides.includes(5)), 'Test B.2: Targets traction slides');
  assert(
    tractionRec?.suggestedStructure?.supportingMetrics !== undefined &&
      tractionRec.suggestedStructure.supportingMetrics.some((m) => m.includes('1.2M') || m.includes('18% MoM')),
    'Test B.3: Grounded suggested structure incorporates existing verified metrics (€1.2M ARR, 18% MoM)'
  );

  // =========================================================================
  // TEST C: Contradiction handling (120 vs 147 customers)
  // =========================================================================
  console.log('\n--- Test C: Contradiction Handling ---');
  const contraRec = deterministicRecs.find((r) => r.actionType === 'RESOLVE_CONTRADICTION');
  assert(contraRec !== undefined, 'Test C.1: Contradiction recommendation generated');
  assert(contraRec?.priority === 'CRITICAL', 'Test C.2: Contradiction is CRITICAL priority');
  assert(Boolean(contraRec?.targetSlides.includes(4) && contraRec?.targetSlides.includes(9)), 'Test C.3: Target slides include conflicting slides 4 and 9');
  assert(contraRec?.founderInputRequired === true, 'Test C.4: Contradiction requires founder input to reconcile');

  // =========================================================================
  // TEST D: Missing critical information (unit economics / pricing)
  // =========================================================================
  console.log('\n--- Test D: Missing Critical Information ---');
  const unitEconRec = deterministicRecs.find((r) => r.category === 'business_model');
  assert(unitEconRec !== undefined, 'Test D.1: Business model recommendation generated');
  assert(unitEconRec?.founderInputRequired === true, 'Test D.2: Missing data requires founder input');
  assert(
    unitEconRec?.missingInformation !== undefined &&
      unitEconRec.missingInformation.some((m) => m.toLowerCase().includes('cac') || m.toLowerCase().includes('pricing') || m.toLowerCase().includes('unit') || m.toLowerCase().includes('ltv')),
    'Test D.3: Missing information checklist enumerates missing commercial metrics'
  );

  // =========================================================================
  // TEST E: Unsupported superlative / competitive claim ("Europe's fastest platform")
  // =========================================================================
  console.log('\n--- Test E: Superlative Qualification ---');
  const qualRec = deterministicRecs.find((r) => r.actionType === 'REMOVE_OR_QUALIFY_CLAIM');
  assert(qualRec !== undefined, 'Test E.1: REMOVE_OR_QUALIFY_CLAIM action type emitted');
  assert(Boolean(qualRec?.targetSlides.includes(9)), 'Test E.2: Targets slide 9 where superlative appears');
  assert(
    qualRec?.suggestedCopy === undefined || !qualRec.suggestedCopy.suggestedText.includes("Europe's fastest platform"),
    'Test E.3: Does not endorse unverified superlative in suggested rewrite'
  );

  // =========================================================================
  // TEST F: Grounded suggested copy guardrails
  // =========================================================================
  console.log('\n--- Test F: Factual Copy Guardrails ---');
  const knownTokens = extractKnownQuantitativeTokens(mockProfile, mockClaims);
  assert(knownTokens.has('120') && knownTokens.has('1.2m'), 'Test F.1: Known quantitative tokens extracted');

  const validCopy = 'Nexus AI generates €1.2M ARR with 18% MoM expansion across 120 enterprise customers.';
  const invalidCopy = 'Nexus AI achieves 96% net revenue retention with €45k LTV and 4-month payback.';

  const validRes = validateGroundedCopy(validCopy, knownTokens, ['€1.2M ARR', '18% MoM', '120 customers']);
  const invalidRes = validateGroundedCopy(invalidCopy, knownTokens, ['€1.2M ARR', '18% MoM', '120 customers']);

  assert(validRes.isValid === true, 'Test F.2: Valid grounded copy with known metrics passes');
  assert(invalidRes.isValid === false, 'Test F.3: Fabricated copy with unknown metrics is blocked');

  // =========================================================================
  // TEST G: Investor question integration
  // =========================================================================
  console.log('\n--- Test G: Investor Question Preemption ---');
  const recsWithInvQ = deterministicRecs.filter((r) => r.relatedInvestorQuestions.length > 0);
  assert(recsWithInvQ.length > 0, 'Test G.1: Recommendations link related investor questions');
  assert(
    contraRec?.relatedInvestorQuestions.includes('sim-q-cust-1') === true,
    'Test G.2: Customer contradiction recommendation links simulation question sim-q-cust-1'
  );

  // =========================================================================
  // TEST H: Dependency ordering & execution order
  // =========================================================================
  console.log('\n--- Test H: Dependency Ordering ---');
  const ordered = orderActionPlan(deterministicRecs);
  assert(ordered.length === deterministicRecs.length, 'Test H.1: All recommendations preserved in ordering');

  const contraIdx = ordered.findIndex((r) => r.actionType === 'RESOLVE_CONTRADICTION');
  const rewriteIdx = ordered.findIndex((r) => r.actionType === 'RESTRUCTURE_NARRATIVE');
  assert(contraIdx !== -1 && rewriteIdx !== -1, 'Test H.2: Both contradiction and rewrite recommendations present');
  assert(contraIdx < rewriteIdx, 'Test H.3: Contradiction resolution ordered BEFORE narrative rewrite');

  for (let i = 0; i < ordered.length; i++) {
    assert(ordered[i].executionOrder === i + 1, `Test H.4.${i + 1}: Execution order is sequential (${ordered[i].executionOrder})`);
  }

  // =========================================================================
  // TEST I: Quick wins identification
  // =========================================================================
  console.log('\n--- Test I: Quick Wins Identification ---');
  const quickWins = ordered.filter((r) => r.isQuickWin);
  assert(quickWins.length > 0, 'Test I.1: Quick wins identified');
  for (const qw of quickWins) {
    assert(qw.founderInputRequired === false, `Test I.2 (${qw.id}): Quick win does not require founder input`);
  }

  // =========================================================================
  // TEST J: Hallucination post-processor sanitization
  // =========================================================================
  console.log('\n--- Test J: Hallucination Sanitization ---');
  const taintedRecs: FounderRecommendation[] = [
    {
      id: 'rec-tainted-1',
      title: 'Hallucinated Metrics Test',
      problem: 'Unverified metrics in copy',
      whyItMatters: 'Investors will catch fake numbers',
      targetSlides: [4],
      actionType: 'CLARIFY_EXISTING_INFORMATION',
      priority: 'HIGH',
      founderInputRequired: false,
      recommendedAction: 'Clarify current metrics',
      suggestedCopy: {
        currentText: 'Old text',
        suggestedText: 'New text claiming 95% retention and $12k CAC',
        explanation: 'Hallucinated figures',
      },
      category: 'traction',
      relatedClaims: [],
      relatedDiagnostics: [],
      relatedEvaluationDimensions: [],
      relatedInvestorQuestions: [],
      existingEvidence: [],
      missingInformation: [],
      isQuickWin: false,
      executionOrder: 1,
      confidence: 'high',
      expectedImpact: 'None',
      blockedByRecommendationIds: [],
    },
  ];

  const sanitized = postProcessRecommendations(
    taintedRecs,
    10,
    new Set(['claim-cust-1']),
    new Set(['diag-contra-cust']),
    new Set(['sim-q-cust-1']),
    mockProfile,
    mockClaims
  );
  assert(sanitized[0].suggestedCopy === undefined, 'Test J.1: Hallucinated suggestedCopy stripped by post-processor');

  // =========================================================================
  // TEST K: Deterministic fallback reliability
  // =========================================================================
  console.log('\n--- Test K: Deterministic Fallback Reliability ---');
  const checklist = buildFounderInputChecklist(ordered);
  const summary = computeActionPlanSummary(ordered);

  const actionPlan: ActionPlanResult = {
    recommendations: ordered,
    founderChecklist: checklist,
    quickWins,
    summary,
    generatedAt: new Date(),
  };

  assert(actionPlan.recommendations.length >= 6, 'Test K.1: Fallback generates at least 6 recommendations');
  assert(actionPlan.summary.totalRecommendations === actionPlan.recommendations.length, 'Test K.2: Summary matches total recommendations');
  assert(actionPlan.summary.criticalCount >= 1, 'Test K.3: Critical recommendations counted');
  assert(actionPlan.founderChecklist.length >= 1, 'Test K.4: Founder input checklist populated');
  assert(actionPlan.quickWins.length === actionPlan.summary.quickWinsCount, 'Test K.5: Quick wins count matches quickWins array');

  console.log('\n====================================================');
  console.log(`TEST SUITE RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log('====================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
