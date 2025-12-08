-- Sample data for catalogue_db

USE catalogue_db;

-- Sample features (using fixed UUIDs for reference)
INSERT INTO features (id, name, description, code, createdAt, updatedAt) VALUES
  ('f0000001-0000-0000-0000-000000000001', 'Task Management', 'Create and manage unlimited tasks', 'FEAT001', NOW(), NOW()),
  ('f0000001-0000-0000-0000-000000000002', 'Team Collaboration', 'Share tasks with team members', 'FEAT002', NOW(), NOW()),
  ('f0000001-0000-0000-0000-000000000003', 'Advanced Analytics', 'Detailed insights and reports', 'FEAT003', NOW(), NOW()),
  ('f0000001-0000-0000-0000-000000000004', 'Priority Support', '24/7 priority customer support', 'FEAT004', NOW(), NOW()),
  ('f0000001-0000-0000-0000-000000000005', 'API Access', 'Full REST API access', 'FEAT005', NOW(), NOW()),
  ('f0000001-0000-0000-0000-000000000006', 'Custom Branding', 'White-label your workspace', 'FEAT006', NOW(), NOW());

-- Sample plans (using fixed UUIDs for reference)
INSERT INTO plans (id, name, description, price, billingCycle, trialEnabled, trialDays, createdAt, updatedAt) VALUES
  ('p0000001-0000-0000-0000-000000000001', 'Basic', 'Perfect for individuals', 9.99, 'monthly', FALSE, 0, NOW(), NOW()),
  ('p0000001-0000-0000-0000-000000000002', 'Professional', 'For growing teams', 29.99, 'monthly', TRUE, 14, NOW(), NOW()),
  ('p0000001-0000-0000-0000-000000000003', 'Enterprise', 'For large organizations', 99.99, 'monthly', TRUE, 30, NOW(), NOW());

-- Sample plan_features (many-to-many)
INSERT INTO plan_features (planId, featureId) VALUES
  ('p0000001-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000001'), 
  ('p0000001-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000002'),
  ('p0000001-0000-0000-0000-000000000002', 'f0000001-0000-0000-0000-000000000001'), 
  ('p0000001-0000-0000-0000-000000000002', 'f0000001-0000-0000-0000-000000000002'), 
  ('p0000001-0000-0000-0000-000000000002', 'f0000001-0000-0000-0000-000000000003'), 
  ('p0000001-0000-0000-0000-000000000002', 'f0000001-0000-0000-0000-000000000005'),
  ('p0000001-0000-0000-0000-000000000003', 'f0000001-0000-0000-0000-000000000001'), 
  ('p0000001-0000-0000-0000-000000000003', 'f0000001-0000-0000-0000-000000000002'), 
  ('p0000001-0000-0000-0000-000000000003', 'f0000001-0000-0000-0000-000000000003'), 
  ('p0000001-0000-0000-0000-000000000003', 'f0000001-0000-0000-0000-000000000004'), 
  ('p0000001-0000-0000-0000-000000000003', 'f0000001-0000-0000-0000-000000000005'), 
  ('p0000001-0000-0000-0000-000000000003', 'f0000001-0000-0000-0000-000000000006');
