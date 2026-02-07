/**
 * Build AiScoreRow from Detection Results
 *
 * Maps CompositeResult and MultiModalResult into AiScoreRow shape
 * so they can be passed to formatFreeResponse / formatPaidResponse.
 */

import type { CompositeResult, MultiModalResult, ContentType } from '@/lib/ai-detection'
import type {
  StoredProviderDetail,
  StoredHeuristicMetrics,
  StoredFusionDetails,
} from '@/lib/ai-detection/types'
import type { AiScoreRow } from '@/lib/ai-detection/format-breakdown'

/**
 * Build an AiScoreRow from a text-only CompositeResult.
 */
export function buildAiScoreRowFromComposite(result: CompositeResult): AiScoreRow {
  const meta = result.metadata

  // Build provider details from metadata.providerResults
  let providerDetails: StoredProviderDetail[] | null = null
  if (meta?.providerResults) {
    providerDetails = meta.providerResults.map((pr) => ({
      name: (pr as Record<string, unknown>).name as string,
      type: (pr as Record<string, unknown>).type as string,
      score: (pr as Record<string, unknown>).score as number,
      confidence: (pr as Record<string, unknown>).confidence as number,
      isPrimary: (pr as Record<string, unknown>).isPrimary as boolean,
      available: (pr as Record<string, unknown>).available as boolean,
      metadata: (pr as Record<string, unknown>).metadata as StoredProviderDetail['metadata'],
    }))
  }

  // Build heuristic metrics
  let heuristicMetrics: StoredHeuristicMetrics | null = null
  if (meta?.heuristicMetrics && meta?.heuristicFeatureScores && meta?.heuristicFeatureWeights) {
    heuristicMetrics = {
      ...meta.heuristicMetrics,
      featureScores: meta.heuristicFeatureScores,
      featureWeights: meta.heuristicFeatureWeights,
    }
  }

  // Build fusion details
  let fusionDetails: StoredFusionDetails | null = null
  if (meta?.primaryProvider != null) {
    fusionDetails = {
      method: 'text_only',
      textFusion: {
        primaryProvider: meta.primaryProvider || 'heuristic',
        apiWeight: meta.apiWeight ?? 0.7,
        heuristicWeight: meta.heuristicWeight ?? 0.3,
        apiScore: result.gptzeroScore ?? 0,
        heuristicScore: result.heuristicScore,
      },
    }
  }

  return {
    compositeScore: result.compositeScore,
    classification: result.classification,
    textScore: result.compositeScore,
    textConfidence: providerDetails
      ?.find((p) => p.isPrimary && p.available)?.confidence ?? 0.5,
    analyzedTypes: ['text'] as ContentType[],
    providerDetails,
    heuristicMetrics,
    fusionDetails,
  }
}

/**
 * Build an AiScoreRow from a MultiModalResult.
 */
export function buildAiScoreRowFromMultiModal(result: MultiModalResult): AiScoreRow {
  const meta = result.metadata

  // Extract provider details from the text content score metadata
  const textScore = result.contentScores.find((cs) => cs.type === 'text')
  let providerDetails: StoredProviderDetail[] | null = null
  let heuristicMetrics: StoredHeuristicMetrics | null = null

  if (textScore?.metadata?.providerResults) {
    const providerResults = textScore.metadata.providerResults as Record<string, unknown>[]
    providerDetails = providerResults.map((pr) => ({
      name: pr.name as string,
      type: pr.type as string,
      score: pr.score as number,
      confidence: pr.confidence as number,
      isPrimary: pr.isPrimary as boolean,
      available: pr.available as boolean,
      metadata: pr.metadata as StoredProviderDetail['metadata'],
    }))

    // Extract heuristic metrics from the heuristic provider
    const heuristicProvider = providerResults.find((pr) => pr.name === 'heuristic')
    if (heuristicProvider?.metadata) {
      const hMeta = heuristicProvider.metadata as Record<string, unknown>
      if (hMeta.metrics && hMeta.featureScores && hMeta.featureWeights) {
        heuristicMetrics = {
          ...(hMeta.metrics as StoredHeuristicMetrics),
          featureScores: hMeta.featureScores as StoredHeuristicMetrics['featureScores'],
          featureWeights: hMeta.featureWeights as StoredHeuristicMetrics['featureWeights'],
        }
      }
    }
  }

  // Build fusion details
  let fusionDetails: StoredFusionDetails | null = null
  if (meta?.modalityWeights) {
    fusionDetails = {
      method: 'multi_modal',
      modalityWeights: meta.modalityWeights,
      totalEffectiveWeight: meta.totalEffectiveWeight,
    }
  } else if (textScore) {
    fusionDetails = {
      method: 'text_only',
      textFusion: {
        primaryProvider: (textScore.metadata?.primaryProvider as string) || 'heuristic',
        apiWeight: (textScore.metadata?.apiWeight as number) ?? 0.7,
        heuristicWeight: (textScore.metadata?.heuristicWeight as number) ?? 0.3,
        apiScore: (textScore.metadata?.apiScore as number) ?? 0,
        heuristicScore: (textScore.metadata?.heuristicScore as number) ?? 0,
      },
    }
  }

  return {
    compositeScore: result.compositeScore,
    classification: result.classification,
    textScore: meta?.textScore ?? null,
    textConfidence: meta?.textConfidence ?? null,
    imageScore: meta?.imageScore ?? null,
    imageConfidence: meta?.imageConfidence ?? null,
    videoScore: meta?.videoScore ?? null,
    videoConfidence: meta?.videoConfidence ?? null,
    analyzedTypes: result.analyzedTypes,
    providerDetails,
    heuristicMetrics,
    fusionDetails,
  }
}
