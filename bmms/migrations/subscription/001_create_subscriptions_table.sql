-- =============================================
-- Migration: Create Subscriptions Table
-- Database: subscription_db
-- Date: 2025-12-04
-- Description: Create main subscriptions table matching subscription.entity.ts
-- =============================================

USE subscription_db;

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    customerId CHAR(36) NOT NULL,
    planId CHAR(36) NOT NULL,
    planName VARCHAR(255) NULL,
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    billingCycle ENUM('monthly', 'yearly') NOT NULL DEFAULT 'monthly',
    
    status ENUM('pending', 'trial', 'active', 'past_due', 'cancelled', 'expired') NOT NULL DEFAULT 'active',
    
    -- Billing period
    currentPeriodStart TIMESTAMP NOT NULL,
    currentPeriodEnd TIMESTAMP NOT NULL,
    
    -- Trial period tracking
    isTrialUsed BOOLEAN DEFAULT FALSE,
    trialStart TIMESTAMP NULL,
    trialEnd TIMESTAMP NULL,
    
    -- Cancellation tracking
    cancelAtPeriodEnd BOOLEAN DEFAULT FALSE,
    cancelledAt TIMESTAMP NULL,
    cancellationReason TEXT NULL,
    
    -- Metadata
    metadata JSON NULL,
    
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_customer (customerId),
    INDEX idx_plan (planId),
    INDEX idx_status (status),
    INDEX idx_period_end (currentPeriodEnd),
    INDEX idx_trial_end (trialEnd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify table creation
SELECT 'Subscriptions table created successfully' AS status;
DESCRIBE subscriptions;
