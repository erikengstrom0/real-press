/**
 * API Key Service
 *
 * CRUD operations for API keys used in the public verification API.
 * Raw keys are never stored — only SHA-256 hashes.
 * Key format: rp_live_ + 32 hex characters
 */

import { randomBytes, createHash } from 'crypto'
import prisma from '@/lib/db/prisma'

const KEY_PREFIX = 'rp_live_'

/**
 * Hash a raw API key using SHA-256.
 */
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex')
}

/**
 * Generate a new raw API key.
 * Format: rp_live_ + 32 hex characters (16 random bytes)
 */
function generateRawKey(): string {
  return KEY_PREFIX + randomBytes(16).toString('hex')
}

/**
 * Create a new API key for a user.
 * Returns the raw key (only shown once) and the database record.
 */
export async function createApiKey(userId: string, name: string) {
  const rawKey = generateRawKey()
  const hashed = hashApiKey(rawKey)
  // Store a visible prefix for identification: rp_live_<first 8 hex chars>...
  const keyPrefix = rawKey.slice(0, KEY_PREFIX.length + 8)

  const apiKey = await prisma.apiKey.create({
    data: {
      userId,
      hashedKey: hashed,
      keyPrefix,
      name,
    },
    select: {
      id: true,
      keyPrefix: true,
      name: true,
      createdAt: true,
    },
  })

  return { ...apiKey, rawKey }
}

/**
 * Validate an API key and return the associated user info.
 * Returns null if the key is invalid or revoked.
 * Updates lastUsedAt on successful validation.
 */
export async function validateApiKey(rawKey: string) {
  if (!rawKey.startsWith(KEY_PREFIX)) {
    return null
  }

  const hashed = hashApiKey(rawKey)

  const apiKey = await prisma.apiKey.findUnique({
    where: { hashedKey: hashed },
    select: {
      id: true,
      userId: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          tier: true,
        },
      },
    },
  })

  if (!apiKey || apiKey.revokedAt) {
    return null
  }

  // Update lastUsedAt (fire and forget)
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {
    // Non-critical — don't fail the request
  })

  return {
    userId: apiKey.user.id,
    tier: apiKey.user.tier,
  }
}

/**
 * List all API keys for a user (without the hashed key).
 */
export async function listApiKeys(userId: string) {
  return prisma.apiKey.findMany({
    where: { userId },
    select: {
      id: true,
      keyPrefix: true,
      name: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Revoke an API key. Sets revokedAt timestamp; does not delete the row.
 */
export async function revokeApiKey(userId: string, keyId: string) {
  const apiKey = await prisma.apiKey.findFirst({
    where: { id: keyId, userId },
  })

  if (!apiKey) {
    return null
  }

  return prisma.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
    select: {
      id: true,
      keyPrefix: true,
      name: true,
      revokedAt: true,
    },
  })
}
