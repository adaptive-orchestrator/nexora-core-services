-- =============================================
-- Migration: Add payment_status to orders table
-- Database: order_db
-- Date: 2025-01-19
-- Description: Add payment status tracking and update order status enum
-- =============================================

USE order_db;

-- Check if paymentStatus column exists
SET @dbname = DATABASE();
SET @tablename = 'orders';

-- Add paymentStatus column if not exists
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE (table_name = @tablename)
       AND (table_schema = @dbname)
       AND (column_name = 'paymentStatus')) > 0,
    "SELECT 'Column paymentStatus already exists' AS msg",
    "ALTER TABLE orders ADD COLUMN paymentStatus ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending' AFTER status"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Update status column to include 'paid' and 'failed' if not already there
ALTER TABLE orders MODIFY COLUMN status 
ENUM('pending', 'confirmed', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'failed') 
DEFAULT 'pending';

-- Update existing paid orders
UPDATE orders 
SET paymentStatus = 'paid' 
WHERE status IN ('paid', 'delivered', 'shipped', 'processing');

-- Create index for faster payment status queries
CREATE INDEX IF NOT EXISTS idx_payment_status ON orders(paymentStatus);

-- Verify the changes
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    COLUMN_TYPE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'order_db'
  AND TABLE_NAME = 'orders'
  AND COLUMN_NAME IN ('status', 'paymentStatus');

SELECT 'Migration completed: paymentStatus column added to orders table' AS message;

-- =============================================
-- ROLLBACK (if needed)
-- =============================================
/*
ALTER TABLE orders DROP COLUMN paymentStatus;
ALTER TABLE orders MODIFY COLUMN status 
ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') 
DEFAULT 'pending';
*/
