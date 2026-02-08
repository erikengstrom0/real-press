/**
 * Admin Audit Logs API
 *
 * GET /api/admin/audit-logs — View admin action logs with filters
 *
 * Query parameters:
 * - action: filter by action type (e.g., 'blocklist.add')
 * - resourceType: filter by resource type (e.g., 'domain')
 * - resourceId: filter by specific resource ID
 * - adminId: filter by admin user ID
 * - limit: number of logs to return (default 100, max 500)
 * - offset: pagination offset (default 0)
 *
 * Protected by admin middleware (ADMIN_SECRET).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuditLogs, getAuditStats } from '@/lib/services/audit.service'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const action = searchParams.get('action') || undefined
  const resourceType = searchParams.get('resourceType') || undefined
  const resourceId = searchParams.get('resourceId') || undefined
  const adminId = searchParams.get('adminId') || undefined
  const limit = Math.min(
    parseInt(searchParams.get('limit') || '100', 10),
    500
  )
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const stats = searchParams.get('stats') === 'true'

  // If stats requested, return statistics instead of logs
  if (stats) {
    const since = searchParams.get('since')
      ? new Date(searchParams.get('since')!)
      : undefined
    const statistics = await getAuditStats(since)
    return NextResponse.json(statistics)
  }

  const result = await getAuditLogs({
    action,
    resourceType,
    resourceId,
    adminId,
    limit,
    offset,
  })

  return NextResponse.json(result)
}
