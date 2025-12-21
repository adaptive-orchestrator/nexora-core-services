-- =============================================
-- Migration: Create Promotion Usage Table
-- Database: promotion_db
-- Date: 2025-01-26
-- Description: Track promotion code usage history
-- =============================================

USE promotion_db;

-- Create promotion_usage table
CREATE TABLE IF NOT EXISTS promotion_usage (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    promotionId CHAR(36) NOT NULL,
    customerId CHAR(36) NOT NULL,
    subscriptionId CHAR(36) NULL,
    
    -- Discount details
    discountAmount DECIMAL(10,2) NULL,
    originalAmount DECIMAL(10,2) NULL,
    finalAmount DECIMAL(10,2) NULL,
    
    -- Metadata
    metadata TEXT NULL COMMENT 'JSON string with additional info',
    usedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (promotionId) REFERENCES promotions(id) 
        ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_promotion (promotionId),
    INDEX idx_customer (customerId),
    INDEX idx_subscription (subscriptionId),
    INDEX idx_used_at (usedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add comment
ALTER TABLE promotion_usage 
    COMMENT = 'Usage history for promotion codes';

-- Verify table creation
SELECT 
    'Promotion usage table created successfully' AS status,
    COUNT(*) AS row_count 
FROM promotion_usage;
