import { StartupProfile } from '@/types/startup';
import { ClaimEvidenceMap } from '@/types/claim';
import { DeckDiagnostics } from '@/types/diagnostics';
import {
  CompanyEvaluationContext,
  DeclaredStageContext,
  DeclaredStageType,
  ObservedMaturityContext,
  ObservedMaturityType,
  BusinessModelContext,
  BusinessModelArchetype,
  CustomerSalesMotionContext,
  CustomerModelType,
  SalesMotionType,
  CapitalRegulatoryContext,
  LevelIntensity,
  FunctionalMaturity,
  ContextWarning,
  EvidenceReference,
} from '@/types/evaluation-context';

/**
 * Normalizes raw stage string into canonical DeclaredStageType.
 */
function normalizeStage(rawStage?: string): { normalizedStage: DeclaredStageType; sourceEvidence: string[] } {
  if (!rawStage || rawStage === 'not_found' || rawStage.trim() === '') {
    return { normalizedStage: 'unknown', sourceEvidence: [] };
  }

  const lower = rawStage.toLowerCase();
  const evidence = [`Declared stage in deck: "${rawStage}"`];

  if (lower.includes('pre-seed') || lower.includes('preseed') || lower.includes('concept') || lower.includes('idea')) {
    return { normalizedStage: 'pre_seed', sourceEvidence: evidence };
  }
  if (lower.includes('series a') || lower.includes('series-a')) {
    return { normalizedStage: 'series_a', sourceEvidence: evidence };
  }
  if (lower.includes('series b') || lower.includes('series c') || lower.includes('growth stage')) {
    return { normalizedStage: 'series_b_plus', sourceEvidence: evidence };
  }
  if (lower.includes('seed')) {
    return { normalizedStage: 'seed', sourceEvidence: evidence };
  }
  if (lower.includes('bootstrapped') || lower.includes('self-funded')) {
    return { normalizedStage: 'bootstrapped_or_unspecified', sourceEvidence: evidence };
  }

  return { normalizedStage: 'unknown', sourceEvidence: evidence };
}

/**
 * Evaluates observed operating maturity conservatively based strictly on deck facts.
 */
function evaluateObservedMaturity(
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null
): ObservedMaturityContext {
  const basis: string[] = [];

  const arrVal = profile?.traction?.ARR?.rawValue;
  const revVal = profile?.traction?.revenue?.rawValue;
  const mrrVal = profile?.traction?.MRR?.rawValue;
  const custVal = profile?.traction?.customerCount?.rawValue;
  const growthVal = profile?.traction?.growthRates?.rawValue;
  const prodDesc = profile?.problemSolution?.productDescription?.rawValue;

  const hasRevenue =
    (arrVal && arrVal !== 'not_found' && !arrVal.toLowerCase().includes('not found')) ||
    (revVal && revVal !== 'not_found' && !revVal.toLowerCase().includes('not found')) ||
    (mrrVal && mrrVal !== 'not_found' && !mrrVal.toLowerCase().includes('not found'));

  const hasCustomers = custVal && custVal !== 'not_found' && !custVal.toLowerCase().includes('not found');
  const hasGrowth = growthVal && growthVal !== 'not_found' && !growthVal.toLowerCase().includes('not found');

  const supportedTractionClaims = (claimMap?.claims || []).filter(
    (c) => (c.claimType === 'traction' || c.claimType === 'revenue') && c.supportStatus === 'supported'
  );

  if (hasRevenue && hasCustomers && (hasGrowth || supportedTractionClaims.length >= 2)) {
    basis.push('Paid customers present', 'Recurring revenue present', 'Growth or multi-period traction claims supported');
    if (arrVal && (arrVal.includes('10M') || arrVal.includes('50M') || arrVal.includes('100M'))) {
      return { value: 'scaling', confidence: 'high', basis };
    }
    if (hasGrowth || arrVal?.includes('M') || arrVal?.includes('million')) {
      return { value: 'repeatable_growth', confidence: 'high', basis };
    }
    return { value: 'emerging_repeatability', confidence: 'medium', basis };
  }

  if (hasRevenue || hasCustomers) {
    if (hasRevenue) basis.push('Initial customer revenue demonstrated');
    if (hasCustomers) basis.push('Initial customer count demonstrated');
    basis.push('Repeatable acquisition channels and long-term cohort retention not yet substantiated');
    return { value: 'early_market_evidence', confidence: 'high', basis };
  }

  if (prodDesc && prodDesc !== 'not_found') {
    basis.push('Product building/prototype described', 'No verified paying customer traction identified in deck');
    return { value: 'product_building', confidence: 'high', basis };
  }

  if (profile) {
    basis.push('Problem and initial concept formulated', 'Product and customer adoption remain in early validation');
    return { value: 'concept_validation', confidence: 'medium', basis };
  }

  return {
    value: 'unknown',
    confidence: 'low',
    basis: ['Insufficient profile evidence available to assign operating maturity'],
  };
}

/**
 * Classifies business model archetype and secondary archetypes.
 */
function evaluateBusinessModel(profile: StartupProfile | null): BusinessModelContext {
  const basis: string[] = [];
  const secondary: BusinessModelArchetype[] = [];

  const revModel = (profile?.businessModel?.revenueModel?.rawValue || '').toLowerCase();
  const customerType = (profile?.customerICP?.customerType?.rawValue || '').toLowerCase();
  const prodCategory = (profile?.problemSolution?.valueProposition?.rawValue || '').toLowerCase();
  const techDesc = (profile?.technology?.coreTechnology?.rawValue || '').toLowerCase();

  if (!profile || (revModel === 'not_found' && customerType === 'not_found' && prodCategory === 'not_found')) {
    return {
      primaryArchetype: 'unknown',
      secondaryArchetypes: [],
      confidence: 'low',
      basis: ['No business model or product category facts available in profile'],
    };
  }

  // Developer Tools
  if (customerType.includes('developer') || prodCategory.includes('api') || prodCategory.includes('sdk') || techDesc.includes('developer')) {
    basis.push('Target audience includes developers or API integration model');
    return { primaryArchetype: 'developer_tools', secondaryArchetypes: ['b2b_saas'], confidence: 'high', basis };
  }

  // AI Infrastructure vs AI Application
  if (techDesc.includes('llm') || techDesc.includes('ai') || prodCategory.includes('ai') || prodCategory.includes('machine learning')) {
    if (techDesc.includes('infrastructure') || techDesc.includes('model training') || techDesc.includes('gpu')) {
      basis.push('Core technology centers on AI infrastructure / foundation layer');
      return { primaryArchetype: 'ai_infrastructure', secondaryArchetypes: ['deeptech'], confidence: 'high', basis };
    }
    basis.push('Product applies AI to specific end-user or business workflows');
    secondary.push('b2b_saas');
    return { primaryArchetype: 'ai_application', secondaryArchetypes: secondary, confidence: 'high', basis };
  }

  // Marketplace
  if (revModel.includes('take rate') || revModel.includes('commission') || revModel.includes('marketplace') || prodCategory.includes('marketplace')) {
    basis.push('Revenue model operates via commission, platform take-rate, or buyer-seller matching');
    return { primaryArchetype: 'marketplace', secondaryArchetypes: ['transactional'], confidence: 'high', basis };
  }

  // DeepTech / Hardware / Biotech
  if (techDesc.includes('hardware') || prodCategory.includes('hardware') || prodCategory.includes('device')) {
    basis.push('Physical hardware or device component identified');
    return { primaryArchetype: 'hardware', secondaryArchetypes: ['capital_intensive'], confidence: 'high', basis };
  }
  if (techDesc.includes('biotech') || techDesc.includes('pharma') || techDesc.includes('clinical') || prodCategory.includes('health')) {
    basis.push('Biotech / clinical / healthcare technology focus identified');
    return { primaryArchetype: 'biotech_healthtech', secondaryArchetypes: ['capital_intensive'], confidence: 'high', basis };
  }
  if (techDesc.includes('patent') || techDesc.includes('deeptech') || techDesc.includes('quantum')) {
    basis.push('Deep technological IP or fundamental science foundation identified');
    return { primaryArchetype: 'deeptech', secondaryArchetypes: [], confidence: 'high', basis };
  }

  // Consumer
  if (customerType.includes('b2c') || customerType.includes('consumer') || customerType.includes('individual users')) {
    basis.push('Direct-to-consumer target audience');
    return { primaryArchetype: 'consumer', secondaryArchetypes: [], confidence: 'high', basis };
  }

  // Enterprise vs SMB Software vs B2B SaaS
  if (customerType.includes('enterprise') || revModel.includes('license') || revModel.includes('annual contract')) {
    basis.push('Targeting enterprise buyers with formal procurement/contracting');
    secondary.push('b2b_saas');
    return { primaryArchetype: 'enterprise_software', secondaryArchetypes: secondary, confidence: 'high', basis };
  }

  if (customerType.includes('smb') || customerType.includes('small business')) {
    basis.push('Targeting small and medium-sized business segment');
    secondary.push('b2b_saas');
    return { primaryArchetype: 'smb_software', secondaryArchetypes: secondary, confidence: 'high', basis };
  }

  if (revModel.includes('saas') || revModel.includes('subscription') || revModel.includes('recurring')) {
    basis.push('Recurring subscription revenue model stated');
    return { primaryArchetype: 'b2b_saas', secondaryArchetypes: [], confidence: 'high', basis };
  }

  if (revModel.includes('usage') || revModel.includes('consumption')) {
    basis.push('Usage-based or consumption monetization model stated');
    return { primaryArchetype: 'usage_based', secondaryArchetypes: ['b2b_saas'], confidence: 'high', basis };
  }

  if (revModel && revModel !== 'not_found') {
    basis.push(`Stated monetization: "${revModel}"`);
    return { primaryArchetype: 'other', secondaryArchetypes: [], confidence: 'medium', basis };
  }

  return {
    primaryArchetype: 'unknown',
    secondaryArchetypes: [],
    confidence: 'low',
    basis: ['Business model classification relies on limited qualitative deck text'],
  };
}

/**
 * Classifies customer model and sales motion.
 */
function evaluateCustomerSalesMotion(profile: StartupProfile | null): CustomerSalesMotionContext {
  const basis: string[] = [];
  const custText = (profile?.customerICP?.customerType?.rawValue || '').toLowerCase();
  const motionText = (profile?.goToMarket?.salesMotion?.rawValue || '').toLowerCase();
  const pricingText = (profile?.businessModel?.pricingValues?.rawValue || '').toLowerCase();

  let customerModel: CustomerModelType = 'unknown';
  const hasEnt = custText.includes('enterprise');
  const hasSMB = custText.includes('smb') || custText.includes('small business');
  const hasB2C = custText.includes('consumer') || custText.includes('b2c');

  if ((hasEnt && hasSMB) || (hasEnt && hasB2C) || (hasSMB && hasB2C)) {
    customerModel = 'mixed';
  } else if (hasEnt) customerModel = 'enterprise';
  else if (custText.includes('mid-market') || custText.includes('midmarket')) customerModel = 'mid_market';
  else if (hasSMB) customerModel = 'smb';
  else if (hasB2C) customerModel = 'consumer';
  else if (custText.includes('developer')) customerModel = 'developer';
  else if (custText.includes('government') || custText.includes('public sector')) customerModel = 'government';
  else if (custText && custText !== 'not_found') customerModel = 'mixed';

  let salesMotion: SalesMotionType = 'unknown';
  if (motionText.includes('self-serve') || motionText.includes('freemium') || motionText.includes('plg')) salesMotion = 'self_serve';
  else if (motionText.includes('enterprise') || motionText.includes('direct sales') || motionText.includes('outbound') || motionText.includes('field sales')) salesMotion = 'enterprise_sales';
  else if (motionText.includes('inside sales') || motionText.includes('demo')) salesMotion = 'inside_sales';
  else if (motionText.includes('founder') || motionText.includes('founder-led')) salesMotion = 'founder_led';
  else if (motionText.includes('channel') || motionText.includes('partner')) salesMotion = 'partnership_led';
  else if (motionText && motionText !== 'not_found') salesMotion = 'mixed';

  if (customerModel !== 'unknown') basis.push(`Customer segment: ${customerModel}`);
  if (salesMotion !== 'unknown') basis.push(`Sales motion: ${salesMotion}`);

  return {
    customerModel,
    salesMotion,
    monetizationModel: pricingText && pricingText !== 'not_found' ? pricingText : profile?.businessModel?.revenueModel?.rawValue || 'Not detailed',
    basis: basis.length > 0 ? basis : ['Customer and sales motion facts derived from profile fields'],
  };
}

/**
 * Evaluates capital and regulatory intensity conservatively based on explicit evidence.
 */
function evaluateCapitalRegulatory(profile: StartupProfile | null): CapitalRegulatoryContext {
  const basis: string[] = [];
  const techText = (profile?.technology?.coreTechnology?.rawValue || '').toLowerCase();
  const prodText = (profile?.problemSolution?.productDescription?.rawValue || '').toLowerCase();
  const categoryText = (profile?.problemSolution?.valueProposition?.rawValue || '').toLowerCase();

  let capitalIntensity: LevelIntensity = 'low';
  let regulatoryIntensity: LevelIntensity = 'low';

  // Capital intensity
  if (techText.includes('hardware') || techText.includes('semiconductor') || techText.includes('manufacturing') || prodText.includes('physical device')) {
    capitalIntensity = 'high';
    basis.push('Hardware development, manufacturing, or physical deployment capital requirements');
  } else if (techText.includes('biotech') || techText.includes('clinical trial') || categoryText.includes('clean energy')) {
    capitalIntensity = 'high';
    basis.push('Clinical research or deep science R&D capital intensity');
  } else if (techText.includes('infrastructure') || techText.includes('data center') || techText.includes('gpu')) {
    capitalIntensity = 'moderate';
    basis.push('Compute infrastructure or intensive R&D cost structure');
  }

  // Regulatory intensity
  if (categoryText.includes('biotech') || categoryText.includes('pharma') || prodText.includes('fda') || prodText.includes('clinical')) {
    regulatoryIntensity = 'high';
    basis.push('FDA approvals, medical device regulations, or clinical trial requirements');
  } else if (categoryText.includes('banking') || categoryText.includes('lending') || categoryText.includes('brokerage') || prodText.includes('compliance')) {
    regulatoryIntensity = 'moderate';
    basis.push('Financial services regulatory compliance (e.g. SEC, FINRA, FCA)');
  }

  if (basis.length === 0) {
    basis.push('Standard software capital profile with minimal explicit regulatory gating identified');
  }

  return { capitalIntensity, regulatoryIntensity, basis };
}

/**
 * Evaluates functional sub-maturities across revenue, traction, distribution, and product.
 */
function evaluateFunctionalMaturity(
  profile: StartupProfile | null,
  observedMaturity: ObservedMaturityType
): FunctionalMaturity {
  const arrVal = profile?.traction?.ARR?.rawValue;
  const custVal = profile?.traction?.customerCount?.rawValue;
  const motionText = (profile?.goToMarket?.salesMotion?.rawValue || '').toLowerCase();

  const hasRev = arrVal && arrVal !== 'not_found' && !arrVal.toLowerCase().includes('not found');
  const hasCust = custVal && custVal !== 'not_found' && !custVal.toLowerCase().includes('not found');

  return {
    revenueMaturity: hasRev
      ? arrVal?.includes('M') ? 'scaled_revenue' : 'recurring_revenue'
      : observedMaturity === 'concept_validation' ? 'none' : 'early_revenue',
    tractionMaturity: hasCust
      ? custVal?.includes('100') || custVal?.includes('1000') ? 'growing_customer_base' : 'early_customers'
      : observedMaturity === 'concept_validation' ? 'concept' : 'pilots_or_loi',
    distributionMaturity: motionText.includes('self-serve') || motionText.includes('enterprise sales')
      ? 'emerging_channels'
      : 'founder_led',
    productMaturity: observedMaturity === 'concept_validation'
      ? 'concept_or_design'
      : observedMaturity === 'product_building' ? 'prototype_mvp' : 'in_production',
  };
}

/**
 * Compiles evidence references from profile evidence arrays.
 */
function compileEvidenceReferences(profile: StartupProfile | null): EvidenceReference[] {
  const refs: EvidenceReference[] = [];
  if (!profile) return refs;

  const addRef = (topic: string, field?: { rawValue?: string; evidence?: { slideNumber: number }[] }) => {
    if (!field || !field.rawValue || field.rawValue === 'not_found') return;
    const slideNum = field.evidence?.[0]?.slideNumber || 1;
    refs.push({ slideNumber: slideNum, topic, statement: field.rawValue });
  };

  addRef('Stage', profile.fundraising?.currentStage);
  addRef('Ask', profile.fundraising?.amountBeingRaised);
  addRef('Revenue', profile.traction?.ARR || profile.traction?.revenue);
  addRef('Customers', profile.traction?.customerCount);
  addRef('ICP', profile.customerICP?.customerType);
  addRef('Business Model', profile.businessModel?.revenueModel);
  addRef('Sales Motion', profile.goToMarket?.salesMotion);

  return refs;
}

/**
 * Generates context warnings for operational or structural misalignments.
 */
function generateContextWarnings(
  declaredStage: DeclaredStageContext,
  observedMaturity: ObservedMaturityContext,
  businessModel: BusinessModelContext,
  customerSalesMotion: CustomerSalesMotionContext,
  capitalRegulatory: CapitalRegulatoryContext
): ContextWarning[] {
  const warnings: ContextWarning[] = [];

  // 1. Stage vs Maturity Mismatch Warning
  const normStage = declaredStage.normalizedStage;
  const obsMat = observedMaturity.value;

  if (normStage === 'series_a' && (obsMat === 'concept_validation' || obsMat === 'product_building' || obsMat === 'early_market_evidence')) {
    warnings.push({
      type: 'DECLARED_STAGE_MATURITY_MISMATCH',
      severity: 'warning',
      message: 'Declared fundraising stage (Series A) exceeds demonstrated operating maturity based on deck evidence.',
      explanation: 'The fundraising label and demonstrated operating maturity appear misaligned based on the evidence currently presented.',
    });
  } else if (normStage === 'pre_seed' && (obsMat === 'repeatable_growth' || obsMat === 'scaling')) {
    warnings.push({
      type: 'DECLARED_STAGE_MATURITY_MISMATCH',
      severity: 'info',
      message: 'Demonstrated operating maturity significantly exceeds typical pre-seed stage baseline.',
      explanation: 'Traction and revenue metrics in the deck demonstrate advanced operating maturity relative to the declared pre-seed label.',
    });
  }

  // 2. Customer ICP vs Pricing vs Sales Motion Mismatch
  if (
    customerSalesMotion.customerModel === 'smb' &&
    customerSalesMotion.salesMotion === 'self_serve' &&
    customerSalesMotion.monetizationModel.toLowerCase().includes('100k')
  ) {
    warnings.push({
      type: 'CUSTOMER_PRICING_MOTION_MISMATCH',
      severity: 'critical',
      message: 'High ACV enterprise pricing stated for small business segment with self-serve sales motion.',
      explanation: 'ACV contract value, target customer segment, and customer acquisition channels conflict fundamentally.',
    });
  }

  // 3. Unclear Sales Motion Warning
  if (customerSalesMotion.salesMotion === 'unknown') {
    warnings.push({
      type: 'SALES_MOTION_UNCLEAR',
      severity: 'warning',
      message: 'Go-to-market distribution motion is not detailed in the deck facts.',
      explanation: 'The deck asserts product and customer target without specifying the customer acquisition mechanism.',
    });
  }

  // 4. Low Confidence Business Model Warning
  if (businessModel.confidence === 'low') {
    warnings.push({
      type: 'BUSINESS_MODEL_CLASSIFICATION_LOW_CONFIDENCE',
      severity: 'warning',
      message: 'Business model archetype relies on limited qualitative text.',
      explanation: 'Monetization mechanics, pricing tiers, or fee structures are insufficiently detailed in extracted deck text.',
    });
  }

  // 5. High Capital Intensity without Capital Plan Warning
  if (capitalRegulatory.capitalIntensity === 'high') {
    warnings.push({
      type: 'CAPITAL_PLAN_CONTEXT_INCOMPLETE',
      severity: 'warning',
      message: 'High capital intensity profile requires explicit milestone and runway context.',
      explanation: 'Hardware, deeptech, or biotech capital requirements demand detailed milestone allocation.',
    });
  }

  return warnings;
}

/**
 * Builds canonical, immutable CompanyEvaluationContext.
 * 
 * PURE DETERMINISTIC FUNCTION:
 * - No Gemini calls
 * - No system clock / Date.now()
 * - No randomness
 * 
 * @param profile StartupProfile extracted from deck
 * @param claimMap ClaimEvidenceMap extracted from deck
 * @param diagnostics DeckDiagnostics compiled from deck
 * @returns CompanyEvaluationContext
 */
export function buildCompanyEvaluationContext(
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  diagnostics: DeckDiagnostics | null
): CompanyEvaluationContext {
  const rawStage = profile?.fundraising?.currentStage?.rawValue;
  const declaredStage = normalizeStage(rawStage);

  const observedMaturity = evaluateObservedMaturity(profile, claimMap);
  const businessModel = evaluateBusinessModel(profile);
  const customerSalesMotion = evaluateCustomerSalesMotion(profile);
  const capitalRegulatory = evaluateCapitalRegulatory(profile);
  const functionalMaturity = evaluateFunctionalMaturity(profile, observedMaturity.value);
  const evidenceReferences = compileEvidenceReferences(profile);

  const companyCategory = profile?.problemSolution?.valueProposition?.rawValue || 'Software / Technology';

  const contextWarnings = generateContextWarnings(
    declaredStage,
    observedMaturity,
    businessModel,
    customerSalesMotion,
    capitalRegulatory
  );

  const evaluationLens = `Evaluating ${businessModel.primaryArchetype.replace(/_/g, ' ').toUpperCase()} startup at ${observedMaturity.value.replace(/_/g, ' ')} operating maturity (${declaredStage.normalizedStage} stage).`;

  return {
    declaredStage,
    observedMaturity,
    businessModel,
    customerSalesMotion,
    capitalRegulatory,
    functionalMaturity,
    companyCategory,
    evaluationLens,
    contextWarnings,
    evidenceReferences,
  };
}

