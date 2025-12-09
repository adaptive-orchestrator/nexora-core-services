-- =============================================
-- Migration: Create Subscription History Table
-- Database: subscription_db
-- Date: 2025-12-04
-- Description: Audit trail matching subscription-history.entity.ts
-- =============================================

USE subscription_db;

-- Create subscription_history table
CREATE TABLE IF NOT EXISTS subscription_history (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    subscriptionId CHAR(36) NOT NULL,
    action VARCHAR(100) NOT NULL,
    previousStatus VARCHAR(50) NULL,
    newStatus VARCHAR(50) NULL,
    previousPlanId CHAR(36) NULL,
    newPlanId CHAR(36) NULL,
    details TEXT NULL,
    metadata JSON NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (subscriptionId) REFERENCES subscriptions(id) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Indexes
    INDEX idx_subscription (subscriptionId),
    INDEX idx_action (action),
    INDEX idx_created_at (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify table creation
SELECT 'Subscription history table created successfully' AS status;
DESCRIBE subscription_history;
