-- Quick fix: Add ownerId column to subscriptions table
ALTER TABLE subscriptions ADD COLUMN ownerId VARCHAR(36) NULL AFTER customerId;
CREATE INDEX idx_subscriptions_owner ON subscriptions(ownerId);
UPDATE subscriptions SET ownerId = customerId WHERE ownerId IS NULL;
