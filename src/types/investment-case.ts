/**
 * Production Canonical Investment Case & What-Must-Be-True Contract.
 * Underwriting primitives for institutional venture case reconstruction.
 */

export type MechanismCategory =
  | 'value_creation'
  | 'customer_acquisition'
  | 'distribution'
  | 'monetization'
  | 'retention'
  | 'growth'
  | 'market_expansion'
  | 'defensibility'
  | 'capital_efficiency'
  | 'technical_execution'
  | 'regulatory'
  | 'team_execution';

export type AssumptionImportance = 'critical' | 'high' | 'medium';

export type AssumptionOrigin = 'explicit' | 'implicit';

export type EvidenceStatus =
  | 'supported'
  | 'partially_supported'
  | 'asserted_only'
  | 'unsupported'
  | 'contradictory'
  | 'not_yet_testable'
  | 'not_applicable';

export type EvidenceQualityClass =
  | 'behavioral'
  | 'financial'
  | 'contractual'
  | 'cohort'
  | 'operational'
  | 'technical'
  | 'regulatory'
  | 'third_party'
  | 'market_research'
  | 'customer_quoted'
  | 'founder_assertion'
  | 'inferred';

export interface StructuredInvestmentThesis {
  problem: string;
  targetCustomer: string;
  wedge: string;
  valueCreation: string;
  distribution: string;
  monetization: string;
  growth: string;
  marketExpansion: string;
  defensibility: string;
  teamAdvantage: string;
  capitalPath: string;
  summary: string;
  statedThesis: string;
  reconstructedThesis: string;
}

export interface InvestmentCaseMechanism {
  id: string;
  category: MechanismCategory;
  statement: string;
  importance: AssumptionImportance;
  evidenceStatus: EvidenceStatus;
  supportingClaimIds: string[];
  supportingSlideNumbers: number[];
  supportingFacts: string[];
  contradictingClaimIds: string[];
  contradictingSlideNumbers: number[];
  confidence: 'high' | 'medium' | 'low';
}

export type FounderActionType =
  | 'PROVIDE_EXISTING_EVIDENCE'
  | 'ADD_DECK_EVIDENCE'
  | 'CLARIFY_NARRATIVE'
  | 'VERIFY_METRIC'
  | 'RESOLVE_CONTRADICTION'
  | 'PREPARE_DILIGENCE_ANSWER'
  | 'VALIDATE_BUSINESS_ASSUMPTION'
  | 'CHANGE_FUNDRAISING_CLAIM'
  | 'NO_ACTION_YET';

export type FounderActionScope =
  | 'deck_fix'
  | 'founder_input'
  | 'underlying_business'
  | 'diligence_prep';

export interface SuggestedFounderAction {
  type: FounderActionType;
  scope: FounderActionScope;
  action: string;
}

export interface WhatMustBeTrue {
  id: string;
  statement: string;
  category: MechanismCategory | string;
  importance: AssumptionImportance;
  assumptionOrigin: AssumptionOrigin;
  evidenceStatus: EvidenceStatus;
  evidenceQuality: EvidenceQualityClass;
  supportingClaimIds: string[];
  supportingSlideNumbers: number[];
  supportingFacts: string[];
  contradictingClaimIds: string[];
  contradictingSlideNumbers: number[];
  isThesisBottleneck: boolean;
  bottleneckReason?: string;
  suggestedFounderAction?: SuggestedFounderAction;
  confidence: 'high' | 'medium' | 'low';
}

export type DependencyRelationship =
  | 'requires'
  | 'enables'
  | 'constrains'
  | 'amplifies'
  | 'conflicts_with';

export interface InvestmentCaseDependency {
  id: string;
  sourceId: string;
  targetId: string;
  relationship: DependencyRelationship;
  criticality: AssumptionImportance;
  explanation: string;
}

export type RiskCategory =
  | 'customer'
  | 'product'
  | 'market'
  | 'distribution'
  | 'sales'
  | 'retention'
  | 'monetization'
  | 'economics'
  | 'competition'
  | 'defensibility'
  | 'technical'
  | 'regulatory'
  | 'capital'
  | 'team'
  | 'execution'
  | 'financing';

export type RiskType =
  | 'evidence_gap'
  | 'assumption_risk'
  | 'dependency_risk'
  | 'contradiction'
  | 'concentration'
  | 'timing'
  | 'scalability'
  | 'economics'
  | 'execution';

export interface InvestmentCaseRisk {
  id: string;
  category: RiskCategory;
  title: string;
  description: string;
  riskType: RiskType;
  whyItMatters: string;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  relatedAssumptionIds: string[];
  relatedMechanismIds: string[];
  severity: 'critical' | 'material' | 'watch';
  confidence: 'high' | 'medium' | 'low';
}

export interface InvestmentCaseContradiction {
  id: string;
  topic: string;
  statementA: string;
  statementB: string;
  slideA?: number;
  slideB?: number;
  claimIdA?: string;
  claimIdB?: string;
  impact: string;
}

export interface InvestmentCaseQuestion {
  id: string;
  question: string;
  whyThisMatters: string;
  relatedAssumptionIds: string[];
  relatedMechanismIds: string[];
  relatedRiskIds: string[];
  answerability: 'well_supported' | 'partially_supported' | 'unanswered' | 'contradictory';
}

export interface InvestmentCaseSummary {
  thesisSummary: string;
  strongestSupportedMechanisms: string[];
  mostImportantUnprovenAssumptions: string[];
  thesisBottlenecks: string[];
  materialRisks: string[];
  highestLeverageFounderActions: string[];
}

export interface InvestmentCase {
  investmentThesis: StructuredInvestmentThesis;
  mechanisms: InvestmentCaseMechanism[];
  whatMustBeTrue: WhatMustBeTrue[];
  dependencies: InvestmentCaseDependency[];
  risks: InvestmentCaseRisk[];
  contradictions: InvestmentCaseContradiction[];
  unresolvedQuestions: InvestmentCaseQuestion[];
  caseSummary: InvestmentCaseSummary;
}
