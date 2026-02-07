/**
 * Video Detection Provider
 *
 * Analyzes videos by extracting frames and running image detection on each.
 * Aggregates frame scores with confidence-weighted averaging.
 */

import type { ProviderResult } from '../types'
import { BaseProvider, type ProviderInput, type ProviderCapabilities } from './base.provider'
import { LocalImageProvider } from './image-local.provider'
import { aggregateImageScores } from '../composite-score'

/**
 * ML Service frame extraction response
 */
interface ExtractFramesResponse {
  frame_base64: string[]
  fps: number
  duration: number
  total_frames: number
  extracted_count: number
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
 * Check if video detection is enabled
 */
function isVideoDetectionEnabled(): boolean {
  const enabled = process.env.PROVIDER_VIDEO_ENABLED
  return enabled !== 'false' // Enabled by default unless explicitly disabled
}

/**
 * Video Provider
 *
 * Extracts frames from videos and analyzes each frame for AI-generated content.
 * Aggregates results with variance-adjusted confidence.
 */
export class VideoProvider extends BaseProvider {
  readonly name = 'video'
  readonly capabilities: ProviderCapabilities = {
    contentTypes: ['video'],
  }

  private readonly imageProvider: LocalImageProvider
  private readonly timeoutMs = 60000
  private readonly maxFrames = 20

  constructor(imageProvider?: LocalImageProvider) {
    super()
    this.imageProvider = imageProvider || new LocalImageProvider()
  }

  isAvailable(): boolean {
    return isVideoDetectionEnabled() && this.imageProvider.isAvailable()
  }

  async analyze(input: ProviderInput): Promise<ProviderResult | null> {
    if (input.type !== 'video') {
      return null
    }

    if (!input.videoUrl) {
      console.warn('VideoProvider: No video URL provided')
      return null
    }

    try {
      // Extract frames from video via ML service
      const frames = await this.extractFrames(input.videoUrl)

      if (!frames || frames.length === 0) {
        console.warn('VideoProvider: No frames extracted from video')
        return null
      }

      // Analyze each frame
      const frameScores = await this.analyzeFrames(frames)

      if (frameScores.length === 0) {
        console.warn('VideoProvider: No frames could be analyzed')
        return null
      }

      // Aggregate frame scores
      const aggregated = aggregateImageScores(frameScores)

      // Build per-frame breakdown for explainability
      const perFrameScores = frameScores.map((fs, index) => ({
        index,
        score: fs.score,
        confidence: fs.confidence,
      }))

      return {
        score: aggregated.score,
        confidence: aggregated.confidence,
        metadata: {
          frameCount: frames.length,
          analyzedFrameCount: frameScores.length,
          provider: this.name,
          perFrameScores,
        },
      }
    } catch (error) {
      console.error('VideoProvider error:', error)
      return null
    }
  }

  /**
   * Extract frames from a video via the ML service
   */
  private async extractFrames(videoUrl: string): Promise<string[]> {
    const mlServiceUrl = getMLServiceUrl()
    const endpoint = `${mlServiceUrl}/api/extract-frames`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getMLServiceHeaders(),
        body: JSON.stringify({
          video_url: videoUrl,
          max_frames: this.maxFrames,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Frame extraction error: ${response.status} - ${errorText}`)
        return []
      }

      const data: ExtractFramesResponse = await response.json()
      return data.frame_base64 || []
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Frame extraction timed out')
      } else {
        console.error('Frame extraction error:', error)
      }
      return []
    }
  }

  /**
   * Analyze each frame with the image provider
   */
  private async analyzeFrames(
    frameBase64: string[]
  ): Promise<Array<{ score: number; confidence: number }>> {
    const scores: Array<{ score: number; confidence: number }> = []

    // Analyze frames in parallel with concurrency limit
    const concurrencyLimit = 5
    const batches: string[][] = []

    for (let i = 0; i < frameBase64.length; i += concurrencyLimit) {
      batches.push(frameBase64.slice(i, i + concurrencyLimit))
    }

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (frame) => {
          try {
            const result = await this.imageProvider.analyze({
              type: 'image',
              imageBase64: frame,
            })

            if (result) {
              return { score: result.score, confidence: result.confidence }
            }
            return null
          } catch {
            return null
          }
        })
      )

      for (const result of batchResults) {
        if (result) {
          scores.push(result)
        }
      }
    }

    return scores
  }
}

// Export singleton instance for convenience
export const videoProvider = new VideoProvider()
