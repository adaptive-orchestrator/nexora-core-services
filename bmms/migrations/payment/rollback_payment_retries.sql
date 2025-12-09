-- ==============================
-- PAYMENT RETRY ROLLBACK
-- Reverse Migration for 006_payment_retries.sql
-- ==============================

-- Backup data before dropping (optional but recommended)
-- CREATE TABLE payment_retries_backup AS SELECT * FROM payment_retries;

-- Drop the payment_retries table
DROP TABLE IF EXISTS payment_retries;

-- ==============================
-- VERIFICATION
-- ==============================

-- Verify table is dropped
SHOW TABLES LIKE 'payment_retries';

-- Should return empty result

-- ==============================
-- RESTORE FROM BACKUP (if needed)
-- ==============================

-- If you backed up data and need to restore:
-- RENAME TABLE payment_retries_backup TO payment_retries;

-- Or restore from backup file:
-- mysql -u root -p payment_db < payment_retries_backup.sql

-- ==============================
-- NOTES
-- ==============================

-- This rollback will:
-- 1. Drop the payment_retries table
-- 2. Remove all retry data
-- 3. Remove all indexes

-- WARNING: This action cannot be undone unless you have backups

-- To re-apply the migration:
-- mysql -u root -p payment_db < 006_payment_retries.sql
