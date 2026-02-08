import { NextResponse } from 'next/server'
import { cleanupOldLogs } from '@/lib/security/submission-guard'

/**
 * Admin endpoint to cleanup old submission logs (older than 7 days).
 * Protected by admin middleware.
 */
export async function POST() {
  try {
    const deletedCount = await cleanupOldLogs()

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} old submission logs`,
    })
  } catch (error) {
    console.error('Cleanup logs error:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup logs' },
      { status: 500 }
    )
  }
}
