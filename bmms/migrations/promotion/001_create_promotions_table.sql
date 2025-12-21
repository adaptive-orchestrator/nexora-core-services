-- =============================================
-- Migration: Create Promotions Table
-- Database: promotion_db
-- Date: 2025-01-26
-- Description: Create promotions table for discount codes
-- =============================================

USE promotion_db;

-- Create promotions table
CREATE TABLE IF NOT EXISTS promotions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    
    -- Promotion type and values
    type ENUM('percentage', 'fixed_amount', 'trial_extension', 'free_months') NOT NULL,
    status ENUM('active', 'inactive', 'expired') DEFAULT 'active',
    discountValue DECIMAL(10,2) NULL,
    trialExtensionDays INT NULL,
    freeMonths INT NULL,
    
    -- Applicability
    applicableTo ENUM('all_plans', 'specific_plans', 'first_time_only') DEFAULT 'all_plans',
    specificPlanIds TEXT NULL COMMENT 'Comma-separated plan IDs',
    
    -- Usage limits
    maxUses INT NULL COMMENT 'Total maximum uses (NULL = unlimited)',
    currentUses INT DEFAULT 0,
    maxUsesPerCustomer INT NULL COMMENT 'Per-customer limit',
    
    -- Validity period
    validFrom TIMESTAMP NULL,
    validUntil TIMESTAMP NULL,
    
    -- Conditions
    minPurchaseAmount DECIMAL(10,2) NULL,
    isFirstTimeOnly BOOLEAN DEFAULT FALSE,
    isRecurring BOOLEAN DEFAULT FALSE COMMENT 'Apply to renewals or just first payment',
    
    -- Metadata
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_code (code),
    INDEX idx_status (status),
    INDEX idx_type (type),
    INDEX idx_valid_from (validFrom),
    INDEX idx_valid_until (validUntil)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add comment
ALTER TABLE promotions 
    COMMENT = 'Promotions and discount codes for subscription system';

-- Verify table creation
SELECT 
    'Promotions table created successfully' AS status,
    COUNT(*) AS row_count 
FROM promotions;
