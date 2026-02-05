/**
 * Hugging Face AI Detection Provider
 *
 * Uses free Hugging Face Inference API with RoBERTa-based AI text detectors.
 * Score: 0.0 = human, 1.0 = AI
 *
 * Models available:
 * - roberta-base-openai-detector (default) - OpenAI's GPT-2 detector
 * - roberta-large-openai-detector - Larger, more accurate version
 *
 * API Documentation: https://huggingface.co/docs/api-inference
 */

import type { ProviderResult } from '../types'
import { BaseProvider, type ProviderInput, type ProviderCapabilities } from './base.provider'

// Default to the base model (faster, still accurate)
const DEFAULT_MODEL = 'openai-community/roberta-base-openai-detector'
// Updated to new router endpoint (api-inference.huggingface.co is deprecated as of 2025)
const HUGGINGFACE_API_URL = 'https://router.huggingface.co/hf-inference/models'
const MIN_CHARS_FOR_API = 50
const REQUEST_TIMEOUT_MS = 30000
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 2000

interface HuggingFaceClassification {
  label: string // "LABEL_0" (human) or "LABEL_1" (AI) for OpenAI detector
  score: number // Confidence score 0-1
}

type HuggingFaceResponse = HuggingFaceClassification[][]

interface HuggingFaceError {
  error: string
  estimated_time?: number
}

/**
 * Hugging Face Provider Class
 * Uses free Inference API for AI text detection
 */
export class HuggingFaceProvider extends BaseProvider {
  readonly name = 'huggingface'
  readonly capabilities: ProviderCapabilities = {
    contentTypes: ['text'],
  }

  private model: string

  constructor(model?: string) {
    super()
    this.model = model || process.env.HUGGINGFACE_MODEL || DEFAULT_MODEL
  }

  isAvailable(): boolean {
    // Hugging Face Inference API works without a token (rate-limited)
    // With a token, you get higher rate limits
    return true
  }

  async analyze(input: ProviderInput): Promise<ProviderResult | null> {
    if (input.type !== 'text' || !input.text) {
      return null
    }
    return analyzeWithHuggingFace(input.text, this.model)
  }
}

/**
 * Analyze text using Hugging Face Inference API
 */
export async function analyzeWithHuggingFace(
  text: string,
  model: string = DEFAULT_MODEL
): Promise<ProviderResult | null> {
  if (text.length < MIN_CHARS_FOR_API) {
    console.warn(`Text too short for Hugging Face (${text.length} chars, minimum ${MIN_CHARS_FOR_API})`)
    return null
  }

  // Truncate very long text (RoBERTa model has 514 token limit, ~4 chars/token average)
  // Using 1800 chars to stay safely under 514 tokens with some margin
  const truncatedText = text.slice(0, 1800)

  const apiToken = process.env.HUGGINGFACE_API_TOKEN

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      // Add token if available (higher rate limits)
      if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`
      }

      const response = await fetch(`${HUGGINGFACE_API_URL}/${model}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          inputs: truncatedText,
          options: {
            wait_for_model: true, // Wait if model is loading
          },
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as HuggingFaceError

        // Model is loading - wait and retry
        if (response.status === 503 && errorData.estimated_time) {
          console.log(`Hugging Face model loading, waiting ${errorData.estimated_time}s...`)
          if (attempt < MAX_RETRIES) {
            await sleep(Math.min(errorData.estimated_time * 1000, RETRY_DELAY_MS))
            continue
          }
        }

        // Rate limited
        if (response.status === 429) {
          console.warn('Hugging Face rate limit reached')
          if (attempt < MAX_RETRIES) {
            await sleep(RETRY_DELAY_MS)
            continue
          }
        }

        console.error(`Hugging Face API error: ${response.status} - ${errorData.error}`)
        return null
      }

      const data: HuggingFaceResponse = await response.json()

      // Response is [[{label, score}, {label, score}]]
      if (!data || !data[0] || data[0].length === 0) {
        console.error('Hugging Face returned empty response')
        return null
      }

      const classifications = data[0]

      // Find the scores for each label
      // OpenAI detector: LABEL_0 = Real (human), LABEL_1 = Fake (AI)
      const aiClassification = classifications.find(
        (c) => c.label === 'LABEL_1' || c.label === 'Fake' || c.label === 'AI'
      )
      const humanClassification = classifications.find(
        (c) => c.label === 'LABEL_0' || c.label === 'Real' || c.label === 'Human'
      )

      let score: number
      if (aiClassification) {
        // AI probability is our score (0 = human, 1 = AI)
        score = aiClassification.score
      } else if (humanClassification) {
        // Invert human probability to get AI score
        score = 1 - humanClassification.score
      } else {
        console.error('Hugging Face returned unexpected labels:', classifications)
        return null
      }

      // Confidence is how far from 0.5 the score is
      const confidence = calculateConfidence(score, classifications)

      return {
        score,
        confidence,
        metadata: {
          model,
          classifications,
          truncated: text.length > 5000,
        },
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Hugging Face API request timed out')
      } else {
        console.error('Hugging Face API error:', error)
      }

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS)
        continue
      }

      return null
    }
  }

  return null
}

/**
 * Calculate confidence based on score and classification probabilities
 */
function calculateConfidence(score: number, classifications: HuggingFaceClassification[]): number {
  // Base confidence from score distance from 0.5
  const scoreDistance = Math.abs(score - 0.5)
  const scoreConfidence = scoreDistance * 2 // Maps 0-0.5 to 0-1

  // If we have clear classifications, use the winning probability
  const maxProb = Math.max(...classifications.map((c) => c.score))

  // Combine score-based and probability-based confidence
  // Higher max probability = more confident model
  const baseConfidence = 0.6
  const confidence = baseConfidence + scoreConfidence * 0.2 + (maxProb - 0.5) * 0.2

  return Math.min(confidence, 0.9)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Check if Hugging Face is configured with an API token
 * Note: API works without token but with lower rate limits
 */
export function isHuggingFaceConfigured(): boolean {
  return !!process.env.HUGGINGFACE_API_TOKEN
}

/**
 * Check if Hugging Face is available (always true, works without token)
 */
export function isHuggingFaceAvailable(): boolean {
  return true
}
