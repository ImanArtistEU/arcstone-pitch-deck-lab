/**
 * Canonical CompanyEvaluationContext interfaces.
 * Answers: "How should deck facts be interpreted for institutional evaluation?"
 */

export type DeclaredStageType =
  | 'pre_seed'
  | 'seed'
  | 'series_a'
  | 'series_b_plus'
  | 'bootstrapped_or_unspecified'
  | 'unknown';

export interface DeclaredStageContext {
  rawDeclaredStage?: string;
  normalizedStage: DeclaredStageType;
  sourceEvidence: string[];
}

export type ObservedMaturityType =
  | 'concept_validation'
  | 'product_building'
  | 'early_market_evidence'
  | 'emerging_repeatability'
  | 'repeatable_growth'
  | 'scaling'
  | 'unknown';

export interface ObservedMaturityContext {
  value: ObservedMaturityType;
  confidence: 'high' | 'medium' | 'low';
  basis: string[];
}

export type BusinessModelArchetype =
  | 'b2b_saas'
  | 'enterprise_software'
  | 'smb_software'
  | 'developer_tools'
  | 'consumer'
  | 'marketplace'
  | 'fintech'
  | 'deeptech'
  | 'hardware'
  | 'biotech_healthtech'
  | 'ai_infrastructure'
  | 'ai_application'
  | 'services_enabled_software'
  | 'transactional'
  | 'usage_based'
  | 'capital_intensive'
  | 'mixed'
  | 'other'
  | 'unknown';

export interface BusinessModelContext {
  primaryArchetype: BusinessModelArchetype;
  secondaryArchetypes: BusinessModelArchetype[];
  confidence: 'high' | 'medium' | 'low';
  basis: string[];
}

export type CustomerModelType =
  | 'enterprise'
  | 'mid_market'
  | 'smb'
  | 'consumer'
  | 'developer'
  | 'government'
  | 'mixed'
  | 'unknown';

export type SalesMotionType =
  | 'founder_led'
  | 'enterprise_sales'
  | 'inside_sales'
  | 'self_serve'
  | 'product_led'
  | 'channel'
  | 'marketplace'
  | 'partnership_led'
  | 'mixed'
  | 'unknown';

export interface CustomerSalesMotionContext {
  customerModel: CustomerModelType;
  salesMotion: SalesMotionType;
  monetizationModel: string;
  basis: string[];
}

export type LevelIntensity = 'low' | 'moderate' | 'high' | 'unknown';

export interface CapitalRegulatoryContext {
  capitalIntensity: LevelIntensity;
  regulatoryIntensity: LevelIntensity;
  basis: string[];
}

export type ContextWarningType =
  | 'DECLARED_STAGE_MATURITY_MISMATCH'
  | 'CUSTOMER_PRICING_MOTION_MISMATCH'
  | 'CAPITAL_PLAN_CONTEXT_INCOMPLETE'
  | 'BUSINESS_MODEL_CLASSIFICATION_LOW_CONFIDENCE'
  | 'TRACTION_MATURITY_UNCLEAR'
  | 'SALES_MOTION_UNCLEAR';

export interface ContextWarning {
  type: ContextWarningType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  explanation: string;
}

export interface FunctionalMaturity {
  revenueMaturity: 'none' | 'early_revenue' | 'recurring_revenue' | 'scaled_revenue' | 'unknown';
  tractionMaturity: 'concept' | 'pilots_or_loi' | 'early_customers' | 'growing_customer_base' | 'scale' | 'unknown';
  distributionMaturity: 'untested' | 'founder_led' | 'emerging_channels' | 'repeatable_channels' | 'unknown';
  productMaturity: 'concept_or_design' | 'prototype_mvp' | 'in_production' | 'mature_platform' | 'unknown';
}

export interface EvidenceReference {
  slideNumber: number;
  topic: string;
  statement: string;
}

export interface CompanyEvaluationContext {
  declaredStage: DeclaredStageContext;
  observedMaturity: ObservedMaturityContext;
  businessModel: BusinessModelContext;
  customerSalesMotion: CustomerSalesMotionContext;
  capitalRegulatory: CapitalRegulatoryContext;
  functionalMaturity: FunctionalMaturity;
  companyCategory: string;
  evaluationLens: string;
  contextWarnings: ContextWarning[];
  evidenceReferences: EvidenceReference[];
}

