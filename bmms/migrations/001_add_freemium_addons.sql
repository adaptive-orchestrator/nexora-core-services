-- Migration: Add Freemium + Add-on Support (SUBSCRIPTION DATABASE)
-- Date: 2025-01-15
-- Description: Create tables for add-ons và user add-on purchases
-- Database: subscription_db ONLY
-- Note: Run billing migration separately for invoices.metadata column

-- =============================================
-- 1. CREATE ADDONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS addons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  addon_key VARCHAR(100) UNIQUE NOT NULL COMMENT 'Unique identifier: extra_storage, ai_assistant, etc.',
  name VARCHAR(255) NOT NULL COMMENT 'Display name',
  description TEXT COMMENT 'Feature description',
  price DECIMAL(10, 2) NOT NULL COMMENT 'Price in VND',
  billing_period ENUM('monthly', 'yearly', 'onetime') DEFAULT 'monthly',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Whether addon is available for purchase',
  features JSON COMMENT 'Metadata about features: {storage_gb: 100, ai_enabled: true}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_addon_key (addon_key),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Add-on catalog for freemium users';

-- =============================================
-- 2. CREATE USER_ADDONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS user_addons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  subscription_id INT NOT NULL COMMENT 'Reference to subscriptions table',
  addon_id INT NOT NULL COMMENT 'Reference to addons table',
  customer_id INT NOT NULL COMMENT 'Reference to customers table',
  price DECIMAL(10, 2) NOT NULL COMMENT 'Price at time of purchase (locked)',
  status ENUM('active', 'cancelled', 'expired') DEFAULT 'active',
  purchased_at TIMESTAMP NOT NULL COMMENT 'When user purchased this addon',
  expires_at TIMESTAMP NULL COMMENT 'Expiry date for recurring addons',
  next_billing_date TIMESTAMP NULL COMMENT 'Next auto-renewal date',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_subscription_id (subscription_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_addon_id (addon_id),
  INDEX idx_status (status),
  INDEX idx_next_billing_date (next_billing_date),
  UNIQUE KEY unique_subscription_addon (subscription_id, addon_id, status),
  FOREIGN KEY (addon_id) REFERENCES addons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User addon purchases and renewals';

-- =============================================
-- 3. UPDATE SUBSCRIPTIONS TABLE (add freemium support)
-- =============================================

-- Add is_free_tier column if not exists
SET @dbname = 'subscription_db';
SET @tablename = 'subscriptions';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE (table_name = @tablename)
       AND (table_schema = @dbname)
       AND (column_name = 'is_free_tier')) > 0,
    "SELECT 'Column is_free_tier already exists' AS msg",
    "ALTER TABLE subscriptions ADD COLUMN is_free_tier BOOLEAN DEFAULT FALSE COMMENT 'Whether this is a free tier subscription' AFTER status"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- =============================================
-- 4. SEED SAMPLE ADDONS
-- =============================================

INSERT IGNORE INTO addons (addon_key, name, description, price, billingPeriod, features) VALUES
('extra_storage_50gb', 'Extra 50GB Storage', 'Tăng dung lượng lưu trữ từ 10GB lên 60GB', 30000, 'monthly', '{"storage_gb": 50}'),
('extra_storage_100gb', 'Extra 100GB Storage', 'Tăng dung lượng lưu trữ từ 10GB lên 110GB', 50000, 'monthly', '{"storage_gb": 100}'),
('extra_storage_500gb', 'Extra 500GB Storage', 'Tăng dung lượng lưu trữ từ 10GB lên 510GB', 200000, 'monthly', '{"storage_gb": 500}'),
('ai_assistant', 'AI Assistant Pro', 'Trợ lý AI thông minh, hỗ trợ 24/7, không giới hạn requests', 100000, 'monthly', '{"ai_enabled": true, "requests_per_day": -1, "priority": "high"}'),
('ai_assistant_basic', 'AI Assistant Basic', 'Trợ lý AI cơ bản, 100 requests/ngày', 50000, 'monthly', '{"ai_enabled": true, "requests_per_day": 100, "priority": "normal"}'),
('priority_support', 'Priority Support', 'Hỗ trợ ưu tiên qua email/chat, phản hồi trong 1 giờ', 30000, 'monthly', '{"priority_level": 1, "response_time_hours": 1}'),
('custom_domain', 'Custom Domain', 'Sử dụng tên miền riêng cho ứng dụng của bạn', 20000, 'monthly', '{"custom_domain": true, "ssl_included": true}'),
('api_access', 'API Access', 'Truy cập API với rate limit cao hơn (10,000 requests/giờ)', 150000, 'monthly', '{"api_enabled": true, "rate_limit_per_hour": 10000}'),
('team_collaboration', 'Team Collaboration', 'Làm việc nhóm với tối đa 10 thành viên', 80000, 'monthly', '{"max_team_members": 10, "shared_workspace": true}'),
('white_label', 'White Label', 'Loại bỏ branding của hệ thống, sử dụng brand riêng', 300000, 'onetime', '{"remove_branding": true, "custom_logo": true}');

-- =============================================
-- 5. CREATE INDEX FOR PERFORMANCE
-- =============================================

-- Speed up queries for active addons (skip if already exists)
-- CREATE INDEX idx_active_monthly_addons ON addons(isActive, billingPeriod);

-- Speed up renewal queries (skip if already exists)
-- CREATE INDEX idx_renewal_lookup ON user_addons(status, next_billing_date);

-- =============================================
-- 7. VERIFICATION QUERIES
-- =============================================

-- Check addons created
SELECT COUNT(*) as total_addons, 
       SUM(CASE WHEN isActive = TRUE THEN 1 ELSE 0 END) as active_addons,
       SUM(CASE WHEN billingPeriod = 'monthly' THEN 1 ELSE 0 END) as monthly_addons
FROM addons;

-- Check tables structure
SHOW CREATE TABLE addons;
SHOW CREATE TABLE user_addons;

-- Check indexes
SHOW INDEX FROM addons;
SHOW INDEX FROM user_addons;

-- =============================================
-- ROLLBACK (if needed)
-- =============================================

/*
DROP TABLE IF EXISTS user_addons;
DROP TABLE IF EXISTS addons;
ALTER TABLE subscriptions DROP COLUMN is_free_tier;
*/
