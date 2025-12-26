-- =============================================
-- Master Migration Script
-- Date: 2025-12-04
-- Description: Run all migrations in correct order
-- Usage: mysql -u root -p < run_all_migrations.sql
-- =============================================

-- ============================================
-- 1. AUTH SERVICE MIGRATIONS (customer_db)
-- ============================================
USE customer_db;
SOURCE migrations/auth/000_create_users_table.sql;
SOURCE migrations/auth/001_add_business_model_and_seed_admin.sql;

-- ============================================
-- 2. CATALOGUE SERVICE MIGRATIONS (catalogue_db)
-- ============================================
USE catalogue_db;
SOURCE migrations/catalogue/001_add_trial_to_plans.sql;
SOURCE migrations/catalogue/002_create_plan_features_table.sql;
SOURCE migrations/catalogue/003_seed_sample_data.sql;
SOURCE migrations/catalogue/004_add_imageUrl_to_products.sql;

-- ============================================
-- 3. SUBSCRIPTION SERVICE MIGRATIONS (subscription_db)
-- ============================================
USE subscription_db;
SOURCE migrations/subscription/001_create_subscriptions_table.sql;
SOURCE migrations/subscription/002_create_subscription_history_table.sql;
SOURCE migrations/subscription/003_add_freemium_addons.sql;

-- ============================================
-- 4. BILLING SERVICE MIGRATIONS (billing_db)
-- ============================================
USE billing_db;
SOURCE migrations/billing/001_add_subscription_support_to_invoices.sql;
SOURCE migrations/billing/002_add_addon_metadata_column.sql;
SOURCE migrations/billing/003_make_productId_nullable.sql;

-- ============================================
-- 5. ORDER SERVICE MIGRATIONS (order_db)
-- ============================================
USE order_db;
SOURCE migrations/order/003_add_payment_status.sql;

-- ============================================
-- 6. PROMOTION SERVICE MIGRATIONS (promotion_db)
-- ============================================
USE promotion_db;
SOURCE migrations/promotion/001_create_promotions_table.sql;
SOURCE migrations/promotion/002_create_promotion_usage_table.sql;

-- ============================================
-- 7. PAYMENT SERVICE MIGRATIONS (payment_db)
-- ============================================
USE payment_db;
SOURCE migrations/payment/001_create_payment_retries.sql;

-- ============================================
-- SUMMARY
-- ============================================
SELECT '============================================' AS '';
SELECT 'ALL MIGRATIONS COMPLETED SUCCESSFULLY' AS status;
SELECT NOW() AS completed_at;
SELECT '============================================' AS '';
