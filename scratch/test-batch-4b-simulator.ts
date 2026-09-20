import { StartupProfile } from '../src/types/startup';
import { ClaimEvidenceMap, MaterialClaim } from '../src/types/claim';
import { DeckDiagnostics } from '../src/types/diagnostics';
import { FundraisingEvaluation } from '../src/types/evaluation';
import { InvestorQuestion } from '../src/types/simulator';
import {
  generateDeterministicSimulatorQuestions,
  postProcessQuestions,
  deduplicateQuestions,
} from '../src/lib/deck/simulator-engine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
}

console.log('================================================================');
console.log('RUNNING BATCH 4B TEST SUITE: INVESTOR Q&A & DUE DILIGENCE SIM');
console.log('================================================================\n');

let passedTests = 0;
const totalTests = 11;

// Helper mock profile builder matching StartupProfile interface exactly
function createMockProfile(overrides: Partial<StartupProfile> = {}): StartupProfile {
  return {
    identity: {
      companyName: { status: 'extracted', rawValue: 'Arcstone Logistics', evidence: [{ slideNumber: 1, exactText: 'Arcstone Logistics', source: 'native_pdf' }] },
      tagline: { status: 'extracted', rawValue: 'Autonomous freight orchestration', evidence: [{ slideNumber: 1, exactText: 'Autonomous freight', source: 'native_pdf' }] },
      website: { status: 'not_found', evidence: [] },
      headquarters: { status: 'not_found', evidence: [] },
      foundingYear: { status: 'not_found', evidence: [] },
    },
    fundraising: {
      currentStage: { status: 'extracted', rawValue: 'Seed', evidence: [{ slideNumber: 10, exactText: 'Seed', source: 'native_pdf' }] },
      roundBeingRaised: { status: 'extracted', rawValue: 'Seed', evidence: [{ slideNumber: 10, exactText: 'Seed', source: 'native_pdf' }] },
      amountBeingRaised: { status: 'extracted', rawValue: '€2.5M Seed', evidence: [{ slideNumber: 10, exactText: '€2.5M Seed', source: 'native_pdf' }] },
      currency: { status: 'extracted', rawValue: 'EUR', evidence: [{ slideNumber: 10, exactText: 'EUR', source: 'native_pdf' }] },
      previousFunding: { status: 'not_found', evidence: [] },
      useOfFunds: { status: 'extracted', rawValue: 'Engineering expansion and EU market sales', normalizedValue: ['Engineering expansion', 'EU sales'], evidence: [{ slideNumber: 10, exactText: 'Engineering expansion', source: 'native_pdf' }] },
      runway: { status: 'not_found', evidence: [] },
    },
    problemSolution: {
      problemStatement: { status: 'extracted', rawValue: 'Dispatch bottlenecks cost 40% margin', evidence: [{ slideNumber: 2, exactText: 'Dispatch bottlenecks', source: 'native_pdf' }] },
      targetUserPain: { status: 'extracted', rawValue: 'Manual dispatch calls waste 3 hours per load', evidence: [{ slideNumber: 2, exactText: 'Manual dispatch calls', source: 'native_pdf' }] },
      currentAlternatives: { status: 'not_found', evidence: [] },
      productDescription: { status: 'extracted', rawValue: 'AI autonomous load dispatcher', evidence: [{ slideNumber: 3, exactText: 'AI autonomous load dispatcher', source: 'native_pdf' }] },
      valueProposition: { status: 'extracted', rawValue: 'Automated freight booking in 15 seconds', evidence: [{ slideNumber: 3, exactText: 'Automated freight booking', source: 'native_pdf' }] },
      keyFeatures: { status: 'not_found', evidence: [] },
      productCategory: { status: 'not_found', evidence: [] },
    },
    customerICP: {
      customerType: { status: 'extracted', rawValue: 'Mid-market freight carriers with 20-200 trucks', evidence: [{ slideNumber: 4, exactText: 'Mid-market freight carriers', source: 'native_pdf' }] },
      targetSegments: { status: 'not_found', evidence: [] },
      industries: { status: 'not_found', evidence: [] },
      geography: { status: 'not_found', evidence: [] },
      buyerPersona: { status: 'not_found', evidence: [] },
      endUser: { status: 'not_found', evidence: [] },
    },
    businessModel: {
      revenueModel: { status: 'extracted', rawValue: 'SaaS subscription per truck per month', evidence: [{ slideNumber: 6, exactText: 'SaaS subscription', source: 'native_pdf' }] },
      pricingModel: { status: 'extracted', rawValue: 'Subscription', evidence: [{ slideNumber: 6, exactText: 'Subscription', source: 'native_pdf' }] },
      pricingValues: { status: 'extracted', rawValue: '€150/truck/month', evidence: [{ slideNumber: 6, exactText: '€150/truck/month', source: 'native_pdf' }] },
      unitEconomics: { status: 'not_found', evidence: [] },
    },
    traction: {
      revenue: { status: 'extracted', rawValue: '€1.2M ARR', evidence: [{ slideNumber: 5, exactText: '€1.2M ARR', source: 'native_pdf' }] },
      ARR: { status: 'extracted', rawValue: '€1.2M', evidence: [{ slideNumber: 5, exactText: '€1.2M', source: 'native_pdf' }] },
      MRR: { status: 'not_found', evidence: [] },
      customerCount: { status: 'extracted', rawValue: '127 paying carriers', evidence: [{ slideNumber: 5, exactText: '127 paying carriers', source: 'native_pdf' }] },
      paidCustomerCount: { status: 'not_found', evidence: [] },
      userCount: { status: 'not_found', evidence: [] },
      growthRates: { status: 'extracted', rawValue: '18% MoM growth', evidence: [{ slideNumber: 5, exactText: '18% MoM growth', source: 'native_pdf' }] },
      retentionMetrics: { status: 'not_found', evidence: [] },
      churn: { status: 'not_found', evidence: [] },
      pipeline: { status: 'not_found', evidence: [] },
      notableCustomers: { status: 'not_found', evidence: [] },
    },
    goToMarket: {
      acquisitionChannels: { status: 'extracted', rawValue: 'Inside direct sales targeting fleet owners', normalizedValue: ['Inside direct sales'], evidence: [{ slideNumber: 7, exactText: 'Inside direct sales', source: 'native_pdf' }] },
      salesMotion: { status: 'extracted', rawValue: 'Inside direct sales targeting fleet owners', evidence: [{ slideNumber: 7, exactText: 'Inside direct sales', source: 'native_pdf' }] },
      distributionStrategy: { status: 'not_found', evidence: [] },
      partnerships: { status: 'not_found', evidence: [] },
      expansionStrategy: { status: 'not_found', evidence: [] },
    },
    market: {
      TAM: { status: 'extracted', rawValue: '€8B European Road Freight TMS', evidence: [{ slideNumber: 8, exactText: '€8B European Road Freight', source: 'native_pdf' }] },
      SAM: { status: 'not_found', evidence: [] },
      SOM: { status: 'not_found', evidence: [] },
      marketGrowth: { status: 'not_found', evidence: [] },
      marketDefinition: { status: 'not_found', evidence: [] },
      marketSource: { status: 'not_found', evidence: [] },
    },
    competition: {
      namedCompetitors: { status: 'not_found', evidence: [] },
      alternatives: { status: 'not_found', evidence: [] },
      differentiationClaims: { status: 'extracted', rawValue: 'Real-time multi-agent load matching', normalizedValue: ['multi-agent matching'], evidence: [{ slideNumber: 9, exactText: 'multi-agent matching', source: 'native_pdf' }] },
      positioningClaims: { status: 'not_found', evidence: [] },
    },
    team: {
      founders: [
        { name: 'Alex Vance', role: 'CEO, Ex-DHL', background: 'Logistics exec', slideNumber: 11 },
      ],
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
    missingFields: [],
    extractedAt: new Date(),
    ...overrides,
  };
}

// -------------------------------------------------------------------------
// TEST A — Unsupported market claim
// -------------------------------------------------------------------------
try {
  const profile = createMockProfile();
  const claims: MaterialClaim[] = [
    {
      id: 'claim_tam',
      claimText: '€8B European Freight TMS TAM',
      slideNumber: 8,
      claimType: 'market',
      supportStatus: 'unsupported',
      quantitative: true,
      importance: 'core',
      basis: 'explicit',
      confidence: 'high',
      evidence: [{ id: 'ev_tam', slideNumber: 8, exactText: 'TAM €8B', source: 'native_pdf', evidenceType: 'metric', relationship: 'Stated market size', confidence: 'high' }],
    },
  ];
  const claimMap: ClaimEvidenceMap = {
    claims,
    summary: { totalClaims: 1, supportedCount: 0, partiallySupportedCount: 0, unsupportedCount: 1, conflictingCount: 0, coreCount: 1 },
    extractedAt: new Date(),
  };

  const simResult = generateDeterministicSimulatorQuestions(profile, claimMap, null, null, 12);
  const marketQ = simResult.questions.find((q) => q.category === 'market');

  assert(!!marketQ, 'Market diligence question must be generated.');
  assert(marketQ!.question.includes('€8B') || marketQ!.question.includes('market'), 'Question must address €8B TAM.');
  assert(marketQ!.currentAnswerability === 'WEAKLY_SUPPORTED' || marketQ!.currentAnswerability === 'UNANSWERED', 'Answerability should be weak or unanswered.');
  assert(marketQ!.trigger.slideNumbers.includes(8), 'Trigger must cite Slide 8.');

  console.log('✅ TEST A PASSED: Unsupported €8B TAM generates sharp diligence question with weak answerability.');
  passedTests++;
} catch (e) {
  console.error('❌ TEST A FAILED:', e);
}

// -------------------------------------------------------------------------
// TEST B — Strong traction
// -------------------------------------------------------------------------
try {
  const profile = createMockProfile();
  const claims: MaterialClaim[] = [
    {
      id: 'claim_arr',
      claimText: '€1.2M ARR with 18% MoM growth',
      slideNumber: 5,
      claimType: 'traction',
      supportStatus: 'supported',
      quantitative: true,
      importance: 'core',
      basis: 'explicit',
      confidence: 'high',
      evidence: [{ id: 'ev_arr', slideNumber: 5, exactText: '€1.2M ARR with 18% MoM', source: 'native_pdf', evidenceType: 'metric', relationship: 'Traction metric', confidence: 'high' }],
    },
  ];
  const claimMap: ClaimEvidenceMap = {
    claims,
    summary: { totalClaims: 1, supportedCount: 1, partiallySupportedCount: 0, unsupportedCount: 0, conflictingCount: 0, coreCount: 1 },
    extractedAt: new Date(),
  };

  const simResult = generateDeterministicSimulatorQuestions(profile, claimMap, null, null, 12);
  const tractionQ = simResult.questions.find((q) => q.category === 'traction');

  assert(!!tractionQ, 'Traction diligence question must be generated.');
  assert(tractionQ!.question.toLowerCase().includes('repeatable') || tractionQ!.question.toLowerCase().includes('driven'), 'Question must interrogate repeatability and growth drivers.');
  assert(tractionQ!.priority === 'HIGH' || tractionQ!.priority === 'CRITICAL', 'Priority must be high or critical.');

  console.log('✅ TEST B PASSED: Strong traction proof points probed for repeatability and drivers rather than generic praise.');
  passedTests++;
} catch (e) {
  console.error('❌ TEST B FAILED:', e);
}

// -------------------------------------------------------------------------
// TEST C — Business-model gap
// -------------------------------------------------------------------------
try {
  const profile = createMockProfile({
    businessModel: {
      revenueModel: { status: 'not_found', evidence: [] },
      pricingModel: { status: 'not_found', evidence: [] },
      pricingValues: { status: 'not_found', evidence: [] },
      unitEconomics: { status: 'not_found', evidence: [] },
    },
  });

  const evaluation: FundraisingEvaluation = {
    reconstructedThesis: [],
    dimensions: [
      {
        id: 'dim_bm',
        dimensionName: 'Business Model Clarity',
        status: 'MISSING',
        finding: 'Deck lacks pricing and revenue model.',
        rationale: 'No commercial monetization terms.',
        slideReferences: [],
        weaknessType: 'COMMUNICATION_GAP',
      },
    ],
    dimensionSummary: { strongCount: 5, adequateCount: 5, underdevelopedCount: 3, missingCount: 1, contradictoryCount: 0 },
    narrativeChain: [],
    investorObjections: [],
    strongElements: [],
    overallSynthesis: 'Solid idea but monetization omitted.',
    evaluatedAt: new Date(),
  };

  const simResult = generateDeterministicSimulatorQuestions(profile, null, null, evaluation, 12);
  const bmQ = simResult.questions.find((q) => q.category === 'business_model');

  assert(!!bmQ, 'Business model question must be generated.');
  assert(bmQ!.priority === 'CRITICAL', 'Missing business model must be CRITICAL priority.');
  assert(bmQ!.currentAnswerability === 'UNANSWERED', 'Answerability must be UNANSWERED.');

  console.log('✅ TEST C PASSED: Missing business model triggers CRITICAL question with UNANSWERED status.');
  passedTests++;
} catch (e) {
  console.error('❌ TEST C FAILED:', e);
}

// -------------------------------------------------------------------------
// TEST D — GTM logic mismatch
// -------------------------------------------------------------------------
try {
  const profile = createMockProfile({
    customerICP: {
      customerType: { status: 'extracted', rawValue: 'Mom-and-pop convenience stores (SMB)', evidence: [] },
      targetSegments: { status: 'not_found', evidence: [] },
      industries: { status: 'not_found', evidence: [] },
      geography: { status: 'not_found', evidence: [] },
      buyerPersona: { status: 'not_found', evidence: [] },
      endUser: { status: 'not_found', evidence: [] },
    },
    businessModel: {
      revenueModel: { status: 'extracted', rawValue: 'Enterprise annual license', evidence: [] },
      pricingModel: { status: 'not_found', evidence: [] },
      pricingValues: { status: 'extracted', rawValue: '€100,000/year upfront', evidence: [] },
      unitEconomics: { status: 'not_found', evidence: [] },
    },
    goToMarket: {
      acquisitionChannels: { status: 'not_found', evidence: [] },
      salesMotion: { status: 'extracted', rawValue: 'Automated self-serve freemium app', evidence: [] },
      distributionStrategy: { status: 'not_found', evidence: [] },
      partnerships: { status: 'not_found', evidence: [] },
      expansionStrategy: { status: 'not_found', evidence: [] },
    },
  });

  const evaluation: FundraisingEvaluation = {
    reconstructedThesis: [],
    dimensions: [
      {
        id: 'dim_gtm',
        dimensionName: 'Go-to-Market Credibility',
        status: 'UNDERDEVELOPED',
        finding: 'Pricing and ICP mismatch.',
        rationale: 'Selling €100k ACV via self-serve.',
        slideReferences: [6, 7],
        weaknessType: 'LOGIC_GAP',
      },
    ],
    dimensionSummary: { strongCount: 5, adequateCount: 5, underdevelopedCount: 4, missingCount: 0, contradictoryCount: 0 },
    narrativeChain: [],
    investorObjections: [],
    strongElements: [],
    overallSynthesis: 'GTM logic gap detected.',
    evaluatedAt: new Date(),
  };

  const simResult = generateDeterministicSimulatorQuestions(profile, null, null, evaluation, 12);
  const gtmQ = simResult.questions.find((q) => q.category === 'go_to_market');

  assert(!!gtmQ, 'GTM question must be generated.');
  assert(gtmQ!.question.toLowerCase().includes('pricing') || gtmQ!.question.toLowerCase().includes('self-service'), 'Question must address pricing/motion tension.');
  assert(gtmQ!.trigger.triggerSummary.includes('Pricing'), 'Trigger must identify pricing/ICP mismatch.');

  console.log('✅ TEST D PASSED: GTM pricing/ICP/motion mismatch generates sharp diligence question.');
  passedTests++;
} catch (e) {
  console.error('❌ TEST D FAILED:', e);
}

// -------------------------------------------------------------------------
// TEST E — Strong answerability
// -------------------------------------------------------------------------
try {
  const profile = createMockProfile();
  const simResult = generateDeterministicSimulatorQuestions(profile, null, null, null, 12);
  const fundQ = simResult.questions.find((q) => q.category === 'fundraising');

  assert(!!fundQ, 'Fundraising question must be generated.');
  assert(fundQ!.currentAnswerability === 'WELL_SUPPORTED', 'Fundraising question should be WELL_SUPPORTED.');
  assert(fundQ!.groundedAnswer!.includes('€2.5M Seed'), 'Grounded answer must cite the €2.5M ask.');

  console.log('✅ TEST E PASSED: Stated fundraise ask produces WELL_SUPPORTED answerability with verified grounded answer.');
  passedTests++;
} catch (e) {
  console.error('❌ TEST E FAILED:', e);
}

// -------------------------------------------------------------------------
// TEST F — Missing answer
// -------------------------------------------------------------------------
try {
  const profile = createMockProfile();
  const testQ: InvestorQuestion = {
    id: 'q_retention',
    question: 'What is your net revenue retention (NRR) and logo churn across early cohorts?',
    category: 'retention',
    priority: 'HIGH',
    questionType: 'TRACTION',
    whyInvestorAsks: 'Cohort retention proves durability.',
    trigger: { relatedClaimIds: [], relatedDiagnosticIds: [], slideNumbers: [5], triggerSummary: 'Retention omitted.' },
    currentAnswerability: 'UNANSWERED',
    availableEvidence: [],
    missingInformation: ['Net Revenue Retention %', 'Logo churn rate'],
    preparationGuidance: 'Establish cohort retention behavior.',
    groundedAnswer: 'Current deck evidence is insufficient to construct a reliable answer.',
    likelyFollowUps: [],
    confidence: 'high',
  };

  const processed = postProcessQuestions([testQ], 12, new Set(), new Set(), profile, null);
  assert(processed[0].currentAnswerability === 'UNANSWERED', 'Answerability must remain UNANSWERED.');
  assert(processed[0].groundedAnswer === 'Current deck evidence is insufficient to construct a reliable answer.', 'Grounded answer must state insufficient evidence.');

  console.log('✅ TEST F PASSED: Missing retention data correctly classified as UNANSWERED without fabricated metrics.');
  passedTests++;
} catch (e) {
  console.error('❌ TEST F FAILED:', e);
}

// -------------------------------------------------------------------------
// TEST G — Conflict
// -------------------------------------------------------------------------
try {
  const profile = createMockProfile();
  const diagnostics: DeckDiagnostics = {
    contradictions: [
      {
        id: 'diag_c1',
        category: 'traction',
        severity: 'critical',
        description: 'Customer count discrepancy: 120 vs 75',
        conflictingStatements: [
          { slideNumber: 5, text: '120 active fleets', source: 'native_pdf' },
          { slideNumber: 11, text: '75 customer deployments', source: 'native_pdf' },
        ],
        whyConflicting: '120 fleets on slide 5 conflicts with 75 on slide 11.',
        chronologyExplained: false,
        confidence: 'high',
      },
    ],
    evidenceGaps: [],
    missingInformation: [],
    ambiguities: [],
    summary: {
      totalDiagnostics: 1,
      contradictionCount: 1,
      evidenceGapCount: 0,
      missingInfoCount: 0,
      ambiguityCount: 0,
      criticalCount: 1,
      materialCount: 0,
      minorCount: 0,
    },
    extractedAt: new Date(),
  };

  const simResult = generateDeterministicSimulatorQuestions(profile, null, diagnostics, null, 12);
  const conflictQ = simResult.questions.find((q) => q.currentAnswerability === 'CONTRADICTORY');

  assert(!!conflictQ, 'Contradiction question must be generated.');
  assert(conflictQ!.priority === 'CRITICAL', 'Contradiction must be CRITICAL priority.');
  assert(conflictQ!.question.includes('reconcile') || conflictQ!.question.includes('120'), 'Question must ask to reconcile the discrepancy.');
  assert(conflictQ!.trigger.slideNumbers.includes(5) && conflictQ!.trigger.slideNumbers.includes(11), 'Trigger must cite both conflicting slides.');

  console.log('✅ TEST G PASSED: Data contradiction directly generates CRITICAL CONTRADICTORY question.');
  passedTests++;
} catch (e) {
  console.error('❌ TEST G FAILED:', e);
}

// -------------------------------------------------------------------------
// TEST H — Stage adaptation
// -------------------------------------------------------------------------
try {
  const preSeedProfile = createMockProfile({
    fundraising: {
      currentStage: { status: 'extracted', rawValue: 'Pre-seed Concept', evidence: [{ slideNumber: 1, exactText: 'Pre-seed', source: 'native_pdf' }] },
      roundBeingRaised: { status: 'extracted', rawValue: 'Pre-seed', evidence: [] },
      amountBeingRaised: { status: 'not_found', evidence: [] },
      currency: { status: 'not_found', evidence: [] },
      previousFunding: { status: 'not_found', evidence: [] },
      useOfFunds: { status: 'not_found', evidence: [] },
      runway: { status: 'not_found', evidence: [] },
    },
    traction: {
      revenue: { status: 'not_found', evidence: [] },
      ARR: { status: 'not_found', evidence: [] },
      MRR: { status: 'not_found', evidence: [] },
      customerCount: { status: 'not_found', evidence: [] },
      paidCustomerCount: { status: 'not_found', evidence: [] },
      userCount: { status: 'not_found', evidence: [] },
      growthRates: { status: 'not_found', evidence: [] },
      retentionMetrics: { status: 'not_found', evidence: [] },
      churn: { status: 'not_found', evidence: [] },
      pipeline: { status: 'not_found', evidence: [] },
      notableCustomers: { status: 'not_found', evidence: [] },
    },
  });

  const simResult = generateDeterministicSimulatorQuestions(preSeedProfile, null, null, null, 12);
  const problemQ = simResult.questions.find((q) => q.category === 'problem');

  assert(!!problemQ, 'Stage-adaptive question must be generated.');
  assert(problemQ!.question.toLowerCase().includes('interview') || problemQ!.question.toLowerCase().includes('insight'), 'Question must focus on user discovery/insight rather than demanding Series A ARR.');

  console.log('✅ TEST H PASSED: Pre-seed startup receives stage-adapted customer discovery questions rather than ARR penalization.');
  passedTests++;
} catch (e) {
  console.error('❌ TEST H FAILED:', e);
}

// -------------------------------------------------------------------------
// TEST I — Hallucinated answer
// -------------------------------------------------------------------------
try {
  const profile = createMockProfile(); // Only €1.2M ARR in profile
  const hallucinatedQuestion: InvestorQuestion = {
    id: 'q_hallucinated',
    question: 'What is your current run rate?',
    category: 'revenue',
    priority: 'HIGH',
    questionType: 'TRACTION',
    whyInvestorAsks: 'Verify revenue scale.',
    trigger: { relatedClaimIds: [], relatedDiagnosticIds: [], slideNumbers: [5], triggerSummary: 'Revenue claim.' },
    currentAnswerability: 'WELL_SUPPORTED',
    availableEvidence: [{ slideNumber: 5, statement: '€1.2M ARR', source: 'native_pdf' }],
    missingInformation: [],
    preparationGuidance: 'State ARR.',
    groundedAnswer: 'Answer using current deck evidence: We have achieved €4M ARR with 500 customers across Europe.', // Hallucinated €4M ARR!
    likelyFollowUps: [],
    confidence: 'high',
  };

  const processed = postProcessQuestions([hallucinatedQuestion], 12, new Set(), new Set(), profile, null);
  assert(
    processed[0].groundedAnswer === 'Current deck evidence is insufficient to construct a reliable answer.',
    'Post-processing must reject hallucinated €4M ARR and revert to insufficient evidence disclaimer.'
  );

  console.log('✅ TEST I PASSED: Hallucinated quantitative answer (€4M ARR) detected and rejected by post-processor.');
  passedTests++;
} catch (e) {
  console.error('❌ TEST I FAILED:', e);
}

// -------------------------------------------------------------------------
// TEST J — Duplicate questions
// -------------------------------------------------------------------------
try {
  const q1: InvestorQuestion = {
    id: 'q_acq_1',
    question: 'How do you acquire customers?',
    category: 'go_to_market',
    priority: 'CRITICAL',
    questionType: 'MECHANISM',
    whyInvestorAsks: 'GTM repeatability.',
    trigger: { relatedClaimIds: [], relatedDiagnosticIds: [], slideNumbers: [7], triggerSummary: 'GTM motion.' },
    currentAnswerability: 'PARTIALLY_SUPPORTED',
    availableEvidence: [],
    missingInformation: [],
    preparationGuidance: 'Explain sales channels.',
    groundedAnswer: 'Answer using current deck evidence: Direct sales.',
    likelyFollowUps: [],
    confidence: 'high',
  };

  const q2: InvestorQuestion = {
    id: 'q_acq_2',
    question: 'What is your customer acquisition strategy?',
    category: 'go_to_market',
    priority: 'HIGH',
    questionType: 'MECHANISM',
    whyInvestorAsks: 'Acquisition strategy.',
    trigger: { relatedClaimIds: [], relatedDiagnosticIds: [], slideNumbers: [7], triggerSummary: 'GTM motion.' },
    currentAnswerability: 'PARTIALLY_SUPPORTED',
    availableEvidence: [],
    missingInformation: [],
    preparationGuidance: 'Explain strategy.',
    groundedAnswer: 'Answer using current deck evidence: Direct sales.',
    likelyFollowUps: [],
    confidence: 'high',
  };

  const deduped = deduplicateQuestions([q1, q2]);
  assert(deduped.length === 1, 'Duplicate questions must be merged into 1 primary question.');
  assert(deduped[0].id === 'q_acq_1', 'Higher priority CRITICAL question must be retained.');

  console.log('✅ TEST J PASSED: Semantically duplicate customer acquisition questions successfully deduplicated.');
  passedTests++;
} catch (e) {
  console.error('❌ TEST J FAILED:', e);
}

// -------------------------------------------------------------------------
// TEST K — Gemini unavailable (Deterministic fallback)
// -------------------------------------------------------------------------
try {
  const profile = createMockProfile();
  const fallback = generateDeterministicSimulatorQuestions(profile, null, null, null, 12);

  assert(fallback.questions.length >= 6, `Fallback should generate substantial questions (got ${fallback.questions.length}).`);
  assert(fallback.summary.totalQuestions === fallback.questions.length, 'Summary count must match question count.');
  assert(fallback.summary.mostExposedAreas.length > 0, 'Most exposed areas must be identified.');

  console.log(`✅ TEST K PASSED: Deterministic fallback generated ${fallback.questions.length} grounded diligence questions with complete summary.`);
  passedTests++;
} catch (e) {
  console.error('❌ TEST K FAILED:', e);
}

console.log('\n================================================================');
console.log(`TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('================================================================');

if (passedTests === totalTests) {
  console.log('\nALL BATCH 4B TESTS COMPLETED SUCCESSFULLY.');
} else {
  console.error('\nSOME TESTS FAILED.');
  process.exit(1);
}
