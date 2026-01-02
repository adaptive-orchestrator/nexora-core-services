# Test Dynamic Changeset API (API 2 với Helm dry-run)
# Chạy: ./test-dynamic-changeset.ps1

$baseUrl = "http://localhost:3000"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Testing Dynamic Changeset API (API 2)"
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Generate Dynamic Changeset (files only)
Write-Host "1️⃣ Test: Generate Dynamic Changeset (files only)" -ForegroundColor Yellow
$body1 = @{
    user_intent = "Chuyển sang mô hình subscription với thanh toán định kỳ hàng tháng"
    current_model = "retail"
    target_model = "subscription"
    dry_run = $false
    deploy_after_validation = $false
} | ConvertTo-Json

try {
    $response1 = Invoke-RestMethod -Uri "$baseUrl/llm-orchestrator/generate-dynamic-changeset" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body1
    
    Write-Host "✅ Success: $($response1.message)" -ForegroundColor Green
    Write-Host "   Discovered Services: $($response1.data.discovered_services.Count)" -ForegroundColor Gray
    Write-Host "   Enabled Services: $($response1.data.enabled_services)" -ForegroundColor Gray
    Write-Host "   Risk Level: $($response1.data.risk_level)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Generate Dynamic Changeset with Helm dry-run
Write-Host "2️⃣ Test: Generate Dynamic Changeset + Helm Dry-Run" -ForegroundColor Yellow
$body2 = @{
    user_intent = "Chuyển sang mô hình subscription với thanh toán định kỳ hàng tháng"
    current_model = "retail"
    target_model = "subscription"
    dry_run = $true
    deploy_after_validation = $false
} | ConvertTo-Json

try {
    $response2 = Invoke-RestMethod -Uri "$baseUrl/llm-orchestrator/generate-dynamic-changeset" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body2
    
    if ($response2.success) {
        Write-Host "✅ Success" -ForegroundColor Green
        Write-Host "   Helm Validation: $($response2.helm_validation.validation_passed)" -ForegroundColor Gray
        if ($response2.helm_validation.validation_errors) {
            Write-Host "   Validation Errors: $($response2.helm_validation.validation_errors -join ', ')" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Failed: $($response2.error)" -ForegroundColor Red
        Write-Host "   Fallback Available: $($response2.fallback_available)" -ForegroundColor Yellow
        Write-Host "   Fallback Models: $($response2.fallback_models -join ', ')" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Smart Switch (API 2 → fallback to API 1)
Write-Host "3️⃣ Test: Smart Switch (API 2 → fallback to API 1)" -ForegroundColor Yellow
$body3 = @{
    user_intent = "Chuyển sang mô hình subscription với thanh toán định kỳ hàng tháng"
    current_model = "retail"
    target_model = "subscription"
    auto_deploy = $false
    use_fallback_on_failure = $true
} | ConvertTo-Json

try {
    $response3 = Invoke-RestMethod -Uri "$baseUrl/llm-orchestrator/smart-switch" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body3
    
    Write-Host "API Used: $($response3.api_used)" -ForegroundColor Cyan
    if ($response3.success) {
        Write-Host "✅ Success: $($response3.message)" -ForegroundColor Green
        Write-Host "   Deployed: $($response3.deployed)" -ForegroundColor Gray
        if ($response3.helm_validation) {
            Write-Host "   Validation Passed: $($response3.helm_validation.validation_passed)" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ Failed: $($response3.message)" -ForegroundColor Red
        if ($response3.fallback_options.available) {
            Write-Host "   Fallback Recommendation: $($response3.fallback_options.recommendation)" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 4: Compare with Switch-Model API (API 1)
Write-Host "4️⃣ Test: Switch-Model API (API 1 - Fixed Profiles)" -ForegroundColor Yellow
$body4 = @{
    to_model = "subscription"
    dry_run = $true
} | ConvertTo-Json

try {
    $response4 = Invoke-RestMethod -Uri "$baseUrl/llm-orchestrator/switch-model" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body4
    
    if ($response4.success) {
        Write-Host "✅ Success: $($response4.message)" -ForegroundColor Green
        Write-Host "   Changeset Path: $($response4.changeset_path)" -ForegroundColor Gray
        if ($response4.helm_dry_run_results) {
            Write-Host "   Helm Validation: $($response4.helm_dry_run_results.validation_passed)" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ Failed: $($response4.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Test Complete!"
Write-Host "================================================" -ForegroundColor Cyan
