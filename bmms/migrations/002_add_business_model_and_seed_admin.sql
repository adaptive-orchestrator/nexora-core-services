-- Migration: Add businessModel column to users table
-- Date: 2025-01-05

-- Add businessModel column to users table
ALTER TABLE `users` 
ADD COLUMN `businessModel` ENUM('retail', 'subscription', 'freemium') NULL 
COMMENT 'Business model preference (only for ADMIN users)' 
AFTER `role`;

-- Seed demo admin account for testing
-- Password: Admin@123 (hashed with bcrypt, 10 rounds)
INSERT INTO `users` (`email`, `password`, `name`, `role`, `businessModel`) 
VALUES 
  (
    'admin@demo.com', 
    '$2b$10$rBV2CcUjr2gYcwLqT7lHde7YqrN2p/VXHHXOCZWJjVLVUV3SoSWvO', 
    'Demo Admin', 
    'admin', 
    'retail'
  )
ON DUPLICATE KEY UPDATE 
  `password` = '$2b$10$rBV2CcUjr2gYcwLqT7lHde7YqrN2p/VXHHXOCZWJjVLVUV3SoSWvO',
  `name` = 'Demo Admin',
  `role` = 'admin',
  `businessModel` = 'retail';

-- Seed demo customer account for testing
-- Password: Customer@123 (hashed with bcrypt, 10 rounds)
INSERT INTO `users` (`email`, `password`, `name`, `role`, `businessModel`) 
VALUES 
  (
    'customer@demo.com', 
    '$2b$10$zH8Yd5qFm2jGxPjKHXjF0eJ2Y3VqJ5N9QUX8WGjF1VL2V3WoSXvPQ', 
    'Demo Customer', 
    'user', 
    NULL
  )
ON DUPLICATE KEY UPDATE 
  `password` = '$2b$10$zH8Yd5qFm2jGxPjKHXjF0eJ2Y3VqJ5N9QUX8WGjF1VL2V3WoSXvPQ',
  `name` = 'Demo Customer',
  `role` = 'user',
  `businessModel` = NULL;

-- Verify
SELECT id, email, name, role, businessModel FROM users WHERE email IN ('admin@demo.com', 'customer@demo.com');
