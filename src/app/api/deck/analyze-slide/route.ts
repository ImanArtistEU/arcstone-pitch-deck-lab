import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { VisualExtraction } from '@/types/deck';

/**
 * Strict JSON schema for Gemini 2.5 Flash multimodal slide extraction.
 */
const visualExtractionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Main visible title of the slide. Omit if not clearly visible.',
    },
    subtitle: {
      type: Type.STRING,
      description: 'Visible subtitle or tagline. Omit if not present.',
    },
    summary: {
      type: Type.STRING,
      description: 'Objective 1-2 sentence factual summary of what is displayed on this slide.',
    },
    visibleText: {
      type: Type.STRING,
      description: 'Verbatim transcription of all readable text visible on the slide.',
    },
    metrics: {
      type: Type.ARRAY,
      description: 'List of discrete metrics, numbers, KPIs, financial values, or growth figures.',
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: 'Label or title of the metric (e.g. ARR, MoM Growth, Market Size)' },
          value: { type: Type.STRING, description: 'Verbatim value string (e.g. €1.2M, 18%, $3.5B)' },
          context: { type: Type.STRING, description: 'Qualifying context or timeframe (e.g. 2024, FY23, Series A)' },
          category: {
            type: Type.STRING,
            enum: ['financial', 'growth', 'market', 'users', 'fundraising', 'pricing', 'other'],
            description: 'Semantic metric category.',
          },
        },
        required: ['label', 'value'],
      },
    },
    tables: {
      type: Type.ARRAY,
      description: 'Structured data tables visible on the slide.',
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'Table title if visible' },
          headers: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Column header strings',
          },
          rows: {
            type: Type.ARRAY,
            items: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            description: 'Row cell values',
          },
        },
        required: ['headers', 'rows'],
      },
    },
    charts: {
      type: Type.ARRAY,
      description: 'Charts or graphs visible on the slide.',
      items: {
        type: Type.OBJECT,
        properties: {
          chartType: {
            type: Type.STRING,
            enum: ['bar', 'line', 'pie', 'donut', 'area', 'other'],
            description: 'Visual chart type',
          },
          title: { type: Type.STRING, description: 'Chart title or metric displayed' },
          axes: { type: Type.STRING, description: 'Axis labels or scales (e.g. X: Years, Y: Revenue in $M)' },
          series: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Data series or legend items',
          },
          displayedValues: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Explicit data numbers or percentages printed on data points',
          },
          trend: { type: Type.STRING, description: 'Clear visual direction (e.g. Upward trend from 2021 to 2024)' },
        },
        required: ['chartType'],
      },
    },
    diagrams: {
      type: Type.ARRAY,
      description: 'Flowcharts, architecture diagrams, or process maps visible on the slide.',
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'Diagram title or process name' },
          nodes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Individual box/circle/step labels',
          },
          relationships: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Directional relationships or connections (e.g. Step A -> Step B)',
          },
          labels: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Annotated labels or descriptions',
          },
        },
        required: ['nodes', 'relationships'],
      },
    },
    productScreenshots: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Factual descriptions of software UI, app screens, or product mockups visible.',
    },
    logos: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Identifiable customer, partner, or investor logo names clearly visible.',
    },
    importantVisualElements: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Key visual hierarchy elements, callout boxes, or highlights not captured elsewhere.',
    },
  },
  required: ['summary', 'visibleText', 'metrics', 'tables', 'charts', 'diagrams'],
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    // Graceful fallback if Gemini API key is not configured in environment
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return NextResponse.json({
        status: 'skipped',
        message: 'GEMINI_API_KEY environment variable is not configured. Visual multimodal analysis skipped.',
      });
    }

    const body = await req.json();
    const { imageBase64, pageNumber, nativeText } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json(
        { status: 'error', message: 'Missing required imageBase64 field' },
        { status: 400 }
      );
    }

    // Clean base64 header if present (e.g. "data:image/jpeg;base64,...")
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are a forensic document parser analyzing a pitch deck slide image for a startup fundraising platform.
Your objective is to extract EVERY piece of visible text, metric, number, table, chart, diagram, screenshot, and logo visible on this slide.
Do NOT critique, score, rate, or advise the startup. Be strictly factual and objective.
Extract exact numbers, currencies, percentages, and financial metrics verbatim.
If something is unclear or not present, omit or report as empty rather than guessing.`;

    const userPrompt = `Analyze this pitch deck slide (Slide ${pageNumber || 1}).
${nativeText ? `Supporting deterministic native PDF text stream:\n"""\n${nativeText}\n"""\n` : ''}
Extract all visible titles, metrics, tables, charts, diagrams, screenshots, and logos into the required JSON schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt + '\n\n' + userPrompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanBase64,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: visualExtractionSchema,
        temperature: 0.1, // Low temperature for deterministic extraction
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Gemini API returned an empty response.');
    }

    const visualData: VisualExtraction = JSON.parse(responseText);

    return NextResponse.json({
      status: 'success',
      data: visualData,
    });
  } catch (err: unknown) {
    console.error('[analyze-slide API] Error during Gemini analysis:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        status: 'error',
        message: `Multimodal analysis failed: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

