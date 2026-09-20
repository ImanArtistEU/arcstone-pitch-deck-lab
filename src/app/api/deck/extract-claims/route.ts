import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type, Schema } from '@google/genai';

/**
 * Strict JSON schema for Claim & Evidence Map extraction.
 */
const claimMapSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    claims: {
      type: Type.ARRAY,
      description: 'List of material claims made in the deck with linked supporting evidence.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Unique claim identifier (e.g. claim-1)' },
          slideNumber: { type: Type.INTEGER, description: 'Primary 1-indexed slide where claim is made' },
          claimType: {
            type: Type.STRING,
            enum: [
              'problem',
              'solution',
              'product',
              'customer',
              'traction',
              'revenue',
              'growth',
              'unit_economics',
              'market',
              'competition',
              'differentiation',
              'technology',
              'team',
              'go_to_market',
              'partnership',
              'regulatory',
              'fundraising',
              'use_of_funds',
              'milestone',
              'other',
            ],
            description: 'Taxonomy type of the claim',
          },
          claimText: {
            type: Type.STRING,
            description: 'Verbatim raw wording of the claim as stated in the deck.',
          },
          normalizedClaim: {
            type: Type.STRING,
            description: 'Clear, normalized statement of the claim.',
          },
          quantitative: {
            type: Type.BOOLEAN,
            description: 'Whether the claim involves numeric metrics, currency, percentages, or scale.',
          },
          importance: {
            type: Type.STRING,
            enum: ['core', 'supporting', 'minor'],
            description: 'Importance to the fundraising narrative (core, supporting, minor)',
          },
          supportStatus: {
            type: Type.STRING,
            enum: ['supported', 'partially_supported', 'unsupported', 'conflicting'],
            description: 'Factual support status based solely on deck evidence.',
          },
          basis: {
            type: Type.STRING,
            enum: ['explicit', 'inferred'],
            description: 'Whether explicitly stated or inferred.',
          },
          confidence: {
            type: Type.STRING,
            enum: ['high', 'medium', 'low'],
          },
          evidence: {
            type: Type.ARRAY,
            description: 'Substantive supporting evidence items located in the deck.',
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                slideNumber: { type: Type.INTEGER },
                exactText: { type: Type.STRING },
                source: {
                  type: Type.STRING,
                  enum: ['native_pdf', 'visual_model', 'both'],
                },
                evidenceType: {
                  type: Type.STRING,
                  enum: [
                    'metric',
                    'customer',
                    'chart',
                    'table',
                    'citation',
                    'source_reference',
                    'testimonial',
                    'product_screenshot',
                    'contract_or_pipeline',
                    'team_background',
                    'market_data',
                    'descriptive_statement',
                    'other',
                  ],
                },
                relationship: {
                  type: Type.STRING,
                  description: 'Brief explanation of how this evidence substantiates or relates to the claim.',
                },
                confidence: {
                  type: Type.STRING,
                  enum: ['high', 'medium', 'low'],
                },
              },
              required: ['id', 'slideNumber', 'exactText', 'source', 'evidenceType', 'relationship'],
            },
          },
          conflict: {
            type: Type.OBJECT,
            description: 'Present only if supportStatus is conflicting.',
            properties: {
              description: { type: Type.STRING },
              competingValues: {
                type: Type.ARRAY,
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
          },
          notes: {
            type: Type.STRING,
            description: 'Objective analytical note regarding evidence linkage.',
          },
        },
        required: [
          'id',
          'slideNumber',
          'claimType',
          'claimText',
          'quantitative',
          'importance',
          'supportStatus',
          'basis',
          'confidence',
          'evidence',
        ],
      },
    },
  },
  required: ['claims'],
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return NextResponse.json({
        status: 'skipped',
        message: 'GEMINI_API_KEY environment variable is not configured. Claim and evidence analysis skipped.',
      });
    }

    const body = await req.json();
    const { slides, profile } = body;

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'Missing required slides array' },
        { status: 400 }
      );
    }

    // Prepare slide evidence stream
    const slideEvidenceStream = slides
      .map((slide) => {
        const pNum = slide.pageNumber;
        const nativeText = slide.nativeExtraction?.rawText || '';
        const visualSummary = slide.visualExtraction?.summary || '';
        const visualMetrics = slide.visualExtraction?.metrics || [];
        const visualCharts = slide.visualExtraction?.charts || [];
        const visualTables = slide.visualExtraction?.tables || [];
        const evidenceItems = slide.combinedEvidence?.evidenceItems || [];

        const metricsStr = visualMetrics.map((m: { label: string; value: string }) => `${m.label}: ${m.value}`).join('; ');
        const chartsStr = visualCharts.map((c: { chartType: string; title?: string; trend?: string }) => `Chart: ${c.title || c.chartType} (${c.trend || 'no trend'})`).join('; ');
        const evidenceStr = evidenceItems.map((e: { label: string; value: string; source: string }) => `[${e.source}] ${e.label}: ${e.value}`).join('\n  ');

        return `--- SLIDE ${pNum} ---
Native Text:
${nativeText || '(None)'}

Visual Summary: ${visualSummary || '(None)'}
Visual Metrics: ${metricsStr || '(None)'}
Visual Charts: ${chartsStr || '(None)'}

Combined Evidence Items:
  ${evidenceStr || '(None)'}`;
      })
      .join('\n\n');

    // Context from StartupProfile if available
    const profileSummary = profile
      ? `Identified Startup: ${profile.identity?.companyName?.rawValue || 'Unknown'}
Round: ${profile.fundraising?.roundBeingRaised?.rawValue || 'Unknown'} (${profile.fundraising?.amountBeingRaised?.rawValue || 'Unknown'})
ARR: ${profile.traction?.ARR?.rawValue || 'Unknown'}
Customers: ${profile.traction?.customerCount?.rawValue || 'Unknown'}`
      : 'No profile summary available.';

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are a forensic startup analyst creating a canonical Claim & Evidence Map from a pitch deck.

CRITICAL INSTRUCTIONS:
1. IDENTIFY MATERIAL CLAIMS: Extract substantive assertions made about problem, solution, product, traction, financial figures, growth, unit economics, market size, competition, team, technology, and fundraising. Ignore decorative labels, generic headers, repeated branding, and page numbers.
2. DISTINGUISH ASSERTION FROM EVIDENCE:
   - An assertion repeated across multiple slides is NOT supporting evidence.
   - Genuine evidence includes: customer numbers, ARR figures, MRR breakdowns, charts, tables, customer logos, cited market research (e.g. Gartner), screenshots, and founder backgrounds.
3. PRESERVE ORIGINAL WORDING VERBATIM: Do not alter raw claims (e.g. "Over €1M ARR", "18% MoM growth for the last 6 months").
4. ASSIGN SUPPORT STATUS OBJECTIVELY:
   - "supported": The deck contains direct, substantive evidence substantiating the claim.
   - "partially_supported": Some relevant evidence exists, but it does NOT fully prove the claim (e.g. claim: "127 paying customers", evidence: logo grid of 20 customer logos without contract counts).
   - "unsupported": The claim is made, but NO substantive supporting evidence exists inside the deck. (evidence array must be empty).
   - "conflicting": Two or more slides give contradictory numbers/facts (e.g. Slide 4 says 120 customers, Slide 9 says 147 customers). Populate the conflict object with both values.
5. ASSIGN IMPORTANCE:
   - "core": Fundamental to the fundraising thesis (problem, product value prop, ARR, traction, raise amount, market size, core differentiation).
   - "supporting": Subordinate points reinforcing a core claim.
   - "minor": Peripheral or secondary assertions.
6. DO NOT CRITIQUE OR SCORE: Do not advise the founder or recommend changes. Report only factual claim and evidence linkage.`;

    const userPrompt = `Startup Profile Context:
${profileSummary}

Complete Pitch Deck Evidence Stream:
${slideEvidenceStream}

Extract the material claims and map them to deck evidence following the required JSON schema.`;

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
        responseSchema: claimMapSchema,
        temperature: 0.1,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Gemini API returned an empty response for claim map extraction.');
    }

    const rawResult = JSON.parse(responseText);

    return NextResponse.json({
      status: 'success',
      data: rawResult,
    });
  } catch (err: unknown) {
    console.error('[extract-claims API] Error during claim extraction:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        status: 'error',
        message: `Claim map extraction failed: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

