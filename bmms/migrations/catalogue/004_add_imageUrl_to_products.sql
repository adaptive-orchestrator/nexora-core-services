-- Add imageUrl column to products table

USE catalogue_db;

-- Add imageUrl column if not exists
SET @dbname = DATABASE();
SET @tablename = 'products';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE (table_name = @tablename)
       AND (table_schema = @dbname)
       AND (column_name = 'imageUrl')) > 0,
    "SELECT 'Column imageUrl already exists' AS msg",
    "ALTER TABLE products ADD COLUMN imageUrl VARCHAR(500) NULL"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
