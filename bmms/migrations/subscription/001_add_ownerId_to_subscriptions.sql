-- Add ownerId column to subscriptions table
-- Migration: 001_add_ownerId_to_subscriptions
-- Date: 2025-12-09

USE subscription_db;

-- Add ownerId column (nullable for existing records)
ALTER TABLE subscriptions 
ADD COLUMN ownerId VARCHAR(36) NULL AFTER customerId;

-- Create index for performance
CREATE INDEX idx_subscriptions_owner ON subscriptions(ownerId);

-- Update existing records: set ownerId = customerId for data consistency
UPDATE subscriptions 
SET ownerId = customerId 
WHERE ownerId IS NULL;

-- Optionally make it NOT NULL after data migration
-- ALTER TABLE subscriptions MODIFY COLUMN ownerId VARCHAR(36) NOT NULL;

-- Verify the change
SELECT 
    COUNT(*) as total_subscriptions,
    COUNT(ownerId) as with_ownerId,
    COUNT(*) - COUNT(ownerId) as without_ownerId
FROM subscriptions;
