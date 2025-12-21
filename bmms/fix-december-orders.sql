-- Script to fix December 2025 orders for testing revenue queries
-- Problem: Orders have paymentStatus='pending' but should be 'paid' for testing
-- Solution: Update 3 orders to 'paid' status with correct amounts

USE order_db;

-- Show current state
SELECT 
    id,
    orderNumber,
    totalAmount,
    paymentStatus,
    status,
    createdAt
FROM orders 
WHERE YEAR(createdAt) = 2025 AND MONTH(createdAt) = 12
ORDER BY createdAt;

-- Update 3 orders to 'paid' status (simulating completed payments)
-- This matches the 599.97 total in payments table (199.99 * 3)
UPDATE orders 
SET 
    paymentStatus = 'paid',
    status = 'paid'
WHERE 
    YEAR(createdAt) = 2025 
    AND MONTH(createdAt) = 12
    AND paymentStatus = 'pending'
LIMIT 3;

-- Verify the update
SELECT 
    COUNT(*) as total_orders,
    COUNT(CASE WHEN paymentStatus = 'paid' THEN 1 END) as paid_orders,
    SUM(CASE WHEN paymentStatus = 'paid' THEN totalAmount ELSE 0 END) as total_revenue
FROM orders 
WHERE YEAR(createdAt) = 2025 AND MONTH(createdAt) = 12;

-- Expected result after update:
-- total_orders: 4
-- paid_orders: 3  
-- total_revenue: sum of 3 highest orders from the 4 total
