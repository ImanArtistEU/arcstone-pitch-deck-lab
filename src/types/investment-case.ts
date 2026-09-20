/**
 * Production Canonical Investment Case & What-Must-Be-True Contract.
 * Underwriting primitives for institutional venture case reconstruction.
 */

export const MECHANISM_CATEGORIES = [
  'value_creation',
  'customer_acquisition',
  'distribution',
  'monetization',
  'retention',
  'growth',
  'market_expansion',
  'defensibility',
  'capital_efficiency',
  'technical_execution',
  'regulatory',
  'team_execution',
] as const;
export type MechanismCategory = (typeof MECHANISM_CATEGORIES)[number];

export const ASSUMPTION_IMPORTANCES = ['critical', 'high', 'medium', 'low'] as const;
export type AssumptionImportance = (typeof ASSUMPTION_IMPORTANCES)[number];

export const ASSUMPTION_ORIGINS = ['explicit', 'implicit'] as const;
export type AssumptionOrigin = (typeof ASSUMPTION_ORIGINS)[number];

export const EVIDENCE_STATUSES = [
  'supported',
  'partially_supported',
  'asserted_only',
  'unsupported',
  'contradictory',
  'not_yet_testable',
  'not_applicable',
  'unknown',
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const EVIDENCE_QUALITY_CLASSES = [
  'behavioral',
  'financial',
  'contractual',
  'cohort',
  'operational',
  'technical',
  'regulatory',
  'third_party',
  'market_research',
  'customer_quoted',
  'founder_assertion',
  'inferred',
  'unverified',
] as const;
export type EvidenceQualityClass = (typeof EVIDENCE_QUALITY_CLASSES)[number];

export const DEPENDENCY_RELATIONSHIPS = [
  'requires',
  'enables',
  'constrains',
  'amplifies',
  'conflicts_with',
] as const;
export type DependencyRelationship = (typeof DEPENDENCY_RELATIONSHIPS)[number];

export const RISK_CATEGORIES = [
  'customer',
  'product',
  'market',
  'distribution',
  'sales',
  'retention',
  'monetization',
  'economics',
  'competition',
  'defensibility',
  'technical',
  'regulatory',
  'capital',
  'team',
  'execution',
  'financing',
  'commercial',
  'financial',
  'other',
] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export const RISK_TYPES = [
  'evidence_gap',
  'assumption_risk',
  'dependency_risk',
  'contradiction',
  'concentration',
  'timing',
  'scalability',
  'economics',
  'execution',
  'commercial_tension',
  'unproven_durability',
  'founder_concentration',
  'capital_timing',
  'market_expansion',
  'other',
] as const;
export type RiskType = (typeof RISK_TYPES)[number];

export const RISK_SEVERITIES = ['critical', 'material', 'watch'] as const;
export type RiskSeverity = (typeof RISK_SEVERITIES)[number];

export const QUESTION_ANSWERABILITIES = [
  'well_supported',
  'partially_supported',
  'unanswered',
  'contradictory',
] as const;
export type QuestionAnswerability = (typeof QUESTION_ANSWERABILITIES)[number];

export const FOUNDER_ACTION_TYPES = [
  'PROVIDE_EXISTING_EVIDENCE',
  'ADD_DECK_EVIDENCE',
  'CLARIFY_NARRATIVE',
  'VERIFY_METRIC',
  'RESOLVE_CONTRADICTION',
  'PREPARE_DILIGENCE_ANSWER',
  'VALIDATE_BUSINESS_ASSUMPTION',
  'CHANGE_FUNDRAISING_CLAIM',
  'NO_ACTION_YET',
] as const;
export type FounderActionType = (typeof FOUNDER_ACTION_TYPES)[number];

export const FOUNDER_ACTION_SCOPES = [
  'deck_fix',
  'founder_input',
  'underlying_business',
  'diligence_prep',
] as const;
export type FounderActionScope = (typeof FOUNDER_ACTION_SCOPES)[number];

export type EvidenceSourceType =
  | 'profile'
  | 'claim'
  | 'claim_evidence'
  | 'diagnostic'
  | 'slide_text';

export interface InvestmentEvidenceReference {
  id: string;
  sourceType: EvidenceSourceType;
  statement: string;
  slideNumber?: number;
  claimId?: string;
  diagnosticId?: string;
  profilePath?: string;
}

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
  sourceEvidenceIds?: string[];
  inferredComponents?: string[];
  unresolvedComponents?: string[];
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
  supportingEvidenceIds?: string[];
  contradictingClaimIds: string[];
  contradictingSlideNumbers: number[];
  contradictingEvidenceIds?: string[];
  confidence: 'high' | 'medium' | 'low';
}

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
  supportingEvidenceIds?: string[];
  contradictingClaimIds: string[];
  contradictingSlideNumbers: number[];
  contradictingEvidenceIds?: string[];
  isThesisBottleneck: boolean;
  bottleneckReason?: string;
  suggestedFounderAction?: SuggestedFounderAction;
  confidence: 'high' | 'medium' | 'low';
}

export interface InvestmentCaseDependency {
  id: string;
  sourceId: string;
  targetId: string;
  relationship: DependencyRelationship;
  criticality: AssumptionImportance;
  explanation: string;
}

export interface InvestmentCaseRisk {
  id: string;
  category: RiskCategory;
  title: string;
  description: string;
  riskType: RiskType;
  whyItMatters: string;
  supportingEvidence: string[];
  supportingEvidenceIds?: string[];
  contradictingEvidence: string[];
  contradictingEvidenceIds?: string[];
  relatedAssumptionIds: string[];
  relatedMechanismIds: string[];
  severity: RiskSeverity;
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
  answerability: QuestionAnswerability;
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
