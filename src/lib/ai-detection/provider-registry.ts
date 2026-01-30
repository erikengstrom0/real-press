/**
 * Provider Registry
 *
 * Manages registration and retrieval of AI detection providers.
 * Supports dynamic provider management and content-type-based filtering.
 */

import { BaseProvider } from './providers/base.provider'
import type { ContentType } from './types'

class ProviderRegistry {
  private providers: Map<string, BaseProvider> = new Map()

  /**
   * Register a provider
   */
  register(provider: BaseProvider): void {
    if (this.providers.has(provider.name)) {
      console.warn(`Provider "${provider.name}" is already registered. Overwriting.`)
    }
    this.providers.set(provider.name, provider)
  }

  /**
   * Unregister a provider by name
   */
  unregister(name: string): boolean {
    return this.providers.delete(name)
  }

  /**
   * Get a provider by name
   */
  get(name: string): BaseProvider | undefined {
    return this.providers.get(name)
  }

  /**
   * Get all registered providers
   */
  getAll(): BaseProvider[] {
    return Array.from(this.providers.values())
  }

  /**
   * Get all available providers (configured and ready to use)
   */
  getAvailable(): BaseProvider[] {
    return this.getAll().filter((provider) => provider.isAvailable())
  }

  /**
   * Get providers that support a specific content type
   */
  getByContentType(type: ContentType): BaseProvider[] {
    return this.getAvailable().filter((provider) => provider.supportsContentType(type))
  }

  /**
   * Get the primary provider for a content type
   * Returns the first available provider that supports the type
   */
  getPrimaryForContentType(type: ContentType): BaseProvider | undefined {
    return this.getByContentType(type)[0]
  }

  /**
   * Check if any provider supports a content type
   */
  hasProviderForContentType(type: ContentType): boolean {
    return this.getByContentType(type).length > 0
  }

  /**
   * Get all supported content types
   */
  getSupportedContentTypes(): ContentType[] {
    const types = new Set<ContentType>()
    for (const provider of this.getAvailable()) {
      for (const type of provider.capabilities.contentTypes) {
        types.add(type)
      }
    }
    return Array.from(types)
  }

  /**
   * Get registry summary for debugging
   */
  getSummary(): {
    total: number
    available: number
    providers: Array<{ name: string; available: boolean; contentTypes: ContentType[] }>
  } {
    const providers = this.getAll().map((p) => ({
      name: p.name,
      available: p.isAvailable(),
      contentTypes: p.capabilities.contentTypes,
    }))

    return {
      total: providers.length,
      available: providers.filter((p) => p.available).length,
      providers,
    }
  }

  /**
   * Clear all registered providers
   */
  clear(): void {
    this.providers.clear()
  }
}

// Singleton instance
export const providerRegistry = new ProviderRegistry()

// Export the class for testing purposes
export { ProviderRegistry }
