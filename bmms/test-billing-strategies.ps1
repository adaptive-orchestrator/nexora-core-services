# Test Billing Strategy Pattern
# Run this script để test cả 3 models

Write-Host "🚀 Testing Billing Strategy Pattern" -ForegroundColor Cyan
Write-Host ""

$baseUrlBilling = "http://localhost:3003"
$baseUrlOrder = "http://localhost:3011"
$baseUrlSubscription = "http://localhost:3012"

# Check if services are running
Write-Host "📡 Checking services..." -ForegroundColor Yellow
try {
    $billingHealth = Invoke-WebRequest -Uri "$baseUrlBilling/health" -Method GET -ErrorAction SilentlyContinue
    Write-Host "   ✅ BillingService is running" -ForegroundColor Green
} catch {
    Write-Host "   ❌ BillingService is NOT running (port 3003)" -ForegroundColor Red
    Write-Host "   Start it: `$env:BILLING_MODE='onetime'; npm run start:billing:dev" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Test 1: RETAIL MODEL (Onetime Billing)" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan

$retailOrder = @{
    customerId = 1
    items = @(
        @{
            productId = 101
            description = "Premium Product"
            quantity = 2
            unitPrice = 50000
        }
    )
    metadata = @{
        businessModel = "retail"
    }
} | ConvertTo-Json -Depth 10

Write-Host "📤 Sending retail order..." -ForegroundColor Yellow
Write-Host $retailOrder -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "$baseUrlOrder/orders" -Method POST -Body $retailOrder -ContentType "application/json"
    Write-Host "✅ Order created!" -ForegroundColor Green
    Write-Host "   Order ID: $($response.id)" -ForegroundColor Gray
    Write-Host "   Expected: OnetimeBillingStrategy, billingMode: 'onetime'" -ForegroundColor Magenta
} catch {
    Write-Host "❌ Failed to create order: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Test 2: SUBSCRIPTION MODEL (Recurring Billing)" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan

$subscription = @{
    customerId = 1
    planId = 1
    price = 199000
    billingPeriod = "monthly"
    metadata = @{
        businessModel = "subscription"
    }
} | ConvertTo-Json -Depth 10

Write-Host "📤 Sending subscription..." -ForegroundColor Yellow
Write-Host $subscription -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "$baseUrlSubscription/subscriptions" -Method POST -Body $subscription -ContentType "application/json"
    Write-Host "✅ Subscription created!" -ForegroundColor Green
    Write-Host "   Subscription ID: $($response.id)" -ForegroundColor Gray
    Write-Host "   Expected: RecurringBillingStrategy, billingMode: 'recurring'" -ForegroundColor Magenta
} catch {
    Write-Host "❌ Failed to create subscription: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Test 3: FREEMIUM MODEL (Add-on Billing)" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan

# Step 1: Create freemium subscription
$freemiumSub = @{
    customerId = 2
    planId = 0
    isFreeTier = $true
} | ConvertTo-Json

Write-Host "📤 Creating freemium subscription..." -ForegroundColor Yellow
Write-Host $freemiumSub -ForegroundColor Gray

try {
    $freeSub = Invoke-RestMethod -Uri "$baseUrlSubscription/subscriptions/freemium" -Method POST -Body $freemiumSub -ContentType "application/json"
    Write-Host "✅ Freemium subscription created!" -ForegroundColor Green
    Write-Host "   Subscription ID: $($freeSub.id)" -ForegroundColor Gray
    Write-Host "   Expected: NO invoice (base plan is free)" -ForegroundColor Magenta
    
    Start-Sleep -Seconds 2
    
    # Step 2: Purchase add-ons
    $addonPurchase = @{
        subscriptionId = $freeSub.id
        customerId = 2
        addonKeys = @("extra_storage", "ai_assistant")
        metadata = @{
            businessModel = "freemium"
        }
    } | ConvertTo-Json -Depth 10
    
    Write-Host ""
    Write-Host "📤 Purchasing add-ons..." -ForegroundColor Yellow
    Write-Host $addonPurchase -ForegroundColor Gray
    
    $addonResponse = Invoke-RestMethod -Uri "$baseUrlSubscription/addons/purchase" -Method POST -Body $addonPurchase -ContentType "application/json"
    Write-Host "✅ Add-ons purchased!" -ForegroundColor Green
    Write-Host "   Add-ons: extra_storage (50k) + ai_assistant (100k)" -ForegroundColor Gray
    Write-Host "   Expected: FreemiumBillingStrategy, billingMode: 'addon_only'" -ForegroundColor Magenta
    Write-Host "   Expected invoice: 150k + 15k tax = 165k VND" -ForegroundColor Magenta
} catch {
    Write-Host "❌ Failed freemium flow: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ All tests completed!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Check BillingService logs for:" -ForegroundColor Yellow
Write-Host "   1. ✅ Selected strategy: OnetimeBillingStrategy" -ForegroundColor Gray
Write-Host "   2. ✅ Selected strategy: RecurringBillingStrategy" -ForegroundColor Gray
Write-Host "   3. ✅ Selected strategy: FreemiumBillingStrategy" -ForegroundColor Gray
Write-Host ""
Write-Host "📊 Verify invoices created:" -ForegroundColor Yellow
Write-Host "   curl $baseUrlBilling/billing/invoices" -ForegroundColor Gray
