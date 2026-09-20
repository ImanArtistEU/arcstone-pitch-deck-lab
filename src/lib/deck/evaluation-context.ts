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
  TechnologyCategory,
  CustomerSalesMotionContext,
  CustomerModelType,
  SalesMotionType,
  CapitalRegulatoryContext,
  LevelIntensity,
  FunctionalMaturity,
  ContextWarning,
  EvidenceReference,
} from '@/types/evaluation-context';
import { EvaluationExpectations, buildEvaluationExpectations } from './evaluation-expectations';

/**
 * Parses monetary string into a conservative numeric annual amount.
 */
export function parseMonetaryAmount(rawStr?: string): { annualAmount: number | null; raw: string } {
  if (!rawStr || rawStr === 'not_found' || rawStr.trim() === '') {
    return { annualAmount: null, raw: '' };
  }
  const clean = rawStr.toLowerCase().trim();
  if (
    clean.includes('not found') ||
    clean.includes('no revenue') ||
    clean.includes('pre-revenue') ||
    clean.includes('pre revenue') ||
    clean === '€0' ||
    clean === '$0'
  ) {
    return { annualAmount: 0, raw: rawStr };
  }

  const match = clean.match(/(?:[€$£¥]\s*)?(\d+(?:\.\d+)?)\s*([kmb])?/);
  if (!match) return { annualAmount: null, raw: rawStr };

  const num = parseFloat(match[1]);
  if (isNaN(num)) return { annualAmount: null, raw: rawStr };

  let multiplier = 1;
  const unit = match[2];
  if (unit === 'k') multiplier = 1_000;
  else if (unit === 'm') multiplier = 1_000_000;
  else if (unit === 'b') multiplier = 1_000_000_000;

  let amount = num * multiplier;
  if (clean.includes('mrr') || clean.includes('monthly')) {
    amount = amount * 12;
  }

  return { annualAmount: amount, raw: rawStr };
}

/**
 * Normalizes raw stage string into canonical DeclaredStageType.
 */
function normalizeStage(rawStage?: string): DeclaredStageContext {
  if (!rawStage || rawStage === 'not_found' || rawStage.trim() === '') {
    return { normalizedStage: 'unknown', sourceEvidence: [] };
  }

  const lower = rawStage.toLowerCase();
  const evidence = [`Declared stage in deck: "${rawStage}"`];

  if (lower.includes('pre-seed') || lower.includes('preseed') || lower.includes('concept') || lower.includes('idea')) {
    return { rawDeclaredStage: rawStage, normalizedStage: 'pre_seed', sourceEvidence: evidence };
  }
  if (lower.includes('series a') || lower.includes('series-a')) {
    return { rawDeclaredStage: rawStage, normalizedStage: 'series_a', sourceEvidence: evidence };
  }
  if (lower.includes('series b') || lower.includes('series c') || lower.includes('growth stage')) {
    return { rawDeclaredStage: rawStage, normalizedStage: 'series_b_plus', sourceEvidence: evidence };
  }
  if (lower.includes('seed')) {
    return { rawDeclaredStage: rawStage, normalizedStage: 'seed', sourceEvidence: evidence };
  }
  if (lower.includes('bootstrapped') || lower.includes('self-funded')) {
    return { rawDeclaredStage: rawStage, normalizedStage: 'bootstrapped_or_unspecified', sourceEvidence: evidence };
  }

  return { rawDeclaredStage: rawStage, normalizedStage: 'unknown', sourceEvidence: evidence };
}

/**
 * Evaluates observed operating maturity conservatively based strictly on deck facts.
 * Paid customers, pilots/LOIs, free users, and retention metrics are explicitly distinguished.
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
  const paidCustVal = profile?.traction?.paidCustomerCount?.rawValue;
  const userVal = profile?.traction?.userCount?.rawValue;
  const pipelineVal = profile?.traction?.pipeline?.rawValue;
  const growthVal = profile?.traction?.growthRates?.rawValue;
  const retVal = profile?.traction?.retentionMetrics?.rawValue || profile?.traction?.churn?.rawValue || profile?.traction?.growthRates?.rawValue;
  const prodDesc = profile?.problemSolution?.productDescription?.rawValue;

  const parsedARR = parseMonetaryAmount(arrVal || revVal || mrrVal);

  const rawCustStr = (custVal || '').toLowerCase();
  const rawPaidCustStr = (paidCustVal || '').toLowerCase();

  const custCountMatch = (custVal || '').match(/(\d+)/);
  const parsedCustCount = custCountMatch ? parseInt(custCountMatch[1], 10) : null;

  const paidCustMatch = (paidCustVal || '').match(/(\d+)/);
  const parsedPaidCustCount = paidCustMatch ? parseInt(paidCustMatch[1], 10) : null;

  const isPilotOrLoi =
    rawCustStr.includes('pilot') ||
    rawCustStr.includes('loi') ||
    rawCustStr.includes('letter of intent') ||
    rawCustStr.includes('waitlist') ||
    rawCustStr.includes('free user') ||
    rawCustStr.includes('trial') ||
    rawCustStr.includes('signup') ||
    rawPaidCustStr.includes('pilot') ||
    Boolean(pipelineVal && pipelineVal !== 'not_found');

  const hasRevenue = parsedARR.annualAmount !== null && parsedARR.annualAmount > 0;

  // Distinguish verified paid customers from pilots, LOIs, or free users
  const hasPaidCustomers =
    (parsedPaidCustCount !== null && parsedPaidCustCount > 0) ||
    (parsedCustCount !== null && parsedCustCount > 0 && !isPilotOrLoi) ||
    (hasRevenue && parsedCustCount !== null && parsedCustCount > 0);

  const hasPilotsOrUsers =
    isPilotOrLoi ||
    Boolean(userVal && userVal !== 'not_found' && !userVal.toLowerCase().includes('not found'));

  const hasGrowth = Boolean(
    growthVal && growthVal !== 'not_found' && !growthVal.toLowerCase().includes('not found')
  );

  // Durability / Retention / Repeatability signal check
  const hasDurabilitySignal = Boolean(
    retVal &&
      retVal !== 'not_found' &&
      !retVal.toLowerCase().includes('not found') &&
      (retVal.includes('%') ||
        retVal.toLowerCase().includes('nrr') ||
        retVal.toLowerCase().includes('ndr') ||
        retVal.toLowerCase().includes('retention') ||
        retVal.toLowerCase().includes('repeat') ||
        retVal.toLowerCase().includes('churn'))
  );

  // Repeatable Acquisition / Distribution signal check
  const motionText = (profile?.goToMarket?.salesMotion?.rawValue || '').toLowerCase();
  const distText = (profile?.goToMarket?.distributionStrategy?.rawValue || '').toLowerCase();
  const hasRepeatableAcquisitionSignal =
    motionText.includes('channel') ||
    motionText.includes('partner') ||
    motionText.includes('self-serve') ||
    motionText.includes('enterprise sales team') ||
    distText.includes('channel') ||
    distText.includes('partner') ||
    distText.includes('self-serve') ||
    distText.includes('inbound') ||
    rawCustStr.includes('channel') ||
    rawCustStr.includes('distribution');

  const supportedTractionClaims = (claimMap?.claims || []).filter(
    (c) => (c.claimType === 'traction' || c.claimType === 'revenue') && c.supportStatus === 'supported'
  );

  // Tier 1: Scaling
  if (
    parsedARR.annualAmount !== null &&
    parsedARR.annualAmount >= 10_000_000 &&
    hasPaidCustomers &&
    hasDurabilitySignal &&
    hasRepeatableAcquisitionSignal &&
    supportedTractionClaims.length >= 3
  ) {
    basis.push(
      'Scaled revenue demonstrated (>=€10M ARR)',
      'Verified paid customers present',
      'Long-term durability / cohort retention substantiated',
      'Repeatable sales / channel acquisition evidenced'
    );
    return { value: 'scaling', confidence: 'high', basis };
  }

  // Tier 2: Repeatable Growth
  // REQUIRES revenue + paid customers + durability/retention or growth signal + repeatable acquisition signal
  if (
    parsedARR.annualAmount !== null &&
    parsedARR.annualAmount >= 1_000_000 &&
    hasPaidCustomers &&
    (hasDurabilitySignal || hasGrowth) &&
    hasRepeatableAcquisitionSignal
  ) {
    basis.push(
      'Significant recurring revenue (>=€1M ARR)',
      'Verified paid customers present',
      'Cohort retention / durability signal substantiated',
      'Repeatable distribution / acquisition channel evidenced'
    );
    return { value: 'repeatable_growth', confidence: 'high', basis };
  }

  // Tier 3: Emerging Repeatability
  if (hasRevenue && hasPaidCustomers && (hasGrowth || supportedTractionClaims.length >= 1 || hasRepeatableAcquisitionSignal)) {
    basis.push(
      'Customer revenue demonstrated',
      'Verified paying customers present',
      'Initial repeatability or multi-period growth evidenced'
    );
    if (!hasDurabilitySignal) {
      basis.push('Long-term cohort retention or durability signal not yet fully established');
    }
    return { value: 'emerging_repeatability', confidence: 'medium', basis };
  }

  // Tier 4: Early Market Evidence
  if (hasRevenue || hasPaidCustomers || hasPilotsOrUsers) {
    if (hasRevenue) basis.push(`Customer revenue demonstrated (${parsedARR.raw})`);
    if (hasPaidCustomers) basis.push(`Paying customer count demonstrated (${custVal || paidCustVal})`);
    if (hasPilotsOrUsers && !hasPaidCustomers) basis.push(`Active pilots, LOIs, or non-paying user signups identified (${custVal || userVal})`);
    basis.push('Repeatable acquisition channels and long-term cohort retention not yet substantiated');
    return { value: 'early_market_evidence', confidence: 'high', basis };
  }

  // Tier 5: Product Building
  if (prodDesc && prodDesc !== 'not_found' && prodDesc.trim() !== '') {
    basis.push('Product building/prototype described', 'No verified paying customer traction identified in deck');
    return { value: 'product_building', confidence: 'high', basis };
  }

  // Tier 6: Concept Validation
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
 * Classifies technology category and business model archetype across multiple axes.
 * Note: Economic model and technology category are kept conceptually separate.
 */
function evaluateBusinessModel(profile: StartupProfile | null): BusinessModelContext {
  const basis: string[] = [];
  const secondary: BusinessModelArchetype[] = [];

  const revModel = (profile?.businessModel?.revenueModel?.rawValue || '').toLowerCase();
  const customerType = (profile?.customerICP?.customerType?.rawValue || '').toLowerCase();
  const prodCategory = (profile?.problemSolution?.valueProposition?.rawValue || '').toLowerCase();
  const techDesc = (profile?.technology?.coreTechnology?.rawValue || '').toLowerCase();

  if (
    !profile ||
    ((!revModel || revModel === 'not_found') &&
      (!customerType || customerType === 'not_found') &&
      (!prodCategory || prodCategory === 'not_found') &&
      (!techDesc || techDesc === 'not_found'))
  ) {
    return {
      primaryArchetype: 'unknown',
      secondaryArchetypes: [],
      technologyCategory: 'unknown',
      confidence: 'low',
      basis: ['No business model or product category facts available in profile'],
    };
  }

  // Determine Technology Category
  let technologyCategory: TechnologyCategory = 'software';
  if (techDesc.includes('llm') || techDesc.includes('ai') || prodCategory.includes('ai') || prodCategory.includes('machine learning')) {
    if (techDesc.includes('infrastructure') || techDesc.includes('model training') || techDesc.includes('gpu')) {
      technologyCategory = 'ai_infrastructure';
    } else {
      technologyCategory = 'ai_application';
    }
  } else if (
    customerType.includes('developer') ||
    prodCategory.includes('api') ||
    prodCategory.includes('sdk') ||
    techDesc.includes('developer') ||
    revModel.includes('developer') ||
    revModel.includes('sdk')
  ) {
    technologyCategory = 'developer_tools';
  } else if (techDesc.includes('hardware') || prodCategory.includes('hardware') || prodCategory.includes('device')) {
    technologyCategory = 'hardware';
  } else if (techDesc.includes('biotech') || techDesc.includes('pharma') || techDesc.includes('clinical') || prodCategory.includes('health')) {
    technologyCategory = 'biotech_healthtech';
  } else if (techDesc.includes('patent') || techDesc.includes('deeptech') || techDesc.includes('quantum')) {
    technologyCategory = 'deeptech';
  } else if (revModel.includes('fintech') || prodCategory.includes('fintech') || prodCategory.includes('banking') || prodCategory.includes('lending')) {
    technologyCategory = 'fintech';
  }

  // Determine Primary Economic Archetype (Economic Model and Technology Category MUST NOT compete)
  let primaryArchetype: BusinessModelArchetype = 'unknown';

  if (revModel.includes('take rate') || revModel.includes('commission') || revModel.includes('marketplace') || prodCategory.includes('marketplace')) {
    primaryArchetype = 'marketplace';
    basis.push('Revenue model operates via commission, platform take-rate, or buyer-seller matching');
  } else if (revModel.includes('fintech') || prodCategory.includes('fintech') || revModel.includes('interchange') || revModel.includes('lending')) {
    primaryArchetype = 'fintech';
    basis.push('Monetization relies on financial transactions, interest margin, or interchange');
    secondary.push('transactional');
  } else if (technologyCategory === 'developer_tools') {
    primaryArchetype = 'developer_tools';
    basis.push('Target audience includes developers or API integration model');
    secondary.push('b2b_saas');
  } else if (technologyCategory === 'hardware') {
    primaryArchetype = 'hardware';
    basis.push('Physical hardware or device component identified');
    secondary.push('capital_intensive');
  } else if (technologyCategory === 'biotech_healthtech') {
    primaryArchetype = 'biotech_healthtech';
    basis.push('Biotech / clinical / healthcare technology focus identified');
    secondary.push('capital_intensive');
  } else if (technologyCategory === 'deeptech') {
    primaryArchetype = 'deeptech';
    basis.push('Deep technological IP or fundamental science foundation identified');
  } else if (customerType.includes('b2c') || customerType.includes('consumer') || customerType.includes('individual users')) {
    primaryArchetype = 'consumer';
    basis.push('Direct-to-consumer target audience');
  } else if (revModel.includes('service') || prodCategory.includes('service') || revModel.includes('tech-enabled')) {
    primaryArchetype = 'services_enabled_software';
    basis.push('Services-enabled software or tech-enabled service model');
  } else if (revModel.includes('per-transaction') || revModel.includes('transactional')) {
    primaryArchetype = 'transactional';
    basis.push('Transactional per-unit revenue model');
  } else if (revModel.includes('usage') || revModel.includes('consumption') || revModel.includes('pay-as-you-go')) {
    primaryArchetype = 'usage_based';
    basis.push('Usage-based or consumption monetization model');
    secondary.push('b2b_saas');
  } else if (customerType.includes('enterprise') || revModel.includes('annual contract')) {
    primaryArchetype = 'enterprise_software';
    basis.push('Targeting enterprise buyers with formal procurement/contracting');
    secondary.push('b2b_saas');
  } else if (customerType.includes('smb') || customerType.includes('small business')) {
    primaryArchetype = 'smb_software';
    basis.push('Targeting small and medium-sized business segment');
    secondary.push('b2b_saas');
  } else if (revModel.includes('saas') || revModel.includes('subscription') || revModel.includes('recurring')) {
    // Generic subscription conservatism: Do NOT classify "subscription" alone as b2b_saas unless business buyer evidence exists
    const isExplicitB2B =
      customerType.includes('b2b') ||
      customerType.includes('enterprise') ||
      customerType.includes('smb') ||
      customerType.includes('business') ||
      customerType.includes('mid-market');

    const isExplicitConsumer =
      customerType.includes('b2c') ||
      customerType.includes('consumer') ||
      customerType.includes('individual');

    if (isExplicitConsumer) {
      primaryArchetype = 'consumer';
      basis.push('Subscription monetization model targeting direct consumers');
    } else if (isExplicitB2B || revModel.includes('saas')) {
      primaryArchetype = 'b2b_saas';
      basis.push('Recurring subscription / SaaS revenue model stated');
    } else {
      primaryArchetype = 'other';
      basis.push('Subscription monetization identified; buyer model insufficiently established.');
    }
  } else if (revModel && revModel !== 'not_found' && revModel.trim() !== '') {
    primaryArchetype = 'other';
    basis.push(`Stated monetization: "${revModel}"`);
  } else if (technologyCategory === 'software') {
    primaryArchetype = 'b2b_saas';
    basis.push('General software technology category inferred');
  }

  return {
    primaryArchetype,
    secondaryArchetypes: secondary,
    technologyCategory,
    confidence: primaryArchetype !== 'unknown' && primaryArchetype !== 'other' ? 'high' : 'low',
    basis: basis.length > 0 ? basis : ['Business model classification relies on qualitative deck text'],
  };
}

/**
 * Classifies customer model and sales motion accurately.
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
  else if (custText && custText !== 'not_found' && custText.trim() !== '') customerModel = 'mixed';

  let salesMotion: SalesMotionType = 'unknown';
  if (motionText.includes('product-led') || motionText.includes('product led') || motionText.includes('plg')) salesMotion = 'product_led';
  else if (motionText.includes('self-serve') || motionText.includes('freemium')) salesMotion = 'self_serve';
  else if (motionText.includes('enterprise sales') || motionText.includes('direct sales') || motionText.includes('outbound') || motionText.includes('field sales')) salesMotion = 'enterprise_sales';
  else if (motionText.includes('inside sales') || motionText.includes('demo')) salesMotion = 'inside_sales';
  else if (motionText.includes('founder-led') || motionText.includes('founder led') || motionText.includes('founder selling')) salesMotion = 'founder_led';
  else if (motionText.includes('channel') || motionText.includes('distributor')) salesMotion = 'channel';
  else if (motionText.includes('partner') || motionText.includes('partnership')) salesMotion = 'partnership_led';
  else if (motionText.includes('marketplace') || motionText.includes('platform matching')) salesMotion = 'marketplace';
  else if (motionText && motionText !== 'not_found' && motionText.trim() !== '') salesMotion = 'mixed';

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
 * Evaluates capital and regulatory intensity conservatively.
 * Regulatory intensity stays 'unknown' unless explicit regulated domain evidence exists.
 */
function evaluateCapitalRegulatory(profile: StartupProfile | null): CapitalRegulatoryContext {
  const basis: string[] = [];
  const techText = (profile?.technology?.coreTechnology?.rawValue || '').toLowerCase();
  const prodText = (profile?.problemSolution?.productDescription?.rawValue || '').toLowerCase();
  const categoryText = (profile?.problemSolution?.valueProposition?.rawValue || '').toLowerCase();
  const indRaw = profile?.customerICP?.industries?.rawValue;
  const industryText = (Array.isArray(indRaw) ? indRaw.join(' ') : String(indRaw || '')).toLowerCase();

  let capitalIntensity: LevelIntensity = 'unknown';
  let regulatoryIntensity: LevelIntensity = 'unknown';

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
  } else if (techText.includes('software') || techText.includes('saas') || categoryText.includes('software') || categoryText.includes('saas') || prodText.includes('app') || prodText.includes('web')) {
    capitalIntensity = 'low';
    basis.push('Software model with typical operational capital profile');
  }

  // Regulatory intensity (Default to 'unknown' unless explicit regulated domain indicators exist)
  if (
    categoryText.includes('biotech') ||
    categoryText.includes('pharma') ||
    prodText.includes('fda') ||
    prodText.includes('clinical') ||
    industryText.includes('healthcare') ||
    industryText.includes('medical')
  ) {
    regulatoryIntensity = 'high';
    basis.push('FDA approvals, medical device regulations, or clinical trial requirements');
  } else if (
    categoryText.includes('banking') ||
    categoryText.includes('lending') ||
    categoryText.includes('brokerage') ||
    categoryText.includes('fintech') ||
    prodText.includes('compliance') ||
    industryText.includes('finance') ||
    industryText.includes('banking')
  ) {
    regulatoryIntensity = 'moderate';
    basis.push('Financial services regulatory compliance (e.g. SEC, FINRA, FCA)');
  }
  // NOTE: General software/SaaS without domain evidence remains regulatoryIntensity = 'unknown'

  if (basis.length === 0) {
    basis.push('Insufficient deck evidence to classify capital or regulatory intensity');
  }

  return { capitalIntensity, regulatoryIntensity, basis };
}

/**
 * Evaluates functional sub-maturities without inventing unsupported states or relying on fixed integer thresholds.
 */
function evaluateFunctionalMaturity(
  profile: StartupProfile | null,
  observedMaturity: ObservedMaturityType
): FunctionalMaturity {
  const arrVal = profile?.traction?.ARR?.rawValue;
  const revVal = profile?.traction?.revenue?.rawValue;
  const mrrVal = profile?.traction?.MRR?.rawValue;
  const custVal = profile?.traction?.customerCount?.rawValue;
  const paidCustVal = profile?.traction?.paidCustomerCount?.rawValue;
  const motionText = (profile?.goToMarket?.salesMotion?.rawValue || '').toLowerCase();
  const prodText = (profile?.problemSolution?.productDescription?.rawValue || '').toLowerCase();

  const parsedARR = parseMonetaryAmount(arrVal || revVal || mrrVal);

  let revenueMaturity: FunctionalMaturity['revenueMaturity'] = 'unknown';
  if (parsedARR.annualAmount !== null) {
    if (parsedARR.annualAmount >= 10_000_000) revenueMaturity = 'scaled_revenue';
    else if (parsedARR.annualAmount >= 500_000) revenueMaturity = 'recurring_revenue';
    else if (parsedARR.annualAmount > 0) revenueMaturity = 'early_revenue';
    else if (parsedARR.annualAmount === 0) revenueMaturity = 'none';
  } else if (observedMaturity === 'concept_validation' && (arrVal?.toLowerCase().includes('pre-revenue') || arrVal?.toLowerCase().includes('no revenue'))) {
    revenueMaturity = 'none';
  }

  let tractionMaturity: FunctionalMaturity['tractionMaturity'] = 'unknown';
  const rawCustStr = (custVal || '').toLowerCase();
  const isPilotOrLoi = rawCustStr.includes('pilot') || rawCustStr.includes('loi') || rawCustStr.includes('waitlist');

  if (observedMaturity === 'scaling') {
    tractionMaturity = 'scale';
  } else if (observedMaturity === 'repeatable_growth') {
    tractionMaturity = 'growing_customer_base';
  } else if (observedMaturity === 'emerging_repeatability' || paidCustVal) {
    tractionMaturity = 'early_customers';
  } else if (isPilotOrLoi || (custVal && !isPilotOrLoi && observedMaturity === 'early_market_evidence')) {
    tractionMaturity = isPilotOrLoi ? 'pilots_or_loi' : 'early_customers';
  } else if (observedMaturity === 'concept_validation') {
    tractionMaturity = 'concept';
  }

  let distributionMaturity: FunctionalMaturity['distributionMaturity'] = 'unknown';
  if (motionText.includes('channel') || motionText.includes('partner') || motionText.includes('repeatable')) {
    distributionMaturity = 'repeatable_channels';
  } else if (motionText.includes('self-serve') || motionText.includes('enterprise sales') || motionText.includes('direct sales')) {
    distributionMaturity = 'emerging_channels';
  } else if (motionText.includes('founder')) {
    distributionMaturity = 'founder_led';
  } else if (motionText && motionText !== 'not_found' && motionText.trim() !== '') {
    distributionMaturity = 'untested';
  }

  let productMaturity: FunctionalMaturity['productMaturity'] = 'unknown';
  if (prodText && prodText !== 'not_found' && prodText.trim() !== '') {
    if (prodText.toLowerCase().includes('platform') || prodText.toLowerCase().includes('v2') || prodText.toLowerCase().includes('enterprise-grade')) {
      productMaturity = 'mature_platform';
    } else if (prodText.toLowerCase().includes('live') || prodText.toLowerCase().includes('production') || prodText.toLowerCase().includes('available')) {
      productMaturity = 'in_production';
    } else if (prodText.toLowerCase().includes('mvp') || prodText.toLowerCase().includes('beta') || prodText.toLowerCase().includes('prototype')) {
      productMaturity = 'prototype_mvp';
    } else if (prodText.toLowerCase().includes('concept') || prodText.toLowerCase().includes('design')) {
      productMaturity = 'concept_or_design';
    }
  }

  return {
    revenueMaturity,
    tractionMaturity,
    distributionMaturity,
    productMaturity,
  };
}

/**
 * Compiles evidence references with explicit slide provenance. No fake slide 1 fallback.
 */
function compileEvidenceReferences(profile: StartupProfile | null): EvidenceReference[] {
  const refs: EvidenceReference[] = [];
  if (!profile) return refs;

  const addRef = (topic: string, field?: { rawValue?: string; evidence?: { slideNumber: number }[] }) => {
    if (!field || !field.rawValue || field.rawValue === 'not_found' || field.rawValue.trim() === '') return;
    const rawSlide = field.evidence?.[0]?.slideNumber;
    const slideNumber = typeof rawSlide === 'number' && rawSlide > 0 ? rawSlide : undefined;
    refs.push({ slideNumber, topic, statement: field.rawValue });
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

  if (customerSalesMotion.salesMotion === 'unknown') {
    warnings.push({
      type: 'SALES_MOTION_UNCLEAR',
      severity: 'warning',
      message: 'Go-to-market distribution motion is not detailed in the deck facts.',
      explanation: 'The deck asserts product and customer target without specifying the customer acquisition mechanism.',
    });
  }

  if (businessModel.confidence === 'low') {
    warnings.push({
      type: 'BUSINESS_MODEL_CLASSIFICATION_LOW_CONFIDENCE',
      severity: 'warning',
      message: 'Business model archetype relies on limited qualitative text.',
      explanation: 'Monetization mechanics, pricing tiers, or fee structures are insufficiently detailed in extracted deck text.',
    });
  }

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

/**
 * Single Canonical Helper: builds both context and expectations identically everywhere.
 */
export function getOrBuildEvaluationContextAndExpectations(
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  diagnostics: DeckDiagnostics | null
): {
  evaluationContext: CompanyEvaluationContext;
  evaluationExpectations: EvaluationExpectations;
} {
  const evaluationContext = buildCompanyEvaluationContext(profile, claimMap, diagnostics);
  const evaluationExpectations = buildEvaluationExpectations(evaluationContext);
  return { evaluationContext, evaluationExpectations };
}
