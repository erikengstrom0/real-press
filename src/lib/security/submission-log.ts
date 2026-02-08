/**
 * Structured submission logging for abuse forensics.
 *
 * Writes to console.log in JSON format (captured by Vercel logs).
 * Fire-and-forget — never throws.
 */

export interface SubmissionLogData {
  userId?: string
  ip: string
  url: string
  outcome: 'success' | 'blocked' | 'failed'
  reason?: string
}

export function logSubmission(data: SubmissionLogData): void {
  try {
    const entry = {
      type: 'submission',
      timestamp: new Date().toISOString(),
      userId: data.userId || null,
      ip: data.ip,
      url: data.url,
      outcome: data.outcome,
      reason: data.reason || null,
    }
    console.log(JSON.stringify(entry))
  } catch {
    // Never throw from logging
  }
}
