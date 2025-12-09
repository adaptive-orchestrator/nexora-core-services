-- Fix order_items index conflict
-- Run this in your MySQL client

USE order_db;

-- 1. Check current foreign keys
SHOW CREATE TABLE order_items;

-- 2. Drop the problematic index (nếu không cần)
-- Hoặc drop foreign key trước nếu index bị ràng buộc
-- Uncomment dòng này nếu cần:
-- ALTER TABLE order_items DROP FOREIGN KEY fk_order_items_order;
-- DROP INDEX idx_order_items_order_product ON order_items;

-- 3. Recreate foreign key without conflicting index name
-- ALTER TABLE order_items 
--   ADD CONSTRAINT fk_order_items_order 
--   FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE;

