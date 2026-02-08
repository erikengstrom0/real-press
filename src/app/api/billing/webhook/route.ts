/**
 * POST /api/billing/webhook
 *
 * Handles Stripe webhook events.
 * NO auth — Stripe sends this directly.
 * Signature verification via STRIPE_WEBHOOK_SECRET.
 */

import { NextResponse } from 'next/server'
import { constructWebhookEvent, handleWebhookEvent } from '@/lib/services/billing.service'

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let body: string
  try {
    body = await request.text()
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 })
  }

  let event
  try {
    event = constructWebhookEvent(body, signature)
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    await handleWebhookEvent(event)
  } catch (error) {
    console.error('Webhook handler error:', error)
    // Still return 200 to prevent Stripe retries for handler errors
  }

  return NextResponse.json({ received: true })
}
