/**
 * Basis of a extracted profile fact: explicit statement vs reasonable inference.
 */
export type FactBasis = 'explicit' | 'inferred';

/**
 * Source of slide evidence.
 */
export type ProvenanceSource = 'native_pdf' | 'visual_model' | 'both';

/**
 * Supporting slide evidence reference.
 */
export interface EvidenceReference {
  slideNumber: number;
  exactText: string;
  source: ProvenanceSource;
  confidence?: 'high' | 'medium' | 'low';
}

/**
 * Status of a profile field.
 */
export type FieldStatus = 'extracted' | 'conflicting' | 'not_found';

/**
 * Conflicting value instance across slides.
 */
export interface ConflictingValue {
  value: string;
  slideNumber: number;
  source: ProvenanceSource;
}

/**
 * Generic structured field wrapping raw value, normalized value, evidence provenance, and basis.
 */
export interface ProfileField<T = string> {
  status: FieldStatus;
  rawValue?: string;
  normalizedValue?: T;
  basis?: FactBasis;
  evidence: EvidenceReference[];
  conflictingValues?: ConflictingValue[];
}

/**
 * Company Identity Section
 */
export interface CompanyIdentity {
  companyName: ProfileField<string>;
  tagline: ProfileField<string>;
  website: ProfileField<string>;
  headquarters: ProfileField<string>;
  foundingYear: ProfileField<number>;
}

/**
 * Fundraising Section
 */
export interface FundraisingDetails {
  currentStage: ProfileField<string>;
  roundBeingRaised: ProfileField<string>;
  amountBeingRaised: ProfileField<string>;
  currency: ProfileField<string>;
  previousFunding: ProfileField<string>;
  useOfFunds: ProfileField<string[]>;
  runway: ProfileField<string>;
}

/**
 * Problem & Solution Section
 */
export interface ProblemSolution {
  problemStatement: ProfileField<string>;
  targetUserPain: ProfileField<string>;
  currentAlternatives: ProfileField<string>;
  productDescription: ProfileField<string>;
  valueProposition: ProfileField<string>;
  keyFeatures: ProfileField<string[]>;
  productCategory: ProfileField<string>;
}

/**
 * Customer / ICP Section
 */
export interface CustomerICP {
  customerType: ProfileField<string>;
  targetSegments: ProfileField<string[]>;
  industries: ProfileField<string[]>;
  geography: ProfileField<string[]>;
  buyerPersona: ProfileField<string>;
  endUser: ProfileField<string>;
}

/**
 * Business Model Section
 */
export interface BusinessModel {
  revenueModel: ProfileField<string>;
  pricingModel: ProfileField<string>;
  pricingValues: ProfileField<string>;
  unitEconomics: ProfileField<string>;
}

/**
 * Traction Section
 */
export interface TractionMetrics {
  revenue: ProfileField<string>;
  ARR: ProfileField<string>;
  MRR: ProfileField<string>;
  customerCount: ProfileField<string>;
  paidCustomerCount: ProfileField<string>;
  userCount: ProfileField<string>;
  growthRates: ProfileField<string>;
  retentionMetrics: ProfileField<string>;
  churn: ProfileField<string>;
  pipeline: ProfileField<string>;
  notableCustomers: ProfileField<string[]>;
}

/**
 * Go-To-Market Section
 */
export interface GoToMarket {
  acquisitionChannels: ProfileField<string[]>;
  salesMotion: ProfileField<string>;
  distributionStrategy: ProfileField<string>;
  partnerships: ProfileField<string[]>;
  expansionStrategy: ProfileField<string>;
}

/**
 * Market Opportunity Section
 */
export interface MarketOpportunity {
  TAM: ProfileField<string>;
  SAM: ProfileField<string>;
  SOM: ProfileField<string>;
  marketGrowth: ProfileField<string>;
  marketDefinition: ProfileField<string>;
  marketSource: ProfileField<string>;
}

/**
 * Competition Section
 */
export interface CompetitionInfo {
  namedCompetitors: ProfileField<string[]>;
  alternatives: ProfileField<string[]>;
  differentiationClaims: ProfileField<string[]>;
  positioningClaims: ProfileField<string[]>;
}

/**
 * Individual Team Member
 */
export interface TeamMember {
  name: string;
  role: string;
  background?: string;
  slideNumber: number;
}

/**
 * Team Section
 */
export interface TeamInfo {
  founders: TeamMember[];
  teamSize: ProfileField<string>;
  advisors: ProfileField<string[]>;
}

/**
 * Technology Section
 */
export interface TechnologyInfo {
  coreTechnology: ProfileField<string>;
  integrations: ProfileField<string[]>;
  proprietaryClaims: ProfileField<string[]>;
  aiMlClaims: ProfileField<string[]>;
}

/**
 * Material Factual Information Item
 */
export interface ImportantFact {
  category: string;
  fact: string;
  slideNumber: number;
  source: ProvenanceSource;
}

/**
 * Complete Canonical Startup Profile
 */
export interface StartupProfile {
  identity: CompanyIdentity;
  fundraising: FundraisingDetails;
  problemSolution: ProblemSolution;
  customerICP: CustomerICP;
  businessModel: BusinessModel;
  traction: TractionMetrics;
  goToMarket: GoToMarket;
  market: MarketOpportunity;
  competition: CompetitionInfo;
  team: TeamInfo;
  technology: TechnologyInfo;
  importantFacts: ImportantFact[];
  missingFields: string[]; // Schema categories/fields that were not found in the deck
  extractedAt: Date;
}

/**
 * State for profile extraction in UI
 */
export type ProfileExtractionStatus = 'idle' | 'extracting' | 'success' | 'error';

export interface StartupProfileState {
  status: ProfileExtractionStatus;
  profile: StartupProfile | null;
  errorMessage: string | null;
}

