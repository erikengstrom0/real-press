/**
 * Base Provider Abstract Class
 *
 * All AI detection providers must extend this class.
 * Provides a consistent interface for multi-modal content detection.
 */

import type { ProviderResult, ContentType } from '../types'

/**
 * Input for provider analysis
 */
export interface ProviderInput {
  type: ContentType
  text?: string
  imageUrl?: string
  imageBase64?: string
  videoUrl?: string
}

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
  contentTypes: ContentType[]
}

/**
 * Abstract base class for all detection providers
 */
export abstract class BaseProvider {
  /**
   * Unique name identifier for this provider
   */
  abstract readonly name: string

  /**
   * Provider capabilities including supported content types
   */
  abstract readonly capabilities: ProviderCapabilities

  /**
   * Analyze content and return detection result
   * @param input - Content to analyze
   * @returns Detection result or null if analysis failed/skipped
   */
  abstract analyze(input: ProviderInput): Promise<ProviderResult | null>

  /**
   * Check if provider is available and properly configured
   * @returns true if provider can be used
   */
  abstract isAvailable(): boolean

  /**
   * Check if this provider supports a given content type
   */
  supportsContentType(type: ContentType): boolean {
    return this.capabilities.contentTypes.includes(type)
  }

  /**
   * Get provider description for logging/debugging
   */
  getDescription(): string {
    return `${this.name} (${this.capabilities.contentTypes.join(', ')})`
  }
}
