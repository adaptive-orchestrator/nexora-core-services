-- Migration: Add Stripe fields to subscriptions table
-- Run this migration to add Stripe integration fields

-- Add stripeSubscriptionId column
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255) NULL;

-- Add stripeCustomerId column  
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) NULL;

-- Create index for faster lookups by Stripe IDs
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id 
ON subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id 
ON subscriptions(stripe_customer_id);

-- Add comment for documentation
COMMENT ON COLUMN subscriptions.stripe_subscription_id IS 'Stripe subscription ID for syncing with Stripe';
COMMENT ON COLUMN subscriptions.stripe_customer_id IS 'Stripe customer ID for payment integration';
