-- Migration: Add Freemium + Add-on Support (SUBSCRIPTION DATABASE)
-- Date: 2025-12-04
-- Description: Create tables for add-ons matching addon.entity.ts & user-addon.entity.ts
-- Database: subscription_db ONLY

USE subscription_db;

-- =============================================
-- 1. CREATE ADDONS TABLE (matching addon.entity.ts)
-- =============================================

CREATE TABLE IF NOT EXISTS addons (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  addon_key VARCHAR(100) UNIQUE NOT NULL COMMENT 'Unique identifier: extra_storage, ai_assistant, etc.',
  name VARCHAR(255) NOT NULL COMMENT 'Display name',
  description TEXT COMMENT 'Feature description',
  price DECIMAL(10, 2) NOT NULL COMMENT 'Price in VND',
  billingPeriod ENUM('monthly', 'yearly', 'onetime') DEFAULT 'monthly',
  isActive BOOLEAN DEFAULT TRUE COMMENT 'Whether addon is available for purchase',
  features JSON COMMENT 'Metadata about features',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_addon_key (addon_key),
  INDEX idx_addon_active (isActive),
  INDEX idx_addon_key_active (addon_key, isActive)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Add-on catalog for freemium users';

-- =============================================
-- 2. CREATE USER_ADDONS TABLE (matching user-addon.entity.ts)
-- =============================================

CREATE TABLE IF NOT EXISTS user_addons (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  subscription_id CHAR(36) NOT NULL COMMENT 'Reference to subscriptions table',
  addon_id CHAR(36) NOT NULL COMMENT 'Reference to addons table',
  customer_id CHAR(36) NOT NULL COMMENT 'Reference to customers table',
  price DECIMAL(10, 2) NOT NULL COMMENT 'Price at time of purchase (locked)',
  status ENUM('active', 'cancelled', 'expired') DEFAULT 'active',
  purchased_at TIMESTAMP NOT NULL COMMENT 'When user purchased this addon',
  expires_at TIMESTAMP NULL COMMENT 'Expiry date for recurring addons',
  next_billing_date TIMESTAMP NULL COMMENT 'Next auto-renewal date',
  cancelled_at TIMESTAMP NULL COMMENT 'When addon was cancelled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_subscription_id (subscription_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_addon_id (addon_id),
  INDEX idx_status (status),
  INDEX idx_user_addon_sub_status (subscription_id, status),
  INDEX idx_user_addon_addon_status (addon_id, status),
  INDEX idx_user_addon_billing (next_billing_date, status),
  FOREIGN KEY (addon_id) REFERENCES addons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User addon purchases and renewals';

-- =============================================
-- 3. SEED SAMPLE ADDONS
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
-- 4. VERIFICATION
-- =============================================

SELECT 'Addons table created' AS status;
DESCRIBE addons;
DESCRIBE user_addons;
