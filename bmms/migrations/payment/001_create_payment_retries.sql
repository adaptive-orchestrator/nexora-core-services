-- ==============================
-- PAYMENT RETRY MIGRATION
-- Forward Migration
-- ==============================

USE payment_db;

-- Create payment_retries table
CREATE TABLE IF NOT EXISTS payment_retries (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  
  -- Payment identifiers
  paymentId CHAR(36) NOT NULL COMMENT 'Reference to payment record',
  invoiceId CHAR(36) NOT NULL COMMENT 'Invoice being paid',
  subscriptionId CHAR(36) NOT NULL COMMENT 'Related subscription',
  
  -- Retry tracking
  attemptNumber INT NOT NULL DEFAULT 0 COMMENT 'Current attempt number (0-based)',
  maxAttempts INT NOT NULL DEFAULT 7 COMMENT 'Maximum retry attempts',
  
  -- Status tracking
  status ENUM('pending', 'retrying', 'succeeded', 'exhausted', 'cancelled') 
    NOT NULL DEFAULT 'pending' 
    COMMENT 'Current retry status',
  
  -- Timing information
  firstFailureAt DATETIME NOT NULL COMMENT 'When payment first failed',
  lastRetryAt DATETIME NULL COMMENT 'When last retry was attempted',
  nextRetryAt DATETIME NULL COMMENT 'When next retry should occur',
  succeededAt DATETIME NULL COMMENT 'When payment finally succeeded',
  
  -- Error tracking
  failureReason TEXT NOT NULL COMMENT 'Original failure reason',
  lastError TEXT NULL COMMENT 'Error from last retry attempt',
  
  -- History and metadata
  retryHistory JSON NULL COMMENT 'Array of retry attempts with details',
  metadata JSON NULL COMMENT 'Additional metadata (notifications, failure type, etc)',
  
  -- Standard timestamps
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  INDEX idx_payment_invoice (paymentId, invoiceId),
  INDEX idx_subscription (subscriptionId),
  INDEX idx_next_retry (nextRetryAt),
  INDEX idx_status (status),
  INDEX idx_created (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tracks automatic payment retry attempts with exponential backoff';

-- Sample retry history JSON structure:
-- [
--   {
--     "attemptNumber": 1,
--     "attemptedAt": "2025-01-15T10:00:00Z",
--     "success": false,
--     "error": "Insufficient funds",
--     "delayMs": 3600000
--   },
--   {
--     "attemptNumber": 2,
--     "attemptedAt": "2025-01-15T11:00:00Z",
--     "success": true,
--     "delayMs": 7200000
--   }
-- ]

-- Sample metadata JSON structure:
-- {
--   "failureType": "temporary",
--   "retryable": true,
--   "customerNotified": true,
--   "notificationsSent": 2
-- }

-- ==============================
-- VERIFICATION QUERIES
-- ==============================

-- Check table structure
DESCRIBE payment_retries;

-- Verify indexes
SHOW INDEX FROM payment_retries;

-- Initial data check
SELECT COUNT(*) as total_retries FROM payment_retries;

-- ==============================
-- SAMPLE DATA (For Testing)
-- ==============================

-- Insert sample retry record
INSERT INTO payment_retries (
  paymentId,
  invoiceId,
  subscriptionId,
  attemptNumber,
  maxAttempts,
  status,
  firstFailureAt,
  nextRetryAt,
  failureReason,
  retryHistory,
  metadata
) VALUES (
  UUID(),
  UUID(),
  UUID(),
  0,
  7,
  'pending',
  NOW(),
  DATE_ADD(NOW(), INTERVAL 1 HOUR),
  'Insufficient funds',
  JSON_ARRAY(),
  JSON_OBJECT(
    'failureType', 'temporary',
    'retryable', true,
    'customerNotified', false,
    'notificationsSent', 0
  )
);

-- Verify sample data
SELECT * FROM payment_retries;

-- ==============================
-- USEFUL QUERIES
-- ==============================

-- Get all pending retries that are due
SELECT * FROM payment_retries 
WHERE status = 'pending' 
  AND nextRetryAt <= NOW()
ORDER BY nextRetryAt ASC;

-- Get retry statistics
SELECT 
  status,
  COUNT(*) as count,
  AVG(attemptNumber) as avg_attempts
FROM payment_retries
GROUP BY status;

-- Get retries for a specific subscription
SELECT * FROM payment_retries 
WHERE subscriptionId = 200
ORDER BY createdAt DESC;

-- Get failed retries that need attention
SELECT * FROM payment_retries 
WHERE status = 'exhausted' 
  AND createdAt > DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY createdAt DESC;

-- Get success rate
SELECT 
  COUNT(CASE WHEN status = 'succeeded' THEN 1 END) * 100.0 / COUNT(*) as success_rate_percent,
  COUNT(*) as total_retries,
  COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as succeeded,
  COUNT(CASE WHEN status = 'exhausted' THEN 1 END) as exhausted,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
FROM payment_retries;

-- Get retries by attempt number
SELECT 
  attemptNumber,
  COUNT(*) as count,
  COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as succeeded_at_this_attempt
FROM payment_retries
GROUP BY attemptNumber
ORDER BY attemptNumber;

-- ==============================
-- MAINTENANCE QUERIES
-- ==============================

-- Clean up old succeeded retries (older than 90 days)
DELETE FROM payment_retries 
WHERE status IN ('succeeded', 'cancelled') 
  AND createdAt < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- Clean up old exhausted retries (older than 180 days)
DELETE FROM payment_retries 
WHERE status = 'exhausted' 
  AND createdAt < DATE_SUB(NOW(), INTERVAL 180 DAY);

-- Reset stuck retries (retrying for more than 1 hour)
UPDATE payment_retries 
SET status = 'pending' 
WHERE status = 'retrying' 
  AND updatedAt < DATE_SUB(NOW(), INTERVAL 1 HOUR);

-- ==============================
-- MONITORING QUERIES
-- ==============================

-- Get retry performance over last 7 days
SELECT 
  DATE(createdAt) as date,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as succeeded,
  COUNT(CASE WHEN status = 'exhausted' THEN 1 END) as failed,
  ROUND(COUNT(CASE WHEN status = 'succeeded' THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate
FROM payment_retries
WHERE createdAt > DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(createdAt)
ORDER BY date DESC;

-- Get average time to success
SELECT 
  AVG(TIMESTAMPDIFF(SECOND, firstFailureAt, succeededAt)) / 3600 as avg_hours_to_success,
  MIN(TIMESTAMPDIFF(SECOND, firstFailureAt, succeededAt)) / 3600 as min_hours_to_success,
  MAX(TIMESTAMPDIFF(SECOND, firstFailureAt, succeededAt)) / 3600 as max_hours_to_success
FROM payment_retries
WHERE status = 'succeeded' 
  AND succeededAt IS NOT NULL;

-- Get most common failure reasons
SELECT 
  failureReason,
  COUNT(*) as count,
  COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as eventually_succeeded,
  ROUND(COUNT(CASE WHEN status = 'succeeded' THEN 1 END) * 100.0 / COUNT(*), 2) as recovery_rate
FROM payment_retries
GROUP BY failureReason
ORDER BY count DESC
LIMIT 10;

-- ==============================
-- NOTES
-- ==============================

-- Retry Schedule (exponential backoff):
-- Attempt 1: 1 hour after failure
-- Attempt 2: 2 hours after attempt 1 (3 hours total)
-- Attempt 3: 4 hours after attempt 2 (7 hours total)
-- Attempt 4: 8 hours after attempt 3 (15 hours total)
-- Attempt 5: 1 day after attempt 4 (~1.6 days total)
-- Attempt 6: 2 days after attempt 5 (~3.6 days total)
-- Attempt 7: 3 days after attempt 6 (~6.6 days total)
--
-- Grace Period: 15 days (subscription remains active)
--
-- Status Flow:
-- pending -> retrying -> succeeded (success)
-- pending -> retrying -> pending (failure, will retry)
-- pending -> retrying -> exhausted (max attempts reached)
-- pending/retrying -> cancelled (manually cancelled)
