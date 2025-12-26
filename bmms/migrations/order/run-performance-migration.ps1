# =============================================
# Run Order Performance Indexes Migration
# =============================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ORDER SERVICE - PERFORMANCE MIGRATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$env:MYSQL_PWD = "bmms_password"
$MYSQL_USER = "bmms_user"
$MYSQL_HOST = "localhost"
$MYSQL_PORT = "3311"  # Order service DB port

$MIGRATION_FILE = "004_add_performance_indexes.sql"

Write-Host "Checking MySQL connection..." -ForegroundColor Yellow

# Test connection
$testConnection = & mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_USER -e "SELECT 1" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to connect to MySQL" -ForegroundColor Red
    Write-Host "Error: $testConnection" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please ensure:" -ForegroundColor Yellow
    Write-Host "  1. MySQL is running on port $MYSQL_PORT" -ForegroundColor Yellow
    Write-Host "  2. User '$MYSQL_USER' has correct password" -ForegroundColor Yellow
    Write-Host "  3. order_db database exists" -ForegroundColor Yellow
    exit 1
}

Write-Host "Connection successful" -ForegroundColor Green
Write-Host ""

Write-Host "Running migration: $MIGRATION_FILE" -ForegroundColor Yellow
Write-Host ""

# Run migration
$result = & mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_USER order_db < $MIGRATION_FILE 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Migration completed successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Show created indexes
    Write-Host "Verifying indexes..." -ForegroundColor Yellow
    & mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_USER order_db -e "
        SELECT 
            TABLE_NAME,
            INDEX_NAME,
            GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLUMNS
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = 'order_db'
          AND TABLE_NAME IN ('orders', 'order_items')
          AND INDEX_NAME LIKE 'idx_%'
        GROUP BY TABLE_NAME, INDEX_NAME
        ORDER BY TABLE_NAME, INDEX_NAME;
    "
    
    Write-Host ""
    Write-Host "Performance indexes added successfully!" -ForegroundColor Green
    Write-Host "Expected improvements:" -ForegroundColor Cyan
    Write-Host "  - List orders: 50-70% faster" -ForegroundColor White
    Write-Host "  - Filter queries: 60-80% faster" -ForegroundColor White
    Write-Host "  - Order details: 40-60% faster" -ForegroundColor White
    
} else {
    Write-Host "Migration failed!" -ForegroundColor Red
    Write-Host "Error: $result" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
