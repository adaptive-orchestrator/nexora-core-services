# Stripe Integration for Payment Service

## Overview

This document describes the Stripe payment integration added to the payment-svc microservice.

## Installation

### 1. Install Stripe Package

```bash
cd nexora-core-services/bmms
npm install stripe
npm install --save-dev @types/stripe
```

### 2. Install Radix UI Radio Group (Frontend)

```bash
cd frontend
npm install @radix-ui/react-radio-group
```

### 3. Configure Environment Variables

Add the following to your `.env` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret
FRONTEND_URL=http://localhost:5173
```

Get your API keys from: https://dashboard.stripe.com/apikeys

### 4. Run Database Migration

```bash
# Apply the migration
psql -U bmms_user -d payment_db -f migrations/20241213_add_stripe_fields.sql
```

Or if using TypeORM migrations, the entities will auto-sync in development mode.

## Files Created/Modified

### Backend (NestJS)

#### New Files:
- `apps/finance/payment-svc/src/stripe/stripe.module.ts` - Stripe module with provider
- `apps/finance/payment-svc/src/stripe/stripe.service.ts` - Stripe service with all payment methods
- `apps/finance/payment-svc/src/stripe/index.ts` - Module exports
- `apps/finance/payment-svc/src/stripe-webhook.controller.ts` - Webhook endpoint controller
- `apps/finance/payment-svc/src/stripe-webhook.service.ts` - Webhook event handling
- `apps/finance/payment-svc/src/constants/stripe-webhook-events.ts` - Webhook event constants
- `apps/finance/payment-svc/src/dto/stripe-checkout.dto.ts` - DTOs for Stripe operations
- `apps/finance/payment-svc/src/entities/stripe-webhook-event.entity.ts` - Webhook tracking entity

#### Modified Files:
- `apps/finance/payment-svc/src/payment-svc.module.ts` - Import StripeModule
- `apps/finance/payment-svc/src/payment-svc.controller.ts` - Added Stripe endpoints
- `apps/finance/payment-svc/src/entities/payment.entity.ts` - Added Stripe fields
- `apps/finance/payment-svc/src/main.ts` - Added raw body middleware for webhooks

### Frontend (React)

#### New Files:
- `src/lib/api/stripe.ts` - Stripe API client
- `src/pages/Checkout/Success.tsx` - Checkout success page
- `src/pages/Checkout/Cancel.tsx` - Checkout cancel page
- `src/components/ui/radio-group.tsx` - Radio group component

#### Modified Files:
- `src/pages/Checkout/index.tsx` - Added Stripe checkout support
- `src/routes/index.tsx` - Added success/cancel routes

## API Endpoints

### Stripe Checkout Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/payments/stripe/checkout` | Create checkout session (one-time) |
| POST | `/payments/stripe/checkout/subscription` | Create subscription checkout |
| POST | `/payments/stripe/payment-intent` | Create payment intent |
| POST | `/payments/stripe/refund` | Create refund |
| POST | `/payments/stripe/billing-portal` | Create billing portal session |
| GET | `/payments/stripe/session/:sessionId` | Get session details |

### Webhook Endpoint

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/stripe/webhook` | Receive Stripe webhook events |

## Webhook Events Handled

- `checkout.session.completed` - Payment completed
- `checkout.session.expired` - Session expired
- `payment_intent.succeeded` - Payment successful
- `payment_intent.payment_failed` - Payment failed
- `charge.refunded` - Refund processed
- `customer.subscription.created` - Subscription created
- `customer.subscription.updated` - Subscription updated
- `customer.subscription.deleted` - Subscription cancelled
- `invoice.payment_succeeded` - Invoice paid
- `invoice.payment_failed` - Invoice payment failed

## Setting Up Stripe Webhooks

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter your webhook URL: `https://your-domain.com/stripe/webhook`
4. Select events to listen for (or select all events)
5. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

### Local Development (with Stripe CLI)

```bash
# Install Stripe CLI
# Windows: scoop install stripe
# Mac: brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3013/stripe/webhook

# Copy the webhook signing secret displayed
```

## Testing

### Test Cards

| Card Number | Description |
|-------------|-------------|
| 4242 4242 4242 4242 | Succeeds |
| 4000 0000 0000 0002 | Declined |
| 4000 0000 0000 9995 | Insufficient funds |
| 4000 0025 0000 3155 | Requires authentication |

Use any future expiry date and any 3-digit CVC.

## Flow Diagram

```
┌─────────────────┐
│   Frontend      │
│   Checkout      │
└────────┬────────┘
         │ Create Order
         ▼
┌─────────────────┐
│  Payment SVC    │
│  /stripe/       │
│  checkout       │
└────────┬────────┘
         │ Create Session
         ▼
┌─────────────────┐
│     Stripe      │
│  Checkout Page  │
└────────┬────────┘
         │ Payment Complete
         ▼
┌─────────────────┐
│  Stripe Webhook │
│  /stripe/       │
│  webhook        │
└────────┬────────┘
         │ Emit Kafka Event
         ▼
┌─────────────────┐
│  Order SVC /    │
│  Billing SVC    │
└─────────────────┘
```

## Security Considerations

1. **Never expose STRIPE_SECRET_KEY** to frontend
2. **Always verify webhook signatures** before processing
3. **Use HTTPS** in production
4. **Implement idempotency** for webhooks (already handled)
5. **Log webhook events** for debugging

## Troubleshooting

### Webhook signature verification fails
- Ensure `STRIPE_WEBHOOK_SECRET` is correct
- Ensure raw body is preserved (check main.ts middleware)
- Check if request body is not parsed before verification

### Checkout session not created
- Verify `STRIPE_SECRET_KEY` is valid
- Check line items format (price must be in cents)
- Ensure success/cancel URLs are valid

### Events not received
- Check Stripe Dashboard > Webhooks > Events
- Verify webhook URL is accessible
- Check firewall/network settings
