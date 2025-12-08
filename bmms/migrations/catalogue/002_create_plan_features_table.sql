-- Create plan_features junction table for Many-to-Many relationship

USE catalogue_db;

CREATE TABLE IF NOT EXISTS plan_features (
    planId CHAR(36) NOT NULL,
    featureId CHAR(36) NOT NULL,
    PRIMARY KEY (planId, featureId),
    FOREIGN KEY (planId) REFERENCES plans(id) ON DELETE CASCADE,
    FOREIGN KEY (featureId) REFERENCES features(id) ON DELETE CASCADE,
    INDEX idx_plan_features_planId (planId),
    INDEX idx_plan_features_featureId (featureId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
