/**
 * Stripe Webhook Events Constants
 * Based on Stripe API webhook events
 */
export const StripeWebhookEvents = {
  // Checkout Session Events
  CHECKOUT_SESSION_COMPLETED: 'checkout.session.completed',
  CHECKOUT_SESSION_EXPIRED: 'checkout.session.expired',
  CHECKOUT_SESSION_ASYNC_PAYMENT_SUCCEEDED: 'checkout.session.async_payment_succeeded',
  CHECKOUT_SESSION_ASYNC_PAYMENT_FAILED: 'checkout.session.async_payment_failed',
  
  // Charge Events
  CHARGE_SUCCEEDED: 'charge.succeeded',
  CHARGE_FAILED: 'charge.failed',
  CHARGE_REFUNDED: 'charge.refunded',
  CHARGE_DISPUTE_CREATED: 'charge.dispute.created',
  
  // Payment Intent Events
  PAYMENT_INTENT_SUCCEEDED: 'payment_intent.succeeded',
  PAYMENT_INTENT_PAYMENT_FAILED: 'payment_intent.payment_failed',
  PAYMENT_INTENT_CANCELED: 'payment_intent.canceled',
  PAYMENT_INTENT_CREATED: 'payment_intent.created',
  
  // Customer Events
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_DELETED: 'customer.deleted',
  
  // Subscription Events
  CUSTOMER_SUBSCRIPTION_CREATED: 'customer.subscription.created',
  CUSTOMER_SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  CUSTOMER_SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
  CUSTOMER_SUBSCRIPTION_TRIAL_WILL_END: 'customer.subscription.trial_will_end',
  CUSTOMER_SUBSCRIPTION_PAUSED: 'customer.subscription.paused',
  CUSTOMER_SUBSCRIPTION_RESUMED: 'customer.subscription.resumed',
  
  // Invoice Events
  INVOICE_CREATED: 'invoice.created',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_PAYMENT_SUCCEEDED: 'invoice.payment_succeeded',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
  INVOICE_FINALIZED: 'invoice.finalized',
  INVOICE_MARKED_UNCOLLECTIBLE: 'invoice.marked_uncollectible',
  INVOICE_VOIDED: 'invoice.voided',
  
  // Payment Method Events
  PAYMENT_METHOD_ATTACHED: 'payment_method.attached',
  PAYMENT_METHOD_DETACHED: 'payment_method.detached',
} as const;

// Type for webhook event values
export type StripeWebhookEventType = typeof StripeWebhookEvents[keyof typeof StripeWebhookEvents];

/**
 * Webhook processing status
 */
export enum WebhookProcessingStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  DUPLICATE = 'duplicate',
}
