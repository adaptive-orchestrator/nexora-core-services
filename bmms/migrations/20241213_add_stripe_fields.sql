-- Migration: Add Stripe fields to payments table
-- Date: 2024-12-13
-- Description: Add Stripe-specific fields for payment integration

-- Add new columns for Stripe integration
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS order_id UUID,
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'VND',
ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_refund_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS refunded_amount DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS metadata JSON;

-- Create indexes for Stripe fields
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent 
ON payments(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_payments_stripe_session 
ON payments(stripe_session_id);

CREATE INDEX IF NOT EXISTS idx_payments_order 
ON payments(order_id);

-- Update status enum to include new values
-- Note: In PostgreSQL, you need to add new enum values
DO $$ 
BEGIN
    -- Check if type exists and add new values
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payments_status_enum') THEN
        -- Add new enum values if they don't exist
        BEGIN
            ALTER TYPE payments_status_enum ADD VALUE IF NOT EXISTS 'refunded';
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
        BEGIN
            ALTER TYPE payments_status_enum ADD VALUE IF NOT EXISTS 'partially_refunded';
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    END IF;
END $$;

-- Create stripe_webhook_events table for idempotency tracking
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    stripe_object_id VARCHAR(255),
    order_id UUID,
    customer_id UUID,
    payment_id UUID,
    error_message TEXT,
    event_data JSON,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for stripe_webhook_events
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_stripe_event 
ON stripe_webhook_events(stripe_event_id);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_type 
ON stripe_webhook_events(event_type);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status 
ON stripe_webhook_events(status);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_order 
ON stripe_webhook_events(order_id);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created 
ON stripe_webhook_events(created_at);

-- Add provider enum type if using enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payments_provider_enum') THEN
        CREATE TYPE payments_provider_enum AS ENUM ('stripe', 'vnpay', 'momo', 'manual');
    END IF;
END $$;

-- Comment for documentation
COMMENT ON TABLE stripe_webhook_events IS 'Tracks Stripe webhook events for idempotency and debugging';
COMMENT ON COLUMN payments.stripe_payment_intent_id IS 'Stripe Payment Intent ID (pi_xxx)';
COMMENT ON COLUMN payments.stripe_session_id IS 'Stripe Checkout Session ID (cs_xxx)';
COMMENT ON COLUMN payments.stripe_customer_id IS 'Stripe Customer ID (cus_xxx)';
