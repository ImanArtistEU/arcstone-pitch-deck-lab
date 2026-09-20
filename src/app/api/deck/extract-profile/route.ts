import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type, Schema } from '@google/genai';

/**
 * Reusable schema for individual profile fields.
 */
const profileFieldSchema = (description: string): Schema => ({
  type: Type.OBJECT,
  description,
  properties: {
    status: {
      type: Type.STRING,
      enum: ['extracted', 'conflicting', 'not_found'],
      description: 'Field status. Use not_found if information is completely absent from deck.',
    },
    rawValue: {
      type: Type.STRING,
      description: 'Verbatim raw text value from deck (e.g. "Over €1M ARR", "Seed", "€3.5M").',
    },
    basis: {
      type: Type.STRING,
      enum: ['explicit', 'inferred'],
      description: 'Whether the field value was explicitly stated or reasonably inferred.',
    },
    evidence: {
      type: Type.ARRAY,
      description: 'Supporting slide evidence items.',
      items: {
        type: Type.OBJECT,
        properties: {
          slideNumber: { type: Type.INTEGER, description: '1-indexed slide number' },
          exactText: { type: Type.STRING, description: 'Verbatim quote from slide' },
          source: {
            type: Type.STRING,
            enum: ['native_pdf', 'visual_model', 'both'],
            description: 'Provenance source of evidence',
          },
        },
        required: ['slideNumber', 'exactText', 'source'],
      },
    },
    conflictingValues: {
      type: Type.ARRAY,
      description: 'If two or more slides contradict, list all conflicting values.',
      items: {
        type: Type.OBJECT,
        properties: {
          value: { type: Type.STRING },
          slideNumber: { type: Type.INTEGER },
          source: { type: Type.STRING, enum: ['native_pdf', 'visual_model', 'both'] },
        },
        required: ['value', 'slideNumber', 'source'],
      },
    },
  },
  required: ['status', 'evidence'],
});

/**
 * Reusable schema for list fields (e.g. keyFeatures, targetSegments).
 */
const profileListFieldSchema = (description: string): Schema => ({
  type: Type.OBJECT,
  description,
  properties: {
    status: {
      type: Type.STRING,
      enum: ['extracted', 'conflicting', 'not_found'],
    },
    rawValue: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Array of verbatim strings or items extracted.',
    },
    basis: {
      type: Type.STRING,
      enum: ['explicit', 'inferred'],
    },
    evidence: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          slideNumber: { type: Type.INTEGER },
          exactText: { type: Type.STRING },
          source: { type: Type.STRING, enum: ['native_pdf', 'visual_model', 'both'] },
        },
        required: ['slideNumber', 'exactText', 'source'],
      },
    },
  },
  required: ['status', 'evidence'],
});

/**
 * Complete JSON schema for structured startup profile extraction.
 */
const startupProfileSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    identity: {
      type: Type.OBJECT,
      properties: {
        companyName: profileFieldSchema('Company or startup name'),
        tagline: profileFieldSchema('One-line tagline or headline'),
        website: profileFieldSchema('Website URL or domain'),
        headquarters: profileFieldSchema('Headquarters location or geography'),
        foundingYear: profileFieldSchema('Year founded'),
      },
      required: ['companyName', 'tagline', 'website', 'headquarters', 'foundingYear'],
    },
    fundraising: {
      type: Type.OBJECT,
      properties: {
        currentStage: profileFieldSchema('Current funding stage (e.g. Pre-Seed, Seed, Series A)'),
        roundBeingRaised: profileFieldSchema('Target round name being raised'),
        amountBeingRaised: profileFieldSchema('Amount being raised (e.g. €3.5M, $2,000,000)'),
        currency: profileFieldSchema('Currency symbol or code (EUR, USD, GBP, etc.)'),
        previousFunding: profileFieldSchema('Previous capital raised if explicitly stated'),
        useOfFunds: profileListFieldSchema('Planned allocation or use of funds'),
        runway: profileFieldSchema('Expected runway or extension in months'),
      },
      required: ['currentStage', 'roundBeingRaised', 'amountBeingRaised', 'currency', 'previousFunding', 'useOfFunds', 'runway'],
    },
    problemSolution: {
      type: Type.OBJECT,
      properties: {
        problemStatement: profileFieldSchema('Core problem statement'),
        targetUserPain: profileFieldSchema('Specific customer or user pain point'),
        currentAlternatives: profileFieldSchema('Current status quo / manual workaround / legacy alternatives'),
        productDescription: profileFieldSchema('Core product or solution description'),
        valueProposition: profileFieldSchema('Primary value proposition'),
        keyFeatures: profileListFieldSchema('Key product features or capabilities listed'),
        productCategory: profileFieldSchema('Product category (e.g. B2B SaaS, Marketplace, Fintech)'),
      },
      required: ['problemStatement', 'targetUserPain', 'currentAlternatives', 'productDescription', 'valueProposition', 'keyFeatures', 'productCategory'],
    },
    customerICP: {
      type: Type.OBJECT,
      properties: {
        customerType: profileFieldSchema('B2B, B2C, B2B2C, Marketplace, etc.'),
        targetSegments: profileListFieldSchema('Target customer segments'),
        industries: profileListFieldSchema('Target verticals or industries'),
        geography: profileListFieldSchema('Target geographic markets'),
        buyerPersona: profileFieldSchema('Buyer / decision maker role if stated'),
        endUser: profileFieldSchema('End user role if different from buyer'),
      },
      required: ['customerType', 'targetSegments', 'industries', 'geography', 'buyerPersona', 'endUser'],
    },
    businessModel: {
      type: Type.OBJECT,
      properties: {
        revenueModel: profileFieldSchema('Subscription, Transactional, Usage-based, Marketplace fee, etc.'),
        pricingModel: profileFieldSchema('Pricing model description'),
        pricingValues: profileFieldSchema('Verbatim pricing numbers or tiers if stated'),
        unitEconomics: profileFieldSchema('ACV, ARPU, LTV, CAC, Margin economics if stated'),
      },
      required: ['revenueModel', 'pricingModel', 'pricingValues', 'unitEconomics'],
    },
    traction: {
      type: Type.OBJECT,
      properties: {
        revenue: profileFieldSchema('Current or historical revenue'),
        ARR: profileFieldSchema('Annual Run Rate / Annual Recurring Revenue'),
        MRR: profileFieldSchema('Monthly Recurring Revenue'),
        customerCount: profileFieldSchema('Total customer count'),
        paidCustomerCount: profileFieldSchema('Paid customer count'),
        userCount: profileFieldSchema('Active user / account count'),
        growthRates: profileFieldSchema('MoM or YoY growth rates'),
        retentionMetrics: profileFieldSchema('Net Revenue Retention / Logo Retention / NRR'),
        churn: profileFieldSchema('Churn rate'),
        pipeline: profileFieldSchema('Sales pipeline or waitlist numbers'),
        notableCustomers: profileListFieldSchema('Notable customer names, logos, or partners shown'),
      },
      required: ['revenue', 'ARR', 'MRR', 'customerCount', 'paidCustomerCount', 'userCount', 'growthRates', 'retentionMetrics', 'churn', 'pipeline', 'notableCustomers'],
    },
    goToMarket: {
      type: Type.OBJECT,
      properties: {
        acquisitionChannels: profileListFieldSchema('Customer acquisition channels'),
        salesMotion: profileFieldSchema('PLG, Inside Sales, Enterprise Field Sales, Outbound, etc.'),
        distributionStrategy: profileFieldSchema('Distribution or channel strategy'),
        partnerships: profileListFieldSchema('Strategic partnerships listed'),
        expansionStrategy: profileFieldSchema('Account or geographic expansion strategy'),
      },
      required: ['acquisitionChannels', 'salesMotion', 'distributionStrategy', 'partnerships', 'expansionStrategy'],
    },
    market: {
      type: Type.OBJECT,
      properties: {
        TAM: profileFieldSchema('Total Addressable Market size'),
        SAM: profileFieldSchema('Serviceable Addressable Market size'),
        SOM: profileFieldSchema('Serviceable Obtainable Market / Target market size'),
        marketGrowth: profileFieldSchema('Market CAGR or growth rate'),
        marketDefinition: profileFieldSchema('Scope or definition of market'),
        marketSource: profileFieldSchema('Source citation for market size (e.g. Gartner, IDC)'),
      },
      required: ['TAM', 'SAM', 'SOM', 'marketGrowth', 'marketDefinition', 'marketSource'],
    },
    competition: {
      type: Type.OBJECT,
      properties: {
        namedCompetitors: profileListFieldSchema('Explicitly named competitor companies'),
        alternatives: profileListFieldSchema('Alternative solutions or status quo'),
        differentiationClaims: profileListFieldSchema('Stated key differentiators'),
        positioningClaims: profileListFieldSchema('Competitive positioning claims'),
      },
      required: ['namedCompetitors', 'alternatives', 'differentiationClaims', 'positioningClaims'],
    },
    team: {
      type: Type.OBJECT,
      properties: {
        founders: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              role: { type: Type.STRING },
              background: { type: Type.STRING },
              slideNumber: { type: Type.INTEGER },
            },
            required: ['name', 'role', 'slideNumber'],
          },
        },
        teamSize: profileFieldSchema('Total team size / FTEs'),
        advisors: profileListFieldSchema('Advisors or board members listed'),
      },
      required: ['founders', 'teamSize', 'advisors'],
    },
    technology: {
      type: Type.OBJECT,
      properties: {
        coreTechnology: profileFieldSchema('Core tech stack or architecture'),
        integrations: profileListFieldSchema('Supported software integrations'),
        proprietaryClaims: profileListFieldSchema('Proprietary IP or patent claims'),
        aiMlClaims: profileListFieldSchema('AI / ML claims or model descriptions'),
      },
      required: ['coreTechnology', 'integrations', 'proprietaryClaims', 'aiMlClaims'],
    },
    importantFacts: {
      type: Type.ARRAY,
      description: 'Other material factual information visible in the deck (milestones, regulatory, patents, etc.)',
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          fact: { type: Type.STRING },
          slideNumber: { type: Type.INTEGER },
          source: { type: Type.STRING, enum: ['native_pdf', 'visual_model', 'both'] },
        },
        required: ['category', 'fact', 'slideNumber', 'source'],
      },
    },
  },
  required: [
    'identity',
    'fundraising',
    'problemSolution',
    'customerICP',
    'businessModel',
    'traction',
    'goToMarket',
    'market',
    'competition',
    'team',
    'technology',
    'importantFacts',
  ],
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return NextResponse.json({
        status: 'skipped',
        message: 'GEMINI_API_KEY environment variable is not configured. Structured startup profile extraction skipped.',
      });
    }

    const body = await req.json();
    const { slides } = body;

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'Missing required slides array' },
        { status: 400 }
      );
    }

    // Format deck evidence into a slide-by-slide textual representation
    const slideEvidenceStream = slides
      .map((slide) => {
        const pNum = slide.pageNumber;
        const nativeText = slide.nativeExtraction?.rawText || '';
        const visualSummary = slide.visualExtraction?.summary || '';
        const visualMetrics = slide.visualExtraction?.metrics || [];
        const visualTables = slide.visualExtraction?.tables || [];
        const visualCharts = slide.visualExtraction?.charts || [];
        const evidenceItems = slide.combinedEvidence?.evidenceItems || [];

        const metricsStr = visualMetrics.map((m: { label: string; value: string }) => `${m.label}: ${m.value}`).join('; ');
        const evidenceStr = evidenceItems.map((e: { label: string; value: string; source: string }) => `[${e.source}] ${e.label}: ${e.value}`).join('\n  ');

        return `--- SLIDE ${pNum} ---
Native Text:
${nativeText || '(None)'}

Visual Summary: ${visualSummary || '(None)'}
Visual Metrics: ${metricsStr || '(None)'}

Key Evidence Items:
  ${evidenceStr || '(None)'}`;
      })
      .join('\n\n');

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are a strict, objective startup analyst creating a canonical structured startup profile from pitch deck evidence.

CRITICAL RULES:
1. DO NOT SCORE, GRADE, OR CRITIQUE THE STARTUP.
2. DO NOT GIVE RECOMMENDATIONS OR BENCHMARK AGAINST OTHER COMPANIES.
3. DO NOT HALLUCINATE OR ASSUME UNSTATED INFORMATION. If a field (e.g. ARR, runway, pricing, use of funds) is not explicitly present or directly inferred from the deck evidence, set status to "not_found".
4. PRESERVE RAW VALUES VERBATIM. Do not change "Over €1M ARR" into "€1,000,000".
5. LINK EVERY EXTRACTED FIELD TO SUPPORTING SLIDE EVIDENCE (slideNumber, exactText, source).
6. IF TWO SLIDES CONTRADICT (e.g. Slide 4 says 120 customers, Slide 9 says 147 customers), set status to "conflicting" and populate conflictingValues array with all instances.
7. DISTINGUISH EXPLICIT STATEMENTS vs REASONABLE INFERENCES using the basis field ("explicit" vs "inferred").`;

    const userPrompt = `Extract the structured startup profile from the following complete pitch deck evidence stream:\n\n${slideEvidenceStream}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: systemPrompt + '\n\n' + userPrompt }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: startupProfileSchema,
        temperature: 0.1,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Gemini API returned an empty response for startup profile extraction.');
    }

    const rawProfile = JSON.parse(responseText);

    return NextResponse.json({
      status: 'success',
      data: rawProfile,
    });
  } catch (err: unknown) {
    console.error('[extract-profile API] Error during startup profile extraction:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        status: 'error',
        message: `Profile extraction failed: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

