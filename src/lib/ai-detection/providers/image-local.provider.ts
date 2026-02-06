/**
 * Local Image Detection Provider
 *
 * Connects to the Python ML service for AI-generated image detection.
 * Uses CNNDetection model for image analysis.
 */

import type { ProviderResult } from '../types'
import { BaseProvider, type ProviderInput, type ProviderCapabilities } from './base.provider'

/**
 * ML Service response format
 */
interface MLServiceResponse {
  score: number
  confidence: number
  model: string
}

/**
 * Get the ML service URL from environment
 */
function getMLServiceUrl(): string {
  return process.env.ML_SERVICE_URL || 'http://localhost:8000'
}

/**
 * Build auth headers for ML service requests
 */
function getMLServiceHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const secret = process.env.CRON_SECRET
  if (secret) {
    headers['Authorization'] = `Bearer ${secret}`
  }
  return headers
}

/**
 * Check if image detection is enabled
 */
function isImageDetectionEnabled(): boolean {
  const enabled = process.env.PROVIDER_IMAGE_ENABLED
  return enabled !== 'false' // Enabled by default unless explicitly disabled
}

/**
 * Local Image Provider
 *
 * Sends images to the Python ML service for AI detection analysis.
 */
export class LocalImageProvider extends BaseProvider {
  readonly name = 'image-local'
  readonly capabilities: ProviderCapabilities = {
    contentTypes: ['image'],
  }

  private readonly timeoutMs = 30000

  isAvailable(): boolean {
    return isImageDetectionEnabled()
  }

  async analyze(input: ProviderInput): Promise<ProviderResult | null> {
    if (input.type !== 'image') {
      return null
    }

    if (!input.imageUrl && !input.imageBase64) {
      console.warn('LocalImageProvider: No image URL or base64 provided')
      return null
    }

    try {
      const mlServiceUrl = getMLServiceUrl()
      const endpoint = `${mlServiceUrl}/api/detect/image`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

      const body: Record<string, string> = {}
      if (input.imageUrl) {
        body.image_url = input.imageUrl
      } else if (input.imageBase64) {
        body.image_base64 = input.imageBase64
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getMLServiceHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`ML Service error: ${response.status} - ${errorText}`)
        return null
      }

      const data: MLServiceResponse = await response.json()

      return {
        score: data.score,
        confidence: data.confidence,
        metadata: {
          model: data.model,
          provider: this.name,
        },
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('ML Service request timed out')
      } else {
        console.error('ML Service error:', error)
      }
      return null
    }
  }

  /**
   * Check if the ML service is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const mlServiceUrl = getMLServiceUrl()
      const response = await fetch(`${mlServiceUrl}/health`, {
        method: 'GET',
      })

      if (!response.ok) {
        return false
      }

      const data = await response.json()
      return data.status === 'healthy'
    } catch {
      return false
    }
  }
}

// Export singleton instance for convenience
export const localImageProvider = new LocalImageProvider()
