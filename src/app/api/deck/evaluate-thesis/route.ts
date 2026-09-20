import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type, Schema } from '@google/genai';

/**
 * Strict JSON schema for Fundraising Thesis & Narrative Evaluation.
 */
const evaluationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    reconstructedThesis: {
      type: Type.ARRAY,
      description: 'The 11 core thesis pillars reconstructed from the deck.',
      items: {
        type: Type.OBJECT,
        properties: {
          pillar: {
            type: Type.STRING,
            enum: [
              'Problem',
              'Customer',
              'Solution',
              'Why Now',
              'Market',
              'Traction',
              'Business Model',
              'GTM',
              'Competitive Advantage',
              'Team',
              'Fundraising',
            ],
          },
          communicated: { type: Type.BOOLEAN },
          summary: { type: Type.STRING, description: 'What the deck communicates for this pillar, or why absent' },
          slideNumbers: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
        },
        required: ['pillar', 'communicated', 'summary', 'slideNumbers'],
      },
    },
    dimensions: {
      type: Type.ARRAY,
      description: 'Evaluation across the 14 fundraising dimensions.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          dimensionName: { type: Type.STRING },
          status: {
            type: Type.STRING,
            enum: ['STRONG', 'ADEQUATE', 'UNDERDEVELOPED', 'MISSING', 'CONTRADICTORY'],
          },
          finding: { type: Type.STRING, description: 'Short factual finding statement' },
          rationale: { type: Type.STRING, description: 'Why this status is assigned based on deck evidence' },
          slideReferences: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
          relatedClaimIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          evidenceSummary: { type: Type.STRING },
          unresolvedIssue: { type: Type.STRING },
          weaknessType: {
            type: Type.STRING,
            enum: ['COMMUNICATION_GAP', 'EVIDENCE_GAP', 'LOGIC_GAP'],
          },
        },
        required: ['id', 'dimensionName', 'status', 'finding', 'rationale', 'slideReferences'],
      },
    },
    narrativeChain: {
      type: Type.ARRAY,
      description: 'Assessment of transitions between narrative pillars.',
      items: {
        type: Type.OBJECT,
        properties: {
          fromPillar: { type: Type.STRING },
          toPillar: { type: Type.STRING },
          status: {
            type: Type.STRING,
            enum: ['clear', 'weak', 'missing', 'contradictory'],
          },
          assessment: { type: Type.STRING },
          slideNumbers: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
        },
        required: ['fromPillar', 'toPillar', 'status', 'assessment', 'slideNumbers'],
      },
    },
    investorObjections: {
      type: Type.ARRAY,
      description: 'Key investor objections or doubts triggered by gaps in this specific deck.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          objection: { type: Type.STRING },
          triggeringGap: { type: Type.STRING },
          relevantSlides: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
          importance: {
            type: Type.STRING,
            enum: ['critical', 'material', 'secondary'],
          },
        },
        required: ['id', 'objection', 'triggeringGap', 'relevantSlides', 'importance'],
      },
    },
    strongElements: {
      type: Type.ARRAY,
      description: 'Particularly clear or well-substantiated aspects of the fundraising case.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          pillarOrDimension: { type: Type.STRING },
          highlight: { type: Type.STRING },
          evidence: { type: Type.STRING },
          slideNumbers: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
        },
        required: ['id', 'pillarOrDimension', 'highlight', 'evidence', 'slideNumbers'],
      },
    },
    overallSynthesis: {
      type: Type.STRING,
      description: 'Concise executive synthesis of the fundraising case without generic praise or investment prediction.',
    },
  },
  required: [
    'reconstructedThesis',
    'dimensions',
    'narrativeChain',
    'investorObjections',
    'strongElements',
    'overallSynthesis',
  ],
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return NextResponse.json({
        status: 'skipped',
        message: 'GEMINI_API_KEY environment variable is not configured. Evaluation skipped.',
      });
    }

    const body = await req.json();
    const { profile, claims, diagnosticsSummary, slideEvidence } = body;

    const stage = profile?.fundraising?.currentStage?.rawValue || 'Unknown';
    const profileContext = profile
      ? `Startup Identity: ${profile.identity?.companyName?.rawValue || 'Unknown'}
Stage: ${stage}
Target Raise: ${profile.fundraising?.amountBeingRaised?.rawValue || 'Not stated'}
Use of Funds: ${profile.fundraising?.useOfFunds?.rawValue || 'Not stated'}
ARR/Revenue: ${profile.traction?.ARR?.rawValue || profile.traction?.MRR?.rawValue || 'Not stated'}
Customers: ${profile.traction?.customerCount?.rawValue || 'Not stated'}
Customer ICP: ${profile.customerICP?.customerType?.rawValue || 'Not stated'}
Business Model: ${profile.businessModel?.revenueModel?.rawValue || 'Not stated'}
Pricing: ${profile.businessModel?.pricingValues?.rawValue || 'Not stated'}
GTM Motion: ${profile.gtm?.salesMotion?.rawValue || 'Not stated'}
TAM: ${profile.market?.TAM?.rawValue || 'Not stated'}
Competitors: ${profile.competition?.namedCompetitors?.rawValue || 'Not stated'}
Missing Profile Fields: ${(profile.missingFields || []).join(', ') || 'None'}`
      : 'No profile available.';

    const claimsContext = Array.isArray(claims)
      ? claims
          .map(
            (c: { id: string; slideNumber: number; claimText: string; supportStatus: string; importance: string }) =>
              `[${c.id}] Slide ${c.slideNumber} (${c.importance}, ${c.supportStatus}): "${c.claimText}"`
          )
          .join('\n')
      : 'No claims available.';

    const diagContext = diagnosticsSummary
      ? `Diagnostics: Conflicts: ${diagnosticsSummary.contradictionCount || 0}, Evidence Gaps: ${diagnosticsSummary.evidenceGapCount || 0}, Missing Info: ${diagnosticsSummary.missingInfoCount || 0}, Ambiguities: ${diagnosticsSummary.ambiguityCount || 0}, Critical Issues: ${diagnosticsSummary.criticalCount || 0}`
      : 'No diagnostic summary.';

    const evidenceContext = Array.isArray(slideEvidence)
      ? slideEvidence.map((s: { pageNumber: number; text: string }) => `Slide ${s.pageNumber}: ${s.text}`).join('\n\n')
      : 'No slide evidence available.';

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are a rigorous, institutional Venture Capital partner assessing the FUNDRAISING CASE presented by a startup's pitch deck.

CORE PRINCIPLE:
Evaluate: "Based only on what this deck communicates and substantiates, how strong and coherent is the fundraising case being presented to an investor?"
Distinguish COMPANY QUALITY from DECK / FUNDRAISING CASE QUALITY. We only evaluate what the deck communicates.

STRICT INSTRUCTIONS:
1. DO NOT assign numerical scores (no 8/10, no 85/100, no letter grades).
2. DO NOT predict whether an investor will or will not invest.
3. DO NOT give founder advice or rewrite slides.
4. STAGE ADAPTATION: Adapt expectations to the startup stage (${stage}). Pre-seed companies are not expected to have mature Series A ARR metrics; seed/Series A companies making heavy traction claims require stronger substantiation.
5. EVALUATE THE 14 DIMENSIONS:
   - Problem Clarity
   - Solution Clarity
   - Customer / ICP Clarity
   - Problem-Solution Coherence
   - Traction Credibility
   - Business Model Clarity
   - Go-to-Market Credibility
   - Market Thesis
   - Competitive Positioning
   - Defensibility (only if claimed in deck)
   - Team / Founder-Market Fit Communication
   - Fundraising Ask
   - Evidence Quality
   - Narrative Coherence
6. STATUS CODES: 'STRONG' | 'ADEQUATE' | 'UNDERDEVELOPED' | 'MISSING' | 'CONTRADICTORY'.
7. WEAKNESS TAXONOMY:
   - 'COMMUNICATION_GAP': Information might exist in reality but is not communicated in the deck.
   - 'EVIDENCE_GAP': The deck makes a claim but fails to substantiate it.
   - 'LOGIC_GAP': Facts exist, but the relationship between them is inconsistent or mismatched (e.g. SMB ICP vs €100k ACV self-serve).
8. IDENTIFY INVESTOR OBJECTIONS: Surface only doubts triggered by actual gaps or inconsistencies in this deck.
9. IDENTIFY STRONG ELEMENTS: Cite specific deck evidence for well-substantiated areas.
10. OVERALL SYNTHESIS: Write a concise, objective summary of the fundraising case.`;

    const userPrompt = `Startup Profile & Stage Context:
${profileContext}

Diagnostic Signals:
${diagContext}

Extracted Material Claims:
${claimsContext}

Slide Evidence:
${evidenceContext}

Evaluate the fundraising thesis and narrative according to the JSON schema.`;

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
        responseSchema: evaluationSchema,
        temperature: 0.1,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Gemini API returned an empty response for thesis evaluation.');
    }

    const rawEvaluation = JSON.parse(responseText);

    return NextResponse.json({
      status: 'success',
      data: rawEvaluation,
    });
  } catch (err: unknown) {
    console.error('[evaluate-thesis API] Error during evaluation:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        status: 'error',
        message: `Evaluation failed: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

