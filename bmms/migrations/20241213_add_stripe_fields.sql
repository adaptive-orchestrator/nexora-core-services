-- Migration: Add Stripe fields to payments table
-- Date: 2024-12-13
-- Description: Add Stripe-specific fields for payment integration

-- Add new columns for Stripe integration
ALTER TABLE payments 
ADD COLUMN order_id VARCHAR(36),
ADD COLUMN currency VARCHAR(10) DEFAULT 'VND',
ADD COLUMN provider VARCHAR(50) DEFAULT 'manual',
ADD COLUMN stripe_payment_intent_id VARCHAR(255),
ADD COLUMN stripe_session_id VARCHAR(255),
ADD COLUMN stripe_customer_id VARCHAR(255),
ADD COLUMN stripe_subscription_id VARCHAR(255),
ADD COLUMN stripe_refund_id VARCHAR(255),
ADD COLUMN refunded_amount DECIMAL(12, 2),
ADD COLUMN refunded_at TIMESTAMP NULL,
ADD COLUMN metadata JSON;

-- Create indexes for Stripe fields
CREATE INDEX idx_payments_stripe_payment_intent 
ON payments(stripe_payment_intent_id);

CREATE INDEX idx_payments_stripe_session 
ON payments(stripe_session_id);

CREATE INDEX idx_payments_order 
ON payments(order_id);

-- Update status enum to include new values (MySQL)
-- Note: In MySQL, if status is ENUM, you need to modify the column
-- If your payments table uses VARCHAR for status, you can skip this
-- Example for ENUM (uncomment if needed):
-- ALTER TABLE payments MODIFY COLUMN status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded');

-- Create stripe_webhook_events table for idempotency tracking
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    stripe_object_id VARCHAR(255),
    order_id VARCHAR(36),
    customer_id VARCHAR(36),
    payment_id VARCHAR(36),
    error_message TEXT,
    event_data JSON,
    processed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create indexes for stripe_webhook_events
CREATE INDEX idx_stripe_webhook_events_stripe_event 
ON stripe_webhook_events(stripe_event_id);

CREATE INDEX idx_stripe_webhook_events_event_type 
ON stripe_webhook_events(event_type);

CREATE INDEX idx_stripe_webhook_events_status 
ON stripe_webhook_events(status);

CREATE INDEX idx_stripe_webhook_events_order 
ON stripe_webhook_events(order_id);

CREATE INDEX idx_stripe_webhook_events_created 
ON stripe_webhook_events(created_at);

-- MySQL doesn't need separate enum type creation, use column definition directly if needed
-- Example: provider ENUM('stripe', 'vnpay', 'momo', 'manual') DEFAULT 'manual'

-- Comments for documentation (MySQL style)
-- Table: stripe_webhook_events - Tracks Stripe webhook events for idempotency and debugging
-- Column: payments.stripe_payment_intent_id - Stripe Payment Intent ID (pi_xxx)
-- Column: payments.stripe_session_id - Stripe Checkout Session ID (cs_xxx)
-- Column: payments.stripe_customer_id - Stripe Customer ID (cus_xxx)
