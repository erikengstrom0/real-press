/**
 * GPTZero API Provider
 *
 * Integrates with GPTZero's AI detection API.
 * Score: 0.0 = human, 1.0 = AI
 *
 * API Documentation: https://gptzero.me/docs
 */

import type { ProviderResult } from '../types'
import { BaseProvider, type ProviderInput, type ProviderCapabilities } from './base.provider'

const GPTZERO_API_URL = 'https://api.gptzero.me/v2/predict/text'
const MIN_CHARS_FOR_API = 250
const REQUEST_TIMEOUT_MS = 30000

interface GPTZeroResponse {
  documents: Array<{
    average_generated_prob: number
    completely_generated_prob: number
    overall_burstiness: number
    paragraphs: Array<{
      completely_generated_prob: number
      num_sentences: number
    }>
  }>
}

/**
 * GPTZero Provider Class
 * Extends BaseProvider for multi-modal architecture compatibility
 */
export class GPTZeroProvider extends BaseProvider {
  readonly name = 'gptzero'
  readonly capabilities: ProviderCapabilities = {
    contentTypes: ['text'],
  }

  isAvailable(): boolean {
    return isGPTZeroConfigured()
  }

  async analyze(input: ProviderInput): Promise<ProviderResult | null> {
    if (input.type !== 'text' || !input.text) {
      return null
    }
    return analyzeWithGPTZero(input.text)
  }
}

// Legacy function export for backwards compatibility
export async function analyzeWithGPTZero(text: string): Promise<ProviderResult | null> {
  const apiKey = process.env.GPTZERO_API_KEY

  if (!apiKey) {
    console.warn('GPTZero API key not configured, skipping API detection')
    return null
  }

  if (text.length < MIN_CHARS_FOR_API) {
    console.warn(`Text too short for GPTZero (${text.length} chars, minimum ${MIN_CHARS_FOR_API})`)
    return null
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const response = await fetch(GPTZERO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        document: text,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`GPTZero API error: ${response.status} - ${errorText}`)
      return null
    }

    const data: GPTZeroResponse = await response.json()

    if (!data.documents || data.documents.length === 0) {
      console.error('GPTZero returned empty documents array')
      return null
    }

    const doc = data.documents[0]

    // Use completely_generated_prob as the primary score
    // This represents the probability the entire document was AI-generated
    const score = doc.completely_generated_prob

    // Calculate confidence based on document metrics
    const confidence = calculateConfidence(doc)

    return {
      score,
      confidence,
      metadata: {
        averageGeneratedProb: doc.average_generated_prob,
        completelyGeneratedProb: doc.completely_generated_prob,
        burstiness: doc.overall_burstiness,
        paragraphCount: doc.paragraphs?.length ?? 0,
        paragraphScores: (doc.paragraphs ?? []).map((p, index) => ({
          index,
          score: p.completely_generated_prob,
        })),
      },
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('GPTZero API request timed out')
    } else {
      console.error('GPTZero API error:', error)
    }
    return null
  }
}

function calculateConfidence(doc: GPTZeroResponse['documents'][0]): number {
  // Higher confidence when:
  // - More paragraphs analyzed
  // - Scores are not in the ambiguous middle range

  const paragraphConfidence = Math.min((doc.paragraphs?.length ?? 1) / 5, 1)

  // Scores near 0.5 are less confident
  const scoreDistance = Math.abs(doc.completely_generated_prob - 0.5)
  const scoreConfidence = scoreDistance * 2 // Maps 0-0.5 to 0-1

  // GPTZero is generally reliable, so base confidence is higher
  const baseConfidence = 0.7

  return Math.min(baseConfidence + paragraphConfidence * 0.15 + scoreConfidence * 0.15, 0.95)
}

export function isGPTZeroConfigured(): boolean {
  return !!process.env.GPTZERO_API_KEY
}
