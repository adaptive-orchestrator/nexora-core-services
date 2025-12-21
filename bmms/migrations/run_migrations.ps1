# =============================================
# BMMS Database Migration Script
# Date: 2025-12-04
# Description: Run all migrations for all databases
# Usage: .\run_migrations.ps1
# =============================================

param(
    [switch]$DryRun,      # Show commands without executing
    [switch]$Rollback,    # Run rollback scripts instead
    [string]$Database     # Run migrations for specific database only
)

# Configuration
$DB_ROOT_PASSWORD = "bmms_root_password"
$MIGRATIONS_DIR = $PSScriptRoot

# Database container mapping
$DatabaseConfig = @{
    "auth" = @{
        Container = "bmms-customer-db"  # auth uses customer_db container
        Database = "customer_db"        # auth tables are in customer_db
        Migrations = @(
            "auth/000_create_users_table.sql",
            "auth/001_add_business_model_and_seed_admin.sql"
        )
        Rollback = @()
    }
    "catalogue" = @{
        Container = "bmms-catalogue-db"
        Database = "catalogue_db"
        Migrations = @(
            "catalogue/001_add_trial_to_plans.sql",
            "catalogue/002_create_plan_features_table.sql",
            "catalogue/003_seed_sample_data.sql",
            "catalogue/004_add_imageUrl_to_products.sql"
        )
        Rollback = @(
            "catalogue/rollback_trial_columns.sql"
        )
    }
    "subscription" = @{
        Container = "bmms-subscription-db"
        Database = "subscription_db"
        Migrations = @(
            "subscription/001_create_subscriptions_table.sql",
            "subscription/002_create_subscription_history_table.sql",
            "subscription/003_add_freemium_addons.sql"
        )
        Rollback = @(
            "subscription/rollback_all.sql"
        )
    }
    "billing" = @{
        Container = "bmms-billing-db"
        Database = "billing_db"
        Migrations = @(
            "billing/001_add_subscription_support_to_invoices.sql",
            "billing/002_add_addon_metadata_column.sql",
            "billing/003_make_productId_nullable.sql"
        )
        Rollback = @(
            "billing/rollback_subscription_columns.sql"
        )
    }
    "order" = @{
        Container = "bmms-order-db"
        Database = "order_db"
        Migrations = @(
            "order/003_add_payment_status.sql"
        )
        Rollback = @()
    }
    "promotion" = @{
        Container = "bmms-promotion-db"
        Database = "promotion_db"
        Migrations = @(
            "promotion/001_create_promotions_table.sql",
            "promotion/002_create_promotion_usage_table.sql"
        )
        Rollback = @(
            "promotion/rollback_all.sql"
        )
    }
    "payment" = @{
        Container = "bmms-payment-db"
        Database = "payment_db"
        Migrations = @(
            "payment/001_create_payment_retries.sql"
        )
        Rollback = @(
            "payment/rollback_payment_retries.sql"
        )
    }
}

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host " $Text" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Text)
    Write-Host "  ✅ $Text" -ForegroundColor Green
}

function Write-Error {
    param([string]$Text)
    Write-Host "  ❌ $Text" -ForegroundColor Red
}

function Write-Info {
    param([string]$Text)
    Write-Host "  📝 $Text" -ForegroundColor Yellow
}

function Test-ContainerRunning {
    param([string]$ContainerName)
    $result = docker ps --filter "name=$ContainerName" --filter "status=running" --format "{{.Names}}" 2>$null
    return $result -eq $ContainerName
}

function Run-Migration {
    param(
        [string]$Container,
        [string]$Database,
        [string]$SqlFile
    )
    
    $FilePath = Join-Path $MIGRATIONS_DIR $SqlFile
    
    if (-not (Test-Path $FilePath)) {
        Write-Error "File not found: $SqlFile"
        return $false
    }
    
    if ($DryRun) {
        Write-Info "[DRY-RUN] Would run: $SqlFile on $Database"
        return $true
    }
    
    try {
        # Read SQL file and pipe to docker exec
        $SqlContent = Get-Content $FilePath -Raw
        $SqlContent | docker exec -i $Container mysql -u root -p"$DB_ROOT_PASSWORD" $Database 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "$SqlFile"
            return $true
        } else {
            Write-Error "Failed: $SqlFile"
            return $false
        }
    } catch {
        Write-Error "Exception: $($_.Exception.Message)"
        return $false
    }
}

function Run-DatabaseMigrations {
    param(
        [string]$DbName,
        [hashtable]$Config,
        [bool]$IsRollback
    )
    
    Write-Header "$DbName Database"
    
    # Check if container is running
    if (-not (Test-ContainerRunning $Config.Container)) {
        Write-Error "Container $($Config.Container) is not running!"
        Write-Info "Start it with: docker-compose up -d $($Config.Container)"
        return $false
    }
    
    Write-Success "Container $($Config.Container) is running"
    
    $Files = if ($IsRollback) { $Config.Rollback } else { $Config.Migrations }
    
    if ($Files.Count -eq 0) {
        Write-Info "No $(if ($IsRollback) {'rollback'} else {'migration'}) files for $DbName"
        return $true
    }
    
    $AllSuccess = $true
    foreach ($File in $Files) {
        $Result = Run-Migration -Container $Config.Container -Database $Config.Database -SqlFile $File
        if (-not $Result) {
            $AllSuccess = $false
        }
    }
    
    return $AllSuccess
}

# =============================================
# MAIN SCRIPT
# =============================================

Write-Host ""
Write-Host "🚀 BMMS Database Migration Script" -ForegroundColor Magenta
Write-Host "   Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

if ($DryRun) {
    Write-Host "   Mode: DRY-RUN (no changes will be made)" -ForegroundColor Yellow
} elseif ($Rollback) {
    Write-Host "   Mode: ROLLBACK" -ForegroundColor Red
} else {
    Write-Host "   Mode: MIGRATE" -ForegroundColor Green
}

# Check Docker is running
$dockerRunning = docker info 2>$null
if (-not $dockerRunning) {
    Write-Error "Docker is not running! Please start Docker Desktop."
    exit 1
}

$TotalSuccess = 0
$TotalFailed = 0

# Run migrations for each database
$DatabasesToRun = if ($Database) { @($Database) } else { $DatabaseConfig.Keys }

foreach ($DbName in $DatabasesToRun) {
    if (-not $DatabaseConfig.ContainsKey($DbName)) {
        Write-Error "Unknown database: $DbName"
        Write-Info "Available: $($DatabaseConfig.Keys -join ', ')"
        continue
    }
    
    $Result = Run-DatabaseMigrations -DbName $DbName -Config $DatabaseConfig[$DbName] -IsRollback $Rollback
    
    if ($Result) {
        $TotalSuccess++
    } else {
        $TotalFailed++
    }
}

# Summary
Write-Header "SUMMARY"
Write-Host "  Total databases: $($DatabasesToRun.Count)" -ForegroundColor White
Write-Host "  Successful: $TotalSuccess" -ForegroundColor Green
Write-Host "  Failed: $TotalFailed" -ForegroundColor $(if ($TotalFailed -gt 0) {'Red'} else {'Gray'})
Write-Host ""

if ($TotalFailed -gt 0) {
    exit 1
}
