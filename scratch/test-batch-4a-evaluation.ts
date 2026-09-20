import {
  FundraisingEvaluation,
  DimensionEvaluation,
  ThesisPillar,
  NarrativeChainTransition,
  InvestorObjection,
  StrongElement,
  DimensionStatus,
  WeaknessCategory,
} from '../src/types/evaluation';
import { StartupProfile } from '../src/types/startup';
import { ClaimEvidenceMap, MaterialClaim } from '../src/types/claim';
import { DeckDiagnostics, ContradictionDiagnostic, EvidenceGapDiagnostic } from '../src/types/diagnostics';
import {
  applyDeterministicOverrides,
  postProcessEvaluation,
  computeDimensionSummary,
  generateDeterministicEvaluation,
} from '../src/lib/deck/thesis-evaluator';

function createMockProfile(overrides: Partial<StartupProfile> = {}): StartupProfile {
  return {
    identity: {
      companyName: { status: 'extracted', rawValue: 'TestCo', evidence: [{ slideNumber: 1, exactText: 'TestCo', source: 'native_pdf' }] },
      tagline: { status: 'extracted', rawValue: 'Automating logistics', evidence: [{ slideNumber: 1, exactText: 'Automating logistics', source: 'native_pdf' }] },
      website: { status: 'not_found', evidence: [] },
      headquarters: { status: 'not_found', evidence: [] },
      foundingYear: { status: 'not_found', evidence: [] },
    },
    fundraising: {
      currentStage: { status: 'extracted', rawValue: 'Seed', evidence: [{ slideNumber: 10, exactText: 'Seed', source: 'native_pdf' }] },
      roundBeingRaised: { status: 'extracted', rawValue: 'Seed', evidence: [{ slideNumber: 10, exactText: 'Seed', source: 'native_pdf' }] },
      amountBeingRaised: { status: 'extracted', rawValue: '€2M', evidence: [{ slideNumber: 10, exactText: '€2M', source: 'native_pdf' }] },
      currency: { status: 'extracted', rawValue: 'EUR', evidence: [{ slideNumber: 10, exactText: 'EUR', source: 'native_pdf' }] },
      previousFunding: { status: 'not_found', evidence: [] },
      useOfFunds: { status: 'extracted', rawValue: 'R&D and Hiring', normalizedValue: ['R&D', 'Hiring'], evidence: [{ slideNumber: 10, exactText: 'R&D', source: 'native_pdf' }] },
      runway: { status: 'not_found', evidence: [] },
    },
    problemSolution: {
      problemStatement: { status: 'extracted', rawValue: 'High freight brokerage margins and dispatch delay', evidence: [{ slideNumber: 2, exactText: 'High freight margins', source: 'native_pdf' }] },
      targetUserPain: { status: 'extracted', rawValue: 'Manual dispatch calls waste 4 hours daily', evidence: [{ slideNumber: 2, exactText: 'Manual dispatch calls waste 4 hours', source: 'native_pdf' }] },
      currentAlternatives: { status: 'not_found', evidence: [] },
      productDescription: { status: 'extracted', rawValue: 'Automated AI dispatch and freight routing network', evidence: [{ slideNumber: 3, exactText: 'Automated AI dispatch', source: 'native_pdf' }] },
      valueProposition: { status: 'extracted', rawValue: '90% reduction in dispatch latency and 15% lower freight cost', evidence: [{ slideNumber: 3, exactText: '90% reduction in dispatch latency', source: 'native_pdf' }] },
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
      revenueModel: { status: 'extracted', rawValue: 'Usage fee of 3% per completed haul', evidence: [{ slideNumber: 6, exactText: 'Usage fee 3%', source: 'native_pdf' }] },
      pricingModel: { status: 'not_found', evidence: [] },
      pricingValues: { status: 'not_found', evidence: [] },
      unitEconomics: { status: 'not_found', evidence: [] },
    },
    traction: {
      revenue: { status: 'extracted', rawValue: '€1.2M ARR', evidence: [{ slideNumber: 5, exactText: '€1.2M ARR', source: 'native_pdf' }] },
      ARR: { status: 'extracted', rawValue: '€1.2M', evidence: [{ slideNumber: 5, exactText: '€1.2M', source: 'native_pdf' }] },
      MRR: { status: 'not_found', evidence: [] },
      customerCount: { status: 'extracted', rawValue: '85 active fleets', evidence: [{ slideNumber: 5, exactText: '85 active fleets', source: 'native_pdf' }] },
      paidCustomerCount: { status: 'not_found', evidence: [] },
      userCount: { status: 'not_found', evidence: [] },
      growthRates: { status: 'extracted', rawValue: '18% MoM', evidence: [{ slideNumber: 5, exactText: '18% MoM', source: 'native_pdf' }] },
      retentionMetrics: { status: 'not_found', evidence: [] },
      churn: { status: 'not_found', evidence: [] },
      pipeline: { status: 'not_found', evidence: [] },
      notableCustomers: { status: 'not_found', evidence: [] },
    },
    goToMarket: {
      acquisitionChannels: { status: 'extracted', rawValue: 'Direct outbound to fleet operations directors', normalizedValue: ['Direct outbound'], evidence: [{ slideNumber: 7, exactText: 'Direct outbound', source: 'native_pdf' }] },
      salesMotion: { status: 'extracted', rawValue: 'Inside sales motion with 21-day sales cycle', evidence: [{ slideNumber: 7, exactText: 'Inside sales motion', source: 'native_pdf' }] },
      distributionStrategy: { status: 'not_found', evidence: [] },
      partnerships: { status: 'not_found', evidence: [] },
      expansionStrategy: { status: 'not_found', evidence: [] },
    },
    market: {
      TAM: { status: 'extracted', rawValue: '€45B European road freight dispatch market (Frost & Sullivan 2024)', evidence: [{ slideNumber: 8, exactText: '€45B market', source: 'native_pdf' }] },
      SAM: { status: 'not_found', evidence: [] },
      SOM: { status: 'not_found', evidence: [] },
      marketGrowth: { status: 'not_found', evidence: [] },
      marketDefinition: { status: 'not_found', evidence: [] },
      marketSource: { status: 'not_found', evidence: [] },
    },
    competition: {
      namedCompetitors: { status: 'extracted', rawValue: 'Transporeon, Sennder', normalizedValue: ['Transporeon', 'Sennder'], evidence: [{ slideNumber: 9, exactText: 'Transporeon', source: 'native_pdf' }] },
      alternatives: { status: 'not_found', evidence: [] },
      differentiationClaims: { status: 'extracted', rawValue: 'Zero-touch dynamic load bidding algorithm', normalizedValue: ['Zero-touch dynamic load bidding algorithm'], evidence: [{ slideNumber: 9, exactText: 'Zero-touch dynamic load bidding', source: 'native_pdf' }] },
      positioningClaims: { status: 'not_found', evidence: [] },
    },
    team: {
      founders: [
        { name: 'Alex Mayer', role: 'CEO', background: 'Ex-VP Logistics at DB Schenker', slideNumber: 11 },
        { name: 'Elena Rostova', role: 'CTO', background: 'PhD ML, Ex-Google Brain', slideNumber: 11 },
      ],
      teamSize: { status: 'extracted', rawValue: '12 FTEs', evidence: [{ slideNumber: 11, exactText: '12 FTEs', source: 'native_pdf' }] },
      advisors: { status: 'not_found', evidence: [] },
    },
    technology: {
      coreTechnology: { status: 'extracted', rawValue: 'Real-time graph matching algorithm for freight backhauls', evidence: [{ slideNumber: 3, exactText: 'graph matching algorithm', source: 'native_pdf' }] },
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

function createMockClaimMap(): ClaimEvidenceMap {
  return {
    claims: [
      {
        id: 'cl-1',
        slideNumber: 2,
        claimType: 'problem',
        claimText: 'Manual dispatch calls waste 4 hours daily per broker.',
        quantitative: true,
        importance: 'core',
        supportStatus: 'supported',
        basis: 'explicit',
        confidence: 'high',
        evidence: [
          {
            id: 'ev-1',
            slideNumber: 2,
            exactText: 'Manual dispatch calls waste 4 hours',
            source: 'native_pdf',
            evidenceType: 'metric',
            relationship: 'Direct supporting statistic',
            confidence: 'high',
          },
        ],
      },
      {
        id: 'cl-2',
        slideNumber: 3,
        claimType: 'solution',
        claimText: 'Automated AI dispatch delivers 90% reduction in dispatch latency.',
        quantitative: true,
        importance: 'core',
        supportStatus: 'supported',
        basis: 'explicit',
        confidence: 'high',
        evidence: [
          {
            id: 'ev-2',
            slideNumber: 3,
            exactText: '90% reduction in dispatch latency',
            source: 'native_pdf',
            evidenceType: 'metric',
            relationship: 'Direct benchmark claim',
            confidence: 'high',
          },
        ],
      },
      {
        id: 'cl-3',
        slideNumber: 5,
        claimType: 'traction',
        claimText: 'Reached €1.2M ARR with 85 active fleet operators at 18% MoM growth.',
        quantitative: true,
        importance: 'core',
        supportStatus: 'supported',
        basis: 'explicit',
        confidence: 'high',
        evidence: [
          {
            id: 'ev-3',
            slideNumber: 5,
            exactText: '€1.2M ARR with 85 active fleet operators',
            source: 'native_pdf',
            evidenceType: 'chart',
            relationship: 'Historical adoption graph',
            confidence: 'high',
          },
        ],
      },
    ],
    summary: {
      totalClaims: 3,
      supportedCount: 3,
      partiallySupportedCount: 0,
      unsupportedCount: 0,
      conflictingCount: 0,
      coreCount: 3,
    },
    extractedAt: new Date(),
  };
}

function createMockDiagnostics(): DeckDiagnostics {
  return {
    contradictions: [],
    evidenceGaps: [],
    missingInformation: [],
    ambiguities: [],
    summary: {
      totalDiagnostics: 0,
      contradictionCount: 0,
      evidenceGapCount: 0,
      missingInfoCount: 0,
      ambiguityCount: 0,
      criticalCount: 0,
      materialCount: 0,
      minorCount: 0,
    },
    extractedAt: new Date(),
  };
}

console.log('================================================================');
console.log('RUNNING BATCH 4A TEST SUITE: FUNDRAISING THESIS & NARRATIVE EVAL');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 10;

// Test A: Strong problem / solution deck
try {
  const profile = createMockProfile();
  const claimMap = createMockClaimMap();
  const diagnostics = createMockDiagnostics();

  const evalResult = generateDeterministicEvaluation(profile, claimMap, diagnostics, 12);

  const probDim = evalResult.dimensions.find((d) => d.dimensionName === 'Problem Clarity');
  const solDim = evalResult.dimensions.find((d) => d.dimensionName === 'Solution Clarity');
  const cohDim = evalResult.dimensions.find((d) => d.dimensionName === 'Problem-Solution Coherence');

  if (!probDim || (probDim.status !== 'STRONG' && probDim.status !== 'ADEQUATE')) {
    throw new Error(`Problem Clarity expected STRONG or ADEQUATE, got: ${probDim?.status}`);
  }
  if (!solDim || (solDim.status !== 'STRONG' && solDim.status !== 'ADEQUATE')) {
    throw new Error(`Solution Clarity expected STRONG or ADEQUATE, got: ${solDim?.status}`);
  }
  if (!cohDim || (cohDim.status !== 'STRONG' && cohDim.status !== 'ADEQUATE')) {
    throw new Error(`Problem-Solution Coherence expected STRONG or ADEQUATE, got: ${cohDim?.status}`);
  }

  const pToC = evalResult.narrativeChain.find((t) => t.fromPillar === 'Problem' && t.toPillar === 'Customer');
  const cToS = evalResult.narrativeChain.find((t) => t.fromPillar === 'Customer' && t.toPillar === 'Solution');
  if (pToC?.status !== 'clear' || cToS?.status !== 'clear') {
    throw new Error('Narrative transition from Problem -> Customer -> Solution is not clear');
  }

  console.log('✅ TEST A PASSED: Strong problem/solution deck correctly evaluated.');
  passedTests++;
} catch (err: any) {
  console.error('❌ TEST A FAILED:', err.message);
}

// Test B: Unsupported TAM claim
try {
  const profile = createMockProfile();
  const claimMap = createMockClaimMap();
  claimMap.claims.push({
    id: 'cl-tam',
    slideNumber: 8,
    claimType: 'market',
    claimText: 'The global market is €250 Billion with no real competitors.',
    quantitative: true,
    importance: 'core',
    supportStatus: 'unsupported',
    basis: 'explicit',
    confidence: 'high',
    evidence: [],
  });
  const diagnostics = createMockDiagnostics();
  diagnostics.evidenceGaps.push({
    id: 'eg-tam',
    claimId: 'cl-tam',
    claimText: 'The global market is €250 Billion with no real competitors.',
    claimType: 'market',
    supportStatus: 'unsupported',
    importance: 'core',
    missingEvidenceDescription: 'No source or market study methodology provided',
    currentEvidenceSummary: 'Raw assertion without citations',
    severity: 'material',
    slideNumbers: [8],
    confidence: 'high',
  });

  const rawDimensions: DimensionEvaluation[] = [
    {
      id: 'dim-market',
      dimensionName: 'Market Thesis',
      status: 'STRONG',
      finding: 'Market is large',
      rationale: 'Stated in deck',
      slideReferences: [8],
    },
  ];

  const overridden = applyDeterministicOverrides(rawDimensions, profile, claimMap, diagnostics);
  const marketDim = overridden.find((d: DimensionEvaluation) => d.dimensionName === 'Market Thesis');

  if (marketDim?.status !== 'UNDERDEVELOPED') {
    throw new Error(`Expected Market Thesis to be UNDERDEVELOPED, got: ${marketDim?.status}`);
  }
  if (marketDim?.weaknessType !== 'EVIDENCE_GAP') {
    throw new Error(`Expected weaknessType EVIDENCE_GAP, got: ${marketDim?.weaknessType}`);
  }

  console.log('✅ TEST B PASSED: Unsupported TAM claim identified as UNDERDEVELOPED + EVIDENCE_GAP.');
  passedTests++;
} catch (err: any) {
  console.error('❌ TEST B FAILED:', err.message);
}

// Test C: Strong traction
try {
  const profile = createMockProfile();
  const claimMap = createMockClaimMap();
  const diagnostics = createMockDiagnostics();

  const evalResult = generateDeterministicEvaluation(profile, claimMap, diagnostics, 12);
  const tractionDim = evalResult.dimensions.find((d) => d.dimensionName === 'Traction Credibility');

  if (!tractionDim || (tractionDim.status !== 'STRONG' && tractionDim.status !== 'ADEQUATE')) {
    throw new Error(`Expected Traction Credibility to be evaluated with status ADEQUATE or STRONG, got: ${tractionDim?.status}`);
  }
  if (!tractionDim.finding.includes('85') && !tractionDim.finding.includes('customers')) {
    throw new Error(`Expected Traction Credibility finding to cite verified customer evidence, got: ${tractionDim.finding}`);
  }
  // Check that no subjective investment prediction is made
  if (tractionDim.finding.toLowerCase().includes('will invest') || tractionDim.finding.toLowerCase().includes('guaranteed')) {
    throw new Error('Traction finding contains forbidden investment prediction!');
  }

  console.log('✅ TEST C PASSED: Strong traction evaluated objectively citing evidence without company grade.');
  passedTests++;
} catch (err: any) {
  console.error('❌ TEST C FAILED:', err.message);
}

// Test D: GTM logic gap (SMBs + €100k pricing + self-serve)
try {
  const profile = createMockProfile();
  // Modify profile to have severe GTM logic mismatch
  profile.customerICP.customerType.rawValue = 'Small Mom-and-Pop Convenience Stores';
  profile.businessModel.revenueModel.rawValue = '€100,000 per year upfront enterprise license';
  profile.goToMarket.salesMotion.rawValue = '100% self-serve automated online signup';

  const rawDimensions: DimensionEvaluation[] = [
    {
      id: 'dim-gtm',
      dimensionName: 'Go-to-Market Credibility',
      status: 'STRONG',
      finding: 'Self-serve model stated',
      rationale: 'Fast acquisition',
      slideReferences: [7],
    },
  ];

  const overridden = applyDeterministicOverrides(rawDimensions, profile, null, null);
  const gtmDim = overridden.find((d: DimensionEvaluation) => d.dimensionName === 'Go-to-Market Credibility');

  if (gtmDim?.status !== 'UNDERDEVELOPED' && gtmDim?.status !== 'CONTRADICTORY') {
    throw new Error(`Expected GTM dimension to flag logic mismatch, got status: ${gtmDim?.status}`);
  }
  if (gtmDim?.weaknessType !== 'LOGIC_GAP') {
    throw new Error(`Expected weaknessType LOGIC_GAP, got: ${gtmDim?.weaknessType}`);
  }

  console.log('✅ TEST D PASSED: GTM pricing/ICP/motion mismatch correctly classified as LOGIC_GAP.');
  passedTests++;
} catch (err: any) {
  console.error('❌ TEST D FAILED:', err.message);
}

// Test E: Missing business model
try {
  const profile = createMockProfile();
  profile.businessModel.revenueModel.rawValue = 'not_found';
  profile.businessModel.revenueModel.status = 'not_found';

  const rawDimensions: DimensionEvaluation[] = [
    {
      id: 'dim-bm',
      dimensionName: 'Business Model Clarity',
      status: 'ADEQUATE',
      finding: 'Monetization exists',
      rationale: 'Assuming SaaS',
      slideReferences: [],
    },
  ];

  const overridden = applyDeterministicOverrides(rawDimensions, profile, { claims: [], summary: {} as any, extractedAt: new Date() }, null);
  const bmDim = overridden.find((d: DimensionEvaluation) => d.dimensionName === 'Business Model Clarity');

  if (bmDim?.status !== 'MISSING') {
    throw new Error(`Expected Business Model Clarity to be MISSING, got: ${bmDim?.status}`);
  }
  if (bmDim?.weaknessType !== 'COMMUNICATION_GAP') {
    throw new Error(`Expected weaknessType COMMUNICATION_GAP, got: ${bmDim?.weaknessType}`);
  }

  console.log('✅ TEST E PASSED: Missing business model correctly identified with status MISSING and COMMUNICATION_GAP.');
  passedTests++;
} catch (err: any) {
  console.error('❌ TEST E FAILED:', err.message);
}

// Test F: Contradictory traction (120 customers vs 75 customers)
try {
  const profile = createMockProfile();
  const diagnostics = createMockDiagnostics();
  diagnostics.contradictions.push({
    id: 'ct-1',
    category: 'customer_count',
    severity: 'critical',
    description: 'Slide 4 asserts 120 customers while Slide 10 asserts 75 active customers.',
    conflictingStatements: [
      { text: '120 live customers', slideNumber: 4, source: 'native_pdf' },
      { text: '75 active customers', slideNumber: 10, source: 'visual_model' },
    ],
    whyConflicting: 'Discrepancy in customer count without timeframe explanation',
    chronologyExplained: false,
    confidence: 'high',
  });

  const rawDimensions: DimensionEvaluation[] = [
    {
      id: 'dim-traction',
      dimensionName: 'Traction Credibility',
      status: 'STRONG',
      finding: 'Good customer adoption',
      rationale: 'Multiple slides mention customers',
      slideReferences: [4, 10],
    },
  ];

  const overridden = applyDeterministicOverrides(rawDimensions, profile, null, diagnostics);
  const tracDim = overridden.find((d: DimensionEvaluation) => d.dimensionName === 'Traction Credibility');

  if (tracDim?.status !== 'CONTRADICTORY') {
    throw new Error(`Expected Traction Credibility to be CONTRADICTORY, got: ${tracDim?.status}`);
  }
  if (!tracDim.finding.includes('Slide 4') || !tracDim.finding.includes('Slide 10')) {
    throw new Error(`Expected finding to cite contradictory slides 4 and 10, got: ${tracDim.finding}`);
  }

  console.log('✅ TEST F PASSED: Contradictory traction correctly flags CONTRADICTORY citing conflicting slides.');
  passedTests++;
} catch (err: any) {
  console.error('❌ TEST F FAILED:', err.message);
}

// Test G: Clear fundraise (€3M -> US GTM -> €5M ARR)
try {
  const profile = createMockProfile();
  profile.fundraising.amountBeingRaised.rawValue = '€3,000,000';
  profile.fundraising.useOfFunds.rawValue = 'Expand sales team to US and scale to €5M ARR in 18 months';

  const evalResult = generateDeterministicEvaluation(profile, createMockClaimMap(), createMockDiagnostics(), 12);
  const askDim = evalResult.dimensions.find((d) => d.dimensionName === 'Fundraising Ask');

  if (!askDim || (askDim.status !== 'ADEQUATE' && askDim.status !== 'STRONG')) {
    throw new Error(`Expected Fundraising Ask to be ADEQUATE or STRONG, got: ${askDim?.status}`);
  }
  if (!askDim.finding.includes('€3,000,000')) {
    throw new Error(`Expected finding to reflect raise amount €3,000,000, got: ${askDim.finding}`);
  }

  console.log('✅ TEST G PASSED: Clear fundraise ask grounded in raise target and runway milestones.');
  passedTests++;
} catch (err: any) {
  console.error('❌ TEST G FAILED:', err.message);
}

// Test H: Pre-seed company without revenue (stage adaptation)
try {
  const profile = createMockProfile();
  profile.fundraising.currentStage.rawValue = 'Pre-Seed';
  profile.traction.ARR.rawValue = 'not_found';
  profile.traction.revenue.rawValue = 'not_found';
  profile.traction.customerCount.rawValue = 'not_found';

  // Has qualitative user discovery validation
  const claimMap: ClaimEvidenceMap = {
    claims: [
      {
        id: 'cl-pilot',
        slideNumber: 5,
        claimType: 'traction',
        claimText: '3 design partner pilots active with letters of intent signed.',
        quantitative: true,
        importance: 'core',
        supportStatus: 'supported',
        basis: 'explicit',
        confidence: 'high',
        evidence: [
          {
            id: 'ev-pilot',
            slideNumber: 5,
            exactText: '3 design partner pilots',
            source: 'native_pdf',
            evidenceType: 'contract_or_pipeline',
            relationship: 'Pilot validation',
            confidence: 'high',
          },
        ],
      },
    ],
    summary: { totalClaims: 1, supportedCount: 1, partiallySupportedCount: 0, unsupportedCount: 0, conflictingCount: 0, coreCount: 1 },
    extractedAt: new Date(),
  };

  const rawDimensions: DimensionEvaluation[] = [
    {
      id: 'dim-trac',
      dimensionName: 'Traction Credibility',
      status: 'MISSING',
      finding: 'No Series A metrics or ARR',
      rationale: 'No revenue found',
      slideReferences: [],
    },
  ];

  const overridden = applyDeterministicOverrides(rawDimensions, profile, claimMap, null);
  const tracDim = overridden.find((d: DimensionEvaluation) => d.dimensionName === 'Traction Credibility');

  if (tracDim?.status === 'MISSING') {
    throw new Error('Pre-seed startup traction was unfairly penalized as MISSING despite early pilot/validation claims!');
  }
  if (tracDim?.status !== 'UNDERDEVELOPED' && tracDim?.status !== 'ADEQUATE') {
    throw new Error(`Expected stage-adapted status UNDERDEVELOPED or ADEQUATE, got: ${tracDim?.status}`);
  }

  console.log('✅ TEST H PASSED: Stage adaptation correctly evaluated pre-seed validation without penalizing for missing ARR.');
  passedTests++;
} catch (err: any) {
  console.error('❌ TEST H FAILED:', err.message);
}

// Test I: Gemini API unavailable -> Graceful deterministic fallback
try {
  const profile = createMockProfile();
  const claimMap = createMockClaimMap();
  const diagnostics = createMockDiagnostics();

  const evalResult = generateDeterministicEvaluation(profile, claimMap, diagnostics, 12);

  if (evalResult.dimensions.length !== 14) {
    throw new Error(`Expected exactly 14 dimensions in fallback evaluation, got: ${evalResult.dimensions.length}`);
  }
  for (const dim of evalResult.dimensions) {
    if (!dim.finding || dim.finding.trim() === '') {
      throw new Error(`Dimension ${dim.dimensionName} has empty finding!`);
    }
  }
  if (evalResult.reconstructedThesis.length !== 11) {
    throw new Error(`Expected 11 thesis pillars, got: ${evalResult.reconstructedThesis.length}`);
  }
  if (!evalResult.overallSynthesis || evalResult.overallSynthesis.trim() === '') {
    throw new Error('Overall synthesis is empty in deterministic fallback');
  }

  console.log('✅ TEST I PASSED: Deterministic fallback produces complete 14-dimension evaluation with 11 thesis pillars.');
  passedTests++;
} catch (err: any) {
  console.error('❌ TEST I FAILED:', err.message);
}

// Test J: Hallucinated model finding (Slide 99 on 10-slide deck, invalid claim IDs)
try {
  const claimMap = createMockClaimMap();
  const validClaimIds = new Set(claimMap.claims.map((c) => c.id));

  const rawData = {
    reconstructedThesis: [
      { pillar: 'Problem' as const, communicated: true, summary: 'Big problem', slideNumbers: [2, 99, 105, -3] },
    ],
    dimensions: [
      {
        id: 'dim-1',
        dimensionName: 'Problem Clarity',
        status: 'STRONG' as const,
        finding: 'Hallucinated finding referencing slide 99',
        rationale: 'Test rationale',
        slideReferences: [1, 50, 99],
        relatedClaimIds: ['cl-1', 'fake-claim-999'],
      },
    ],
    narrativeChain: [
      { fromPillar: 'Problem', toPillar: 'Solution', status: 'clear' as const, assessment: 'Transition', slideNumbers: [2, 999] },
    ],
    investorObjections: [
      { id: 'obj-1', objection: 'Objection text', triggeringGap: 'Gap', relevantSlides: [3, 400], importance: 'material' as const },
    ],
    strongElements: [
      { id: 'str-1', pillarOrDimension: 'Problem', highlight: 'Good', evidence: 'Text', slideNumbers: [1, 99] },
    ],
    overallSynthesis: 'Synthesis',
  };

  const processed = postProcessEvaluation(rawData, 10, validClaimIds);

  // Check pillar slide numbers
  if (processed.thesis[0].slideNumbers.includes(99) || processed.thesis[0].slideNumbers.includes(105) || processed.thesis[0].slideNumbers.includes(-3)) {
    throw new Error('Pillar slide references failed to reject slide 99 or negative slide!');
  }
  // Check dimension slide references
  if (processed.dimensions[0].slideReferences.includes(99) || processed.dimensions[0].slideReferences.includes(50)) {
    throw new Error('Dimension slide references failed to clamp to 10 total pages!');
  }
  // Check related claim IDs
  if (processed.dimensions[0].relatedClaimIds?.includes('fake-claim-999')) {
    throw new Error('Dimension relatedClaimIds failed to filter non-existent claim ID fake-claim-999!');
  }
  // Check narrative chain
  if (processed.chain[0].slideNumbers.includes(999)) {
    throw new Error('Narrative chain failed to filter slide 999!');
  }
  // Check investor objection
  if (processed.objections[0].relevantSlides.includes(400)) {
    throw new Error('Investor objection failed to filter slide 400!');
  }

  console.log('✅ TEST J PASSED: Hallucinated slide 99 and invalid claim IDs successfully filtered and clamped.');
  passedTests++;
} catch (err: any) {
  console.error('❌ TEST J FAILED:', err.message);
}

console.log('\n================================================================');
console.log(`TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('================================================================\n');

if (passedTests === totalTests) {
  console.log('ALL BATCH 4A TESTS COMPLETED SUCCESSFULLY.');
  process.exit(0);
} else {
  console.error('SOME TESTS FAILED.');
  process.exit(1);
}

