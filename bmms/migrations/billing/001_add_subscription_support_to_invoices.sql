-- =============================================
-- Migration: Update Invoices Table for Subscriptions
-- Database: billing_db
-- Date: 2025-01-26
-- Description: Add subscription support to invoices
-- =============================================

USE billing_db;

-- Check if columns already exist
SET @dbname = DATABASE();
SET @tablename = 'invoices';

-- Add invoiceType column if not exists
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE (table_name = @tablename)
       AND (table_schema = @dbname)
       AND (column_name = 'invoiceType')) > 0,
    "SELECT 'Column invoiceType already exists' AS msg",
    "ALTER TABLE invoices ADD COLUMN invoiceType ENUM('onetime', 'recurring') DEFAULT 'onetime' AFTER status"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add subscriptionId column if not exists
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE (table_name = @tablename)
       AND (table_schema = @dbname)
       AND (column_name = 'subscriptionId')) > 0,
    "SELECT 'Column subscriptionId already exists' AS msg",
    "ALTER TABLE invoices ADD COLUMN subscriptionId CHAR(36) NULL AFTER invoiceType"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add periodStart column if not exists
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE (table_name = @tablename)
       AND (table_schema = @dbname)
       AND (column_name = 'periodStart')) > 0,
    "SELECT 'Column periodStart already exists' AS msg",
    "ALTER TABLE invoices ADD COLUMN periodStart TIMESTAMP NULL AFTER subscriptionId"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add periodEnd column if not exists
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE (table_name = @tablename)
       AND (table_schema = @dbname)
       AND (column_name = 'periodEnd')) > 0,
    "SELECT 'Column periodEnd already exists' AS msg",
    "ALTER TABLE invoices ADD COLUMN periodEnd TIMESTAMP NULL AFTER periodStart"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add index for subscriptionId
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE (table_name = @tablename)
       AND (table_schema = @dbname)
       AND (index_name = 'idx_subscription')) > 0,
    "SELECT 'Index idx_subscription already exists' AS msg",
    "CREATE INDEX idx_subscription ON invoices(subscriptionId)"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add index for invoiceType
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE (table_name = @tablename)
       AND (table_schema = @dbname)
       AND (index_name = 'idx_invoice_type')) > 0,
    "SELECT 'Index idx_invoice_type already exists' AS msg",
    "CREATE INDEX idx_invoice_type ON invoices(invoiceType)"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Update comment
ALTER TABLE invoices 
    COMMENT = 'Invoices table supporting both onetime (retail) and recurring (subscription) models';

-- Verify changes
SELECT 
    'Invoices table updated successfully' AS status,
    COUNT(*) AS total_invoices,
    SUM(CASE WHEN invoiceType = 'recurring' THEN 1 ELSE 0 END) AS recurring_invoices,
    SUM(CASE WHEN invoiceType = 'onetime' THEN 1 ELSE 0 END) AS onetime_invoices
FROM invoices;
