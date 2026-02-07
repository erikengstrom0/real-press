/**
 * Stripe Billing Service
 *
 * Handles Stripe customer management, checkout/portal sessions,
 * and webhook event processing for subscription lifecycle.
 */

import Stripe from 'stripe'
import prisma from '@/lib/db/prisma'

/**
 * Lazy-initialized Stripe client.
 * Avoids failing at build time when STRIPE_SECRET_KEY is not set.
 */
let _stripe: Stripe | null = null

function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required')
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-01-28.clover',
    })
  }
  return _stripe
}

/**
 * Map a Stripe price ID to a UserTier enum value.
 */
function syncTierFromPriceId(priceId: string): 'FREE' | 'PRO' | 'ENTERPRISE' {
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'PRO'
  if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) return 'ENTERPRISE'
  return 'FREE'
}

/**
 * Get or create a Stripe customer for a user.
 * If the user already has a stripeCustomerId, return it.
 * Otherwise, create a new Stripe customer and save the ID.
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string | null
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  })

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId
  }

  const customer = await getStripe().customers.create({
    email,
    name: name ?? undefined,
    metadata: { userId },
  })

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  })

  return customer.id
}

/**
 * Create a Stripe Checkout Session for a subscription.
 * Returns the checkout URL for redirect.
 */
export async function createCheckoutSession(
  userId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, name: true, stripeCustomerId: true },
  })

  const customerId = await getOrCreateStripeCustomer(userId, user.email, user.name)

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId },
  })

  if (!session.url) {
    throw new Error('Stripe checkout session URL not available')
  }

  return session.url
}

/**
 * Create a Stripe Customer Portal session for managing subscriptions.
 * Returns the portal URL for redirect.
 */
export async function createPortalSession(
  userId: string,
  returnUrl: string
): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeCustomerId: true },
  })

  if (!user.stripeCustomerId) {
    throw new Error('User has no Stripe customer ID')
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl,
  })

  return session.url
}

/**
 * Process a Stripe webhook event.
 * Updates user tier and subscription fields based on the event type.
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription' || !session.customer || !session.subscription) break

      const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id

      // Fetch full subscription to get price ID and period end
      const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
      const priceId = subscription.items.data[0]?.price?.id ?? ''
      const tier = syncTierFromPriceId(priceId)

      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          tier,
          stripeSubscriptionId: subscriptionId,
          stripeSubscriptionStatus: subscription.status,
          stripePriceId: priceId,
          stripeCurrentPeriodEnd: new Date(subscription.items.data[0].current_period_end * 1000),
        },
      })
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
      const priceId = subscription.items.data[0]?.price?.id ?? ''
      const tier = syncTierFromPriceId(priceId)

      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          tier,
          stripeSubscriptionStatus: subscription.status,
          stripePriceId: priceId,
          stripeCurrentPeriodEnd: new Date(subscription.items.data[0].current_period_end * 1000),
        },
      })
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id

      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          tier: 'FREE',
          stripeSubscriptionId: null,
          stripeSubscriptionStatus: 'canceled',
          stripePriceId: null,
          stripeCurrentPeriodEnd: null,
        },
      })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer as { id: string } | null)?.id
      if (!customerId) break

      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          stripeSubscriptionStatus: 'past_due',
        },
      })
      break
    }
  }
}

/**
 * Verify a Stripe webhook signature and return the event.
 */
export function constructWebhookEvent(
  body: string,
  signature: string
): Stripe.Event {
  return getStripe().webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  )
}
