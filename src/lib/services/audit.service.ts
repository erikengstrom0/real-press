/**
 * Admin Audit Logging Service
 *
 * Records admin actions for compliance, debugging, and security monitoring.
 * All admin endpoints should log their actions through this service.
 */

import prisma from '@/lib/db/prisma'

export interface AuditLogEntry {
  action: string // e.g., 'blocklist.add', 'content.delete', 'user.tier_change'
  resourceType: string // e.g., 'domain', 'content', 'user'
  resourceId?: string | null // ID of affected resource
  adminId?: string | null // Admin user ID (null if authenticated via ADMIN_SECRET)
  metadata?: Record<string, unknown> | null // Additional context
}

/**
 * Log an admin action to the audit trail
 *
 * Fire-and-forget operation - errors are logged but don't block the original action
 */
export async function logAdminAction(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId || null,
        adminId: entry.adminId || null,
        metadata: entry.metadata ? JSON.parse(JSON.stringify(entry.metadata)) : null,
      },
    })
  } catch (error) {
    // Log to console but don't throw - audit failures shouldn't block admin operations
    console.error('Failed to log admin action:', error)
  }
}

/**
 * Get audit logs with optional filters
 */
export async function getAuditLogs(options?: {
  action?: string
  resourceType?: string
  resourceId?: string
  adminId?: string
  limit?: number
  offset?: number
}) {
  const { action, resourceType, resourceId, adminId, limit = 100, offset = 0 } = options || {}

  const where: {
    action?: string
    resourceType?: string
    resourceId?: string
    adminId?: string
  } = {}

  if (action) where.action = action
  if (resourceType) where.resourceType = resourceType
  if (resourceId) where.resourceId = resourceId
  if (adminId) where.adminId = adminId

  const [logs, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.adminAuditLog.count({ where }),
  ])

  return { logs, total, limit, offset }
}

/**
 * Get recent audit logs for a specific resource
 */
export async function getResourceAuditHistory(
  resourceType: string,
  resourceId: string,
  limit = 20
) {
  return prisma.adminAuditLog.findMany({
    where: {
      resourceType,
      resourceId,
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
  })
}

/**
 * Get audit log statistics
 */
export async function getAuditStats(since?: Date) {
  const where = since ? { timestamp: { gte: since } } : {}

  const [totalLogs, actionCounts, resourceTypeCounts] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.groupBy({
      by: ['action'],
      where,
      _count: true,
      orderBy: { _count: { action: 'desc' } },
    }),
    prisma.adminAuditLog.groupBy({
      by: ['resourceType'],
      where,
      _count: true,
      orderBy: { _count: { resourceType: 'desc' } },
    }),
  ])

  return {
    totalLogs,
    actionCounts: actionCounts.map((item: { action: string; _count: number }) => ({
      action: item.action,
      count: item._count,
    })),
    resourceTypeCounts: resourceTypeCounts.map((item: { resourceType: string; _count: number }) => ({
      resourceType: item.resourceType,
      count: item._count,
    })),
  }
}
