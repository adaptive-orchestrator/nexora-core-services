-- Migration: Make productId nullable in invoice_items table
-- Reason: Recurring invoices (subscriptions) don't have productId

USE billing_db;

-- Make productId nullable (safe to run multiple times)
ALTER TABLE invoice_items 
MODIFY COLUMN productId INT NULL;

-- Add index for better query performance (if not exists)
SET @dbname = DATABASE();
SET @tablename = 'invoice_items';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE (table_name = @tablename)
       AND (table_schema = @dbname)
       AND (index_name = 'idx_invoice_items_productId')) > 0,
    "SELECT 'Index idx_invoice_items_productId already exists' AS msg",
    "CREATE INDEX idx_invoice_items_productId ON invoice_items(productId)"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
