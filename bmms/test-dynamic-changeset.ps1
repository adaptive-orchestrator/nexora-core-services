# Test Dynamic Changeset API - PowerShell Script
# Automated testing for RAG-based dynamic changeset generation

$BASE_URL = "http://localhost:8003"
$ENDPOINT = "/llm-orchestrator/generate-dynamic-changeset"
$OUTPUT_DIR = "c:\Users\vulin\Desktop\app\nexora-core-services\bmms\llm_output\dynamic_changesets"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   DYNAMIC CHANGESET API - AUTOMATED TEST" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Create output directory if not exists
if (-not (Test-Path $OUTPUT_DIR)) {
    Write-Host "[SETUP] Creating output directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $OUTPUT_DIR -Force | Out-Null
    Write-Host "[SETUP] ✅ Directory created: $OUTPUT_DIR" -ForegroundColor Green
}

# Function to call API and display results
function Test-DynamicChangeset {
    param(
        [string]$TestName,
        [string]$Intent,
        [string]$CurrentModel,
        [string]$TargetModel,
        [string[]]$ForceServices,
        [string[]]$ExcludeServices,
        [string]$ExpectedRisk
    )

    Write-Host ""
    Write-Host "──────────────────────────────────────────────────────────────────" -ForegroundColor Yellow
    Write-Host "TEST: $TestName" -ForegroundColor Cyan
    Write-Host "──────────────────────────────────────────────────────────────────" -ForegroundColor Yellow

    # Build request body
    $body = @{
        user_intent = $Intent
    }
    if ($CurrentModel) { $body.current_model = $CurrentModel }
    if ($TargetModel) { $body.target_model = $TargetModel }
    if ($ForceServices) { $body.force_services = $ForceServices }
    if ($ExcludeServices) { $body.exclude_services = $ExcludeServices }

    $jsonBody = $body | ConvertTo-Json -Depth 10

    Write-Host "📤 Request:" -ForegroundColor Magenta
    Write-Host $jsonBody -ForegroundColor Gray
    Write-Host ""

    # Call API
    $startTime = Get-Date
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL$ENDPOINT" -Method POST `
            -ContentType "application/json" -Body $jsonBody
        $endTime = Get-Date
        $latency = ($endTime - $startTime).TotalMilliseconds

        Write-Host "📥 Response (${latency}ms):" -ForegroundColor Magenta
        $response | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Gray
        Write-Host ""

        # Verify success
        if ($response.success) {
            Write-Host "✅ SUCCESS" -ForegroundColor Green
            
            # Display key info
            $data = $response.data
            Write-Host "   - Risk Level: $($data.risk_level)" -ForegroundColor $(
                if ($data.risk_level -eq "high") { "Red" }
                elseif ($data.risk_level -eq "medium") { "Yellow" }
                else { "Green" }
            )
            Write-Host "   - Discovered Services: $($data.discovered_services.Count)" -ForegroundColor White
            Write-Host "   - Total Services: $($data.total_services)" -ForegroundColor White
            Write-Host "   - Enabled Services: $($data.enabled_services)" -ForegroundColor White
            Write-Host "   - JSON: $($data.files.json)" -ForegroundColor White
            Write-Host "   - YAML: $($data.files.yaml)" -ForegroundColor White

            # Verify risk level
            if ($ExpectedRisk -and $data.risk_level -ne $ExpectedRisk) {
                Write-Host "   ⚠️  RISK MISMATCH: Expected '$ExpectedRisk' but got '$($data.risk_level)'" -ForegroundColor Red
            } else {
                Write-Host "   ✅ Risk level as expected" -ForegroundColor Green
            }

            # Show sample services
            Write-Host ""
            Write-Host "   Enabled Services:" -ForegroundColor Cyan
            $data.changeset.services | Where-Object { $_.enabled } | Select-Object -First 5 | ForEach-Object {
                $restart = if ($_.needsRestart) { " [RESTART]" } else { "" }
                Write-Host "      - $($_.name)$restart" -ForegroundColor White
            }

        } else {
            Write-Host "❌ FAILED: $($response.error)" -ForegroundColor Red
        }

    } catch {
        Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }

    Write-Host ""
}

# ====================================================================
# TEST CASES
# ====================================================================

# Test 1: Retail Model (Basic)
Test-DynamicChangeset `
    -TestName "TC1: Retail Model Transition" `
    -Intent "Tôi muốn chuyển sang mô hình bán lẻ truyền thống" `
    -CurrentModel "multi" `
    -TargetModel "retail" `
    -ExpectedRisk "low"

# Test 2: Disable Billing Service (HIGH RISK)
Test-DynamicChangeset `
    -TestName "TC2: Disable Critical Service" `
    -Intent "Tắt Billing Service để bảo trì" `
    -ExcludeServices @("BillingService") `
    -ExpectedRisk "high"

# Test 3: Custom Service Discovery
Test-DynamicChangeset `
    -TestName "TC3: Custom Service Discovery" `
    -Intent "Tôi cần thêm service xử lý AI chat và notification" `
    -ForceServices @("AIChatService", "NotificationService") `
    -ExpectedRisk "low"

# Test 4: Pricing Change (MEDIUM RISK)
Test-DynamicChangeset `
    -TestName "TC4: Pricing Strategy Change" `
    -Intent "Thay đổi giá sản phẩm và chiến lược pricing" `
    -CurrentModel "retail" `
    -TargetModel "retail" `
    -ExpectedRisk "medium"

# Test 5: Subscription Model
Test-DynamicChangeset `
    -TestName "TC5: Subscription Model" `
    -Intent "Chuyển sang mô hình subscription với recurring billing" `
    -TargetModel "subscription" `
    -ExpectedRisk "low"

# Test 6: Dangerous Operation (Delete)
Test-DynamicChangeset `
    -TestName "TC6: Dangerous Operation Detection" `
    -Intent "Xóa tất cả dữ liệu cũ của billing service" `
    -ExpectedRisk "high"

# ====================================================================
# VERIFICATION
# ====================================================================

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   VERIFICATION" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Check output directory
Write-Host "📁 Checking output files..." -ForegroundColor Magenta
if (Test-Path $OUTPUT_DIR) {
    $files = Get-ChildItem $OUTPUT_DIR -File | Sort-Object LastWriteTime -Descending
    Write-Host "   Found $($files.Count) files:" -ForegroundColor White
    $files | Select-Object -First 10 | ForEach-Object {
        Write-Host "      - $($_.Name) ($([math]::Round($_.Length/1024, 2)) KB)" -ForegroundColor Gray
    }
} else {
    Write-Host "   ⚠️  Output directory not found!" -ForegroundColor Red
}

Write-Host ""

# Sample file inspection
$latestJson = Get-ChildItem "$OUTPUT_DIR\*.json" -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$latestYaml = Get-ChildItem "$OUTPUT_DIR\*.yaml" -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($latestJson) {
    Write-Host "📄 Latest JSON file:" -ForegroundColor Magenta
    Write-Host "   $($latestJson.FullName)" -ForegroundColor White
    Write-Host ""
    Write-Host "   Content preview:" -ForegroundColor Cyan
    Get-Content $latestJson.FullName | ConvertFrom-Json | ConvertTo-Json -Depth 5 | Write-Host -ForegroundColor Gray
}

Write-Host ""

if ($latestYaml) {
    Write-Host "📄 Latest YAML file:" -ForegroundColor Magenta
    Write-Host "   $($latestYaml.FullName)" -ForegroundColor White
    Write-Host ""
    Write-Host "   Content preview:" -ForegroundColor Cyan
    Get-Content $latestYaml.FullName -Head 30 | Write-Host -ForegroundColor Gray
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   TEST COMPLETE" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ All tests completed. Review results above." -ForegroundColor Green
Write-Host ""
