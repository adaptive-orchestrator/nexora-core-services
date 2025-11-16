-- =============================================
-- Migration: Add metadata column to invoices for addon billing
-- Database: billing_db
-- Date: 2025-01-15
-- Description: Add JSON metadata column to store addon charges and billing info
-- =============================================

USE billing_db;

-- Check if column already exists
SET @dbname = DATABASE();
SET @tablename = 'invoices';

-- Add metadata column if not exists
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE (table_name = @tablename)
       AND (table_schema = @dbname)
       AND (column_name = 'metadata')) > 0,
    "SELECT 'Column metadata already exists' AS msg",
    "ALTER TABLE invoices ADD COLUMN metadata JSON COMMENT 'Billing metadata: {billingMode, businessModel, addonCharges, nextBillingDate}' AFTER notes"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Verify the change
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'billing_db'
  AND TABLE_NAME = 'invoices'
  AND COLUMN_NAME = 'metadata';

-- =============================================
-- ROLLBACK (if needed)
-- =============================================

/*
ALTER TABLE invoices DROP COLUMN metadata;
*/
