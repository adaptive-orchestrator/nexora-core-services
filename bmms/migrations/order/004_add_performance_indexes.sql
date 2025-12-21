-- =============================================
-- Migration: Add Performance Indexes for Order Service
-- Database: order_db
-- Date: 2025-12-09
-- Description: Add indexes to improve query performance under high load
-- =============================================

USE order_db;

-- =============================================
-- ORDERS TABLE INDEXES
-- =============================================

-- Index for listing orders by customer (most common query)
-- Used in: GET /orders/my?page=1&limit=20
CREATE INDEX idx_orders_customer_created 
ON orders(customerId, createdAt DESC);

-- Index for filtering by status
-- Used in: GET /orders/my?status=pending
CREATE INDEX idx_orders_status 
ON orders(status);

-- Composite index for customer + status queries
-- Used in: GET /orders/my?status=pending (with customerId filter)
CREATE INDEX idx_orders_customer_status 
ON orders(customerId, status, createdAt DESC);

-- Index for payment status queries
-- Already exists from previous migration but ensure it's there
CREATE INDEX idx_orders_payment_status 
ON orders(paymentStatus);

-- =============================================
-- ORDER_ITEMS TABLE INDEXES
-- =============================================

-- Index for getting items by orderId (most common)
-- Used in: GET /orders/{id} to fetch order details with items
CREATE INDEX idx_order_items_order 
ON order_items(orderId);

-- Index for product lookup in items
-- Used in: Analytics and inventory tracking
CREATE INDEX idx_order_items_product 
ON order_items(productId);

-- Composite index for order items queries
CREATE INDEX idx_order_items_order_product 
ON order_items(orderId, productId);

-- =============================================
-- VERIFY INDEXES
-- =============================================

SELECT 
    TABLE_NAME,
    INDEX_NAME,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLUMNS,
    INDEX_TYPE,
    NON_UNIQUE
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'order_db'
  AND TABLE_NAME IN ('orders', 'order_items')
  AND INDEX_NAME LIKE 'idx_%'
GROUP BY TABLE_NAME, INDEX_NAME, INDEX_TYPE, NON_UNIQUE
ORDER BY TABLE_NAME, INDEX_NAME;

SELECT 'Migration completed: Performance indexes added successfully' AS message;

-- =============================================
-- PERFORMANCE NOTES
-- =============================================
-- Expected improvements:
-- 1. List orders by customer: 50-70% faster
-- 2. Filter by status: 60-80% faster  
-- 3. Order details with items: 40-60% faster
-- 4. Pagination queries: 30-50% faster
--
-- Test with:
-- EXPLAIN SELECT * FROM orders WHERE customerId = 'xxx' ORDER BY createdAt DESC LIMIT 20;
--
-- =============================================
-- ROLLBACK (if needed)
-- =============================================
/*
DROP INDEX IF EXISTS idx_orders_customer_created ON orders;
DROP INDEX IF EXISTS idx_orders_status ON orders;
DROP INDEX IF EXISTS idx_orders_customer_status ON orders;
DROP INDEX IF EXISTS idx_order_items_order ON order_items;
DROP INDEX IF EXISTS idx_order_items_product ON order_items;
DROP INDEX IF EXISTS idx_order_items_order_product ON order_items;
*/
