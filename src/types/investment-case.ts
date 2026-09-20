/**
 * Deep Underwriting Primitives & Investment Case Contracts.
 * Future-facing intelligence types for Batch 5+.
 */

export type MechanismCategory =
  | 'value_creation'
  | 'distribution'
  | 'monetization'
  | 'growth'
  | 'retention'
  | 'market_expansion'
  | 'defensibility'
  | 'capital';

export interface InvestmentCaseMechanism {
  id: string;
  category: MechanismCategory;
  name: string;
  description: string;
  evidenceStatus: 'supported' | 'partially_supported' | 'unsupported' | 'unknown';
}

export interface InvestmentCaseAssumption {
  id: string;
  statement: string;
  category: string;
  isExplicit: boolean; // Explicitly stated vs implicitly required
  slideNumbers: number[];
  riskLevel: 'high' | 'medium' | 'low';
}

export interface InvestmentCaseDependency {
  id: string;
  dependentFactor: string;
  dependsOn: string;
  criticality: 'critical' | 'important' | 'secondary';
  status: 'validated' | 'unvalidated' | 'conflicting';
}

export interface InvestmentCaseRisk {
  id: string;
  title: string;
  category: string;
  description: string;
  impactIfTriggered: string;
  mitigantInDeck?: string;
  severity: 'critical' | 'material' | 'minor';
}

export interface WhatMustBeTrue {
  id: string;
  statement: string;
  category: MechanismCategory | string;
  importance: 'critical' | 'high' | 'medium';
  evidenceStatus: 'supported' | 'partially_supported' | 'unsupported' | 'unclear';
  supportingEvidence: string[];
  contradictingEvidence: string[];
  whyItMatters: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface InvestmentCaseContract {
  summary: {
    stage: string;
    businessModelType: string;
    fundraisingTarget: string;
    overallCaseQuality: string;
  };
  mechanisms: InvestmentCaseMechanism[];
  assumptions: InvestmentCaseAssumption[];
  dependencies: InvestmentCaseDependency[];
  risks: InvestmentCaseRisk[];
  whatMustBeTrue: WhatMustBeTrue[];
}

