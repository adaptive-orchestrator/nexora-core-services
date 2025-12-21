-- Migration: Create users table
-- Date: 2025-12-14
-- Database: customer_db (auth-svc uses customer_db)
-- Description: Initial schema for users table

USE customer_db;

-- Create users table
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(36) PRIMARY KEY COMMENT 'UUID',
  `email` VARCHAR(255) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL DEFAULT '',
  `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  `resetToken` VARCHAR(255) NULL,
  `resetTokenExpires` DATETIME NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_email` (`email`),
  INDEX `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify table creation
SHOW TABLES LIKE 'users';
DESCRIBE users;
