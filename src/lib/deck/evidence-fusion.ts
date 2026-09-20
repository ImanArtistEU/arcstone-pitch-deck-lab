import {
  EvidenceItem,
  CombinedEvidence,
  VisualExtraction,
  ProvenanceSource,
} from '@/types/deck';

/**
 * Fuse native PDF text extraction with Gemini multimodal visual extraction.
 * Assigns explicit provenance (`native_pdf`, `visual_model`, `both`) to every evidence item.
 * 
 * @param pageNumber Page/Slide number (1-indexed)
 * @param nativeText Verbatim native PDF text stream
 * @param visualExtraction Structured visual analysis from Gemini (if available)
 * @returns CombinedEvidence
 */
export function fuseSlideEvidence(
  pageNumber: number,
  nativeText: string,
  visualExtraction?: VisualExtraction | null
): CombinedEvidence {
  const evidenceItems: EvidenceItem[] = [];
  const keyFacts: string[] = [];

  const lowerNative = nativeText.toLowerCase().trim();

  // Helper to normalize strings for comparison
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Process Visual Metrics from Gemini
  if (visualExtraction?.metrics && Array.isArray(visualExtraction.metrics)) {
    visualExtraction.metrics.forEach((m, idx) => {
      if (!m.label && !m.value) return;

      const normValue = normalize(m.value);
      const isInNative = normValue.length > 0 && lowerNative.includes(m.value.toLowerCase().trim());

      const source: ProvenanceSource = isInNative ? 'both' : 'visual_model';

      evidenceItems.push({
        id: `slide-${pageNumber}-metric-${idx + 1}`,
        pageNumber,
        source,
        category: 'metric',
        label: m.label || 'Metric',
        value: m.value,
        confidence: 'high',
      });

      const contextStr = m.context ? ` (${m.context})` : '';
      keyFacts.push(`${m.label}: ${m.value}${contextStr}`);
    });
  }

  // 2. Process Tables from Gemini
  if (visualExtraction?.tables && Array.isArray(visualExtraction.tables)) {
    visualExtraction.tables.forEach((tbl, tIdx) => {
      const title = tbl.title || `Table ${tIdx + 1}`;
      const headerStr = tbl.headers.join(' | ');
      const rowsStr = tbl.rows.map((r) => r.join(' | ')).join(' \n ');
      const fullTblStr = `[${title}]\nHeaders: ${headerStr}\nRows:\n${rowsStr}`;

      const isHeaderInNative = tbl.headers.some(
        (h) => h.length > 0 && lowerNative.includes(h.toLowerCase().trim())
      );
      const source: ProvenanceSource = isHeaderInNative ? 'both' : 'visual_model';

      evidenceItems.push({
        id: `slide-${pageNumber}-table-${tIdx + 1}`,
        pageNumber,
        source,
        category: 'table',
        label: title,
        value: fullTblStr,
        confidence: 'high',
      });

      keyFacts.push(`Table [${title}]: ${tbl.rows.length} rows, columns (${headerStr})`);
    });
  }

  // 3. Process Charts from Gemini
  if (visualExtraction?.charts && Array.isArray(visualExtraction.charts)) {
    visualExtraction.charts.forEach((ch, cIdx) => {
      const title = ch.title || `${ch.chartType.toUpperCase()} Chart`;
      const seriesStr = ch.series && ch.series.length > 0 ? ` Series: ${ch.series.join(', ')}.` : '';
      const valsStr =
        ch.displayedValues && ch.displayedValues.length > 0
          ? ` Values: ${ch.displayedValues.join(', ')}.`
          : '';
      const trendStr = ch.trend ? ` Trend: ${ch.trend}.` : '';

      const chartSummary = `${title} (${ch.chartType}).${seriesStr}${valsStr}${trendStr}`;

      evidenceItems.push({
        id: `slide-${pageNumber}-chart-${cIdx + 1}`,
        pageNumber,
        source: 'visual_model',
        category: 'chart',
        label: title,
        value: chartSummary,
        confidence: 'high',
      });

      keyFacts.push(`Chart [${title}]: ${ch.chartType} chart.${trendStr}`);
    });
  }

  // 4. Process Native PDF Text if no visual metrics matched
  if (nativeText.trim().length > 0) {
    const nativeLines = nativeText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    nativeLines.forEach((line, idx) => {
      // Check if this line is already covered by a visual metric or table item
      const alreadyCaptured = evidenceItems.some(
        (item) => item.value.toLowerCase().includes(line.toLowerCase())
      );

      if (!alreadyCaptured && line.length > 3) {
        evidenceItems.push({
          id: `slide-${pageNumber}-native-${idx + 1}`,
          pageNumber,
          source: 'native_pdf',
          category: idx === 0 ? 'heading' : 'general',
          label: idx === 0 ? 'Slide Heading / Line' : 'Text Content',
          value: line,
          confidence: 'high',
        });
      }
    });
  }

  // Build unified normalized text
  const textParts: string[] = [];

  if (visualExtraction?.title) {
    textParts.push(`TITLE: ${visualExtraction.title}`);
  }
  if (visualExtraction?.subtitle) {
    textParts.push(`SUBTITLE: ${visualExtraction.subtitle}`);
  }
  if (visualExtraction?.summary) {
    textParts.push(`SUMMARY: ${visualExtraction.summary}`);
  }
  if (visualExtraction?.visibleText) {
    textParts.push(`VISIBLE TEXT:\n${visualExtraction.visibleText}`);
  } else if (nativeText) {
    textParts.push(`NATIVE TEXT:\n${nativeText}`);
  }

  const normalizedText = textParts.join('\n\n').trim();

  return {
    normalizedText: normalizedText || nativeText || 'No text extracted.',
    keyFacts,
    evidenceItems,
  };
}

