import { CompanyEvaluationContext } from '@/types/evaluation-context';

export type ExpectationStatus =
  | 'EXPECTED'
  | 'RELEVANT'
  | 'OPTIONAL'
  | 'NOT_YET_EXPECTED'
  | 'NOT_APPLICABLE'
  | 'UNKNOWN';

export interface DimensionExpectation {
  dimension: string;
  status: ExpectationStatus;
  rationale: string;
}

export interface EvaluationExpectations {
  expectations: Record<string, DimensionExpectation>;
  summary: {
    expectedCount: number;
    relevantCount: number;
    notYetExpectedCount: number;
    notApplicableCount: number;
    unknownCount: number;
  };
}

/**
 * Builds context-sensitive EvaluationExpectations policy based on CompanyEvaluationContext.
 * 
 * PURE DETERMINISTIC FUNCTION:
 * - No Gemini calls
 * - No system clock / Date.now()
 * - No randomness
 * 
 * @param context Canonical CompanyEvaluationContext
 * @returns EvaluationExpectations
 */
export function buildEvaluationExpectations(context: CompanyEvaluationContext): EvaluationExpectations {
  const expectations: Record<string, DimensionExpectation> = {};
  const stage = context.declaredStage.normalizedStage;
  const maturity = context.observedMaturity.value;
  const archetype = context.businessModel.primaryArchetype;

  const isUnknownMaturity = maturity === 'unknown';
  const isUnknownArchetype = archetype === 'unknown';

  // 1. Problem Evidence
  expectations['problemEvidence'] = {
    dimension: 'Problem Evidence',
    status: 'EXPECTED',
    rationale: 'Every pitch deck across all stages and archetypes is expected to articulate clear user/customer pain.',
  };

  // 2. Customer Evidence
  expectations['customerEvidence'] = {
    dimension: 'Customer Evidence',
    status: 'EXPECTED',
    rationale: 'Clear definition of target customer ICP is expected at all maturity levels.',
  };

  // 3. Product Evidence
  expectations['productEvidence'] = {
    dimension: 'Product Evidence',
    status: 'EXPECTED',
    rationale: 'Description of the solution capabilities and value proposition is expected.',
  };

  // 4. Traction
  if (isUnknownMaturity) {
    expectations['traction'] = {
      dimension: 'Traction',
      status: 'UNKNOWN',
      rationale: 'Insufficient deck evidence to assign operating maturity, so quantitative traction requirement is undetermined.',
    };
  } else if (maturity === 'concept_validation') {
    expectations['traction'] = {
      dimension: 'Traction',
      status: 'OPTIONAL',
      rationale: 'Early concept validation stage relies on qualitative discovery rather than mature quantitative revenue.',
    };
  } else if (maturity === 'product_building') {
    expectations['traction'] = {
      dimension: 'Traction',
      status: 'RELEVANT',
      rationale: 'Product building stage benefits from pilot commitments, LOIs, or initial user engagement signals.',
    };
  } else {
    expectations['traction'] = {
      dimension: 'Traction',
      status: 'EXPECTED',
      rationale: 'Startups with early market evidence or operating traction are expected to substantiate customer adoption.',
    };
  }

  // 5. Retention (Net Revenue Retention / Cohorts)
  if (isUnknownMaturity) {
    expectations['retention'] = {
      dimension: 'Retention & Cohorts',
      status: 'UNKNOWN',
      rationale: 'Operating maturity is unknown, so retention expectations cannot be determined.',
    };
  } else if (maturity === 'concept_validation' || maturity === 'product_building') {
    expectations['retention'] = {
      dimension: 'Retention & Cohorts',
      status: 'NOT_YET_EXPECTED',
      rationale: 'Cohort retention and NRR are not yet expected for pre-revenue or concept stage companies.',
    };
  } else if (maturity === 'early_market_evidence') {
    expectations['retention'] = {
      dimension: 'Retention & Cohorts',
      status: 'RELEVANT',
      rationale: 'Early customer feedback and repeat usage signals become relevant as revenue emerges.',
    };
  } else {
    expectations['retention'] = {
      dimension: 'Retention & Cohorts',
      status: 'EXPECTED',
      rationale: 'Repeatable growth and scaling stages require explicit retention cohort data and net expansion proof.',
    };
  }

  // 6. Growth & Velocity
  if (isUnknownMaturity) {
    expectations['growth'] = {
      dimension: 'Growth Rate',
      status: 'UNKNOWN',
      rationale: 'Operating maturity is unknown, so growth velocity expectations cannot be determined.',
    };
  } else if (maturity === 'concept_validation' || maturity === 'product_building') {
    expectations['growth'] = {
      dimension: 'Growth Rate',
      status: 'NOT_YET_EXPECTED',
      rationale: 'Growth rate metrics are not yet expected prior to commercial market launch.',
    };
  } else {
    expectations['growth'] = {
      dimension: 'Growth Rate',
      status: 'EXPECTED',
      rationale: 'Commercial stage companies are expected to communicate growth trajectory and sales velocity.',
    };
  }

  // 7. Distribution & GTM Motion
  if (isUnknownMaturity) {
    expectations['distribution'] = {
      dimension: 'Distribution Strategy',
      status: 'UNKNOWN',
      rationale: 'Distribution requirements depend on verified operating maturity.',
    };
  } else if (maturity === 'concept_validation') {
    expectations['distribution'] = {
      dimension: 'Distribution Strategy',
      status: 'RELEVANT',
      rationale: 'Pre-launch decks are expected to articulate a proposed customer acquisition strategy or wedge.',
    };
  } else {
    expectations['distribution'] = {
      dimension: 'Distribution Strategy',
      status: 'EXPECTED',
      rationale: 'Startups with commercial products are expected to outline scalable distribution channels.',
    };
  }

  // 8. Sales Repeatability
  if (isUnknownMaturity) {
    expectations['salesRepeatability'] = {
      dimension: 'Sales Repeatability',
      status: 'UNKNOWN',
      rationale: 'Sales repeatability expectations require established operating maturity.',
    };
  } else if (maturity === 'concept_validation' || maturity === 'product_building' || maturity === 'early_market_evidence') {
    expectations['salesRepeatability'] = {
      dimension: 'Sales Repeatability',
      status: 'NOT_YET_EXPECTED',
      rationale: 'Formal channel repeatability is not yet expected before establishing consistent customer cohorts.',
    };
  } else {
    expectations['salesRepeatability'] = {
      dimension: 'Sales Repeatability',
      status: 'EXPECTED',
      rationale: 'Emerging repeatability and scaling stages require proof that sales do not rely solely on founder relationships.',
    };
  }

  // 9. Pricing
  if (isUnknownArchetype) {
    expectations['pricing'] = {
      dimension: 'Pricing Tiers & ACV',
      status: 'RELEVANT',
      rationale: 'Monetization structure is relevant once business model archetype is clarified.',
    };
  } else if (archetype === 'b2b_saas' || archetype === 'enterprise_software' || archetype === 'smb_software' || archetype === 'transactional') {
    expectations['pricing'] = {
      dimension: 'Pricing Tiers & ACV',
      status: 'EXPECTED',
      rationale: 'Commercial software business models are expected to state pricing tiers or average contract values.',
    };
  } else {
    expectations['pricing'] = {
      dimension: 'Pricing Tiers & ACV',
      status: 'RELEVANT',
      rationale: 'Monetization structure is relevant to evaluate commercial viability.',
    };
  }

  // 10. Unit Economics (CAC, Payback)
  if (isUnknownMaturity) {
    expectations['unitEconomics'] = {
      dimension: 'Unit Economics',
      status: 'UNKNOWN',
      rationale: 'Unit-level economics requirements depend on verified operating maturity.',
    };
  } else if (maturity === 'concept_validation' || maturity === 'product_building') {
    expectations['unitEconomics'] = {
      dimension: 'Unit Economics',
      status: 'NOT_YET_EXPECTED',
      rationale: 'Unit-level economics (CAC payback) are not yet expected prior to active marketing spend.',
    };
  } else {
    expectations['unitEconomics'] = {
      dimension: 'Unit Economics',
      status: 'RELEVANT',
      rationale: 'Unit-level economics demonstrate long-term capital efficiency.',
    };
  }

  // 11. Gross Margin
  if (archetype === 'hardware' || archetype === 'deeptech' || context.capitalRegulatory.capitalIntensity === 'high') {
    if (maturity === 'concept_validation' || maturity === 'product_building') {
      expectations['grossMargin'] = {
        dimension: 'Gross Margin',
        status: 'NOT_YET_EXPECTED',
        rationale: 'For precommercial deeptech and hardware, technical validation and manufacturing feasibility take precedence over current gross margin.',
      };
    } else if (maturity === 'early_market_evidence') {
      expectations['grossMargin'] = {
        dimension: 'Gross Margin',
        status: 'RELEVANT',
        rationale: 'Early commercial deeptech/hardware demonstrates unit cost structure directionally as manufacturing ramps.',
      };
    } else {
      expectations['grossMargin'] = {
        dimension: 'Gross Margin',
        status: 'EXPECTED',
        rationale: 'Commercial hardware and deeptech models require explicit gross margin and unit cost breakdowns.',
      };
    }
  } else {
    expectations['grossMargin'] = {
      dimension: 'Gross Margin',
      status: 'RELEVANT',
      rationale: 'Gross margin expectations depend on hosting, API, or support overhead.',
    };
  }

  // 12. Market Sizing
  expectations['market'] = {
    dimension: 'Market Opportunity',
    status: 'EXPECTED',
    rationale: `Market opportunity definition and TAM derivation are expected across all fundraising decks (${stage !== 'unknown' ? stage : 'all'} stage).`,
  };

  // 13. Competition & Differentiation
  expectations['competition'] = {
    dimension: 'Competitive Positioning',
    status: 'EXPECTED',
    rationale: 'Mapping existing alternatives and primary points of difference is expected.',
  };

  // 14. Defensibility & Moat
  if (archetype === 'deeptech' || archetype === 'ai_infrastructure' || archetype === 'biotech_healthtech' || archetype === 'hardware') {
    expectations['defensibility'] = {
      dimension: 'Defensibility & IP',
      status: 'EXPECTED',
      rationale: 'Deeptech, hardware, and science startups must demonstrate proprietary technological barriers or patent filings.',
    };
  } else {
    expectations['defensibility'] = {
      dimension: 'Defensibility & Moat',
      status: 'RELEVANT',
      rationale: 'Long-term defensibility depends on network density, switching costs, or workflow lock-in.',
    };
  }

  // 15. Team
  expectations['team'] = {
    dimension: 'Team & Founders',
    status: 'EXPECTED',
    rationale: 'Founder background and execution capacity are expected across all stages.',
  };

  // 16. Capital Plan & Ask
  expectations['capitalPlan'] = {
    dimension: 'Fundraising Ask & Milestone Plan',
    status: 'EXPECTED',
    rationale: `Stating the capital requested and milestone allocation is expected in fundraising decks (${stage !== 'unknown' ? stage : 'all'} stage).`,
  };

  // 17. Archetype-Specific Expectations: Marketplace Liquidity
  if (isUnknownArchetype) {
    expectations['marketplaceLiquidity'] = {
      dimension: 'Marketplace Liquidity & Take Rate',
      status: 'UNKNOWN',
      rationale: 'Business model archetype is unknown, so marketplace liquidity relevance cannot be determined.',
    };
  } else if (archetype === 'marketplace') {
    expectations['marketplaceLiquidity'] = {
      dimension: 'Marketplace Liquidity & Take Rate',
      status: maturity === 'concept_validation' ? 'RELEVANT' : 'EXPECTED',
      rationale: 'Marketplaces are evaluated on supply/demand balance, liquidity, repeat transactions, and take rate.',
    };
  } else {
    expectations['marketplaceLiquidity'] = {
      dimension: 'Marketplace Liquidity & Take Rate',
      status: 'NOT_APPLICABLE',
      rationale: 'Marketplace liquidity metrics do not apply to non-marketplace business models.',
    };
  }

  // 18. Archetype-Specific Expectations: Clinical Validation
  if (isUnknownArchetype) {
    expectations['clinicalValidation'] = {
      dimension: 'Clinical & Regulatory Validation',
      status: 'UNKNOWN',
      rationale: 'Business model archetype is unknown, so clinical validation relevance cannot be determined.',
    };
  } else if (archetype === 'biotech_healthtech' || context.capitalRegulatory.regulatoryIntensity === 'high') {
    expectations['clinicalValidation'] = {
      dimension: 'Clinical & Regulatory Validation',
      status: 'EXPECTED',
      rationale: 'Biotech and regulated healthtech require regulatory clearance roadmaps or clinical trial data.',
    };
  } else {
    expectations['clinicalValidation'] = {
      dimension: 'Clinical & Regulatory Validation',
      status: 'NOT_APPLICABLE',
      rationale: 'Clinical validation metrics do not apply to software or non-healthtech business models.',
    };
  }

  // 19. Archetype-Specific Expectations: Developer Adoption
  if (isUnknownArchetype) {
    expectations['developerAdoption'] = {
      dimension: 'Developer Community & API Usage',
      status: 'UNKNOWN',
      rationale: 'Business model archetype is unknown, so developer adoption relevance cannot be determined.',
    };
  } else if (archetype === 'developer_tools') {
    expectations['developerAdoption'] = {
      dimension: 'Developer Community & API Usage',
      status: 'EXPECTED',
      rationale: 'Developer tools are evaluated on SDK downloads, API call growth, open-source stars, or community traction.',
    };
  } else {
    expectations['developerAdoption'] = {
      dimension: 'Developer Community & API Usage',
      status: 'NOT_APPLICABLE',
      rationale: 'Developer adoption metrics do not apply to general business software.',
    };
  }

  const values = Object.values(expectations);
  const summary = {
    expectedCount: values.filter((e) => e.status === 'EXPECTED').length,
    relevantCount: values.filter((e) => e.status === 'RELEVANT').length,
    notYetExpectedCount: values.filter((e) => e.status === 'NOT_YET_EXPECTED').length,
    notApplicableCount: values.filter((e) => e.status === 'NOT_APPLICABLE').length,
    unknownCount: values.filter((e) => e.status === 'UNKNOWN').length,
  };

  return { expectations, summary };
}
