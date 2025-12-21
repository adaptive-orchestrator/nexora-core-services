# LLM Output Archive

Thư mục chứa output từ LLM Orchestrator qua các giai đoạn phát triển.

## Cấu trúc thư mục

```
llm_output/
├── phase1_prototype/        # 4 files - Giai đoạn prototype
├── phase2_basic_structure/  # 6 files - Chuẩn hóa cơ bản
├── phase3_multi_model/      # 8 files - Multi-Model era
├── phase4_business_model/   # 8 files - Business Model ổn định
└── demo_scenarios/          # Demo files cho testing
```

## Mô tả các giai đoạn

### Phase 1: Prototype (1760997xxx)
- **Files:** 4
- **Timestamp range:** 1760997479577 - 1761057203940
- **Đặc điểm:**
  - Format đơn giản
  - Model naming không nhất quán (`ProductGroup` vs `product_group`)
  - Service naming nhiều format: `["Billing", "Subscription Management"]`, `["BillingService", ...]`
  - Không có metadata chi tiết

### Phase 2: Basic Structure (1761057xxx - 1761669xxx)
- **Files:** 6  
- **Timestamp range:** 1761057704984 - 1761669416637
- **Đặc điểm:**
  - Bắt đầu chuẩn hóa format
  - Xuất hiện model `SubscriptionPlan`
  - Services format `XxxService`
  - Thêm trường `from_model`/`to_model` trong metadata
  - Intent rõ ràng hơn: `business_model_change`

### Phase 3: Multi-Model Era (1761669xxx - 1761682xxx)
- **Files:** 8
- **Timestamp range:** 1761669489518 - 1761682162063
- **Đặc điểm:**
  - Chuyển sang `MultiBusinessModel`
  - Features đầy đủ: `business_model`, `supported_models`, `retail_products_count`, `subscription_plans_count`
  - **SHARED SERVICE PATTERN** note trong metadata
  - Services list đầy đủ 11 services
  - Intent: `business_model_expansion`

### Phase 4: Business Model Change (1762xxx - 1764xxx)
- **Files:** 8
- **Timestamp range:** 1762199826285 - 1764768929169
- **Đặc điểm:**
  - Format ổn định với model `BusinessModel`
  - `billing_mode: "RECURRING"` cho subscription
  - Metadata chuẩn: `from_model`, `to_model`, `confidence`, `risk`
  - Intent: `business_model_change`
  - Services list phù hợp với từng use case

## Demo Scenarios

| File | Mô tả |
|------|-------|
| `scenario1_retail_to_subscription.json` | Demo chuyển retail → subscription |
| `scenario2_multi_model.json` | Demo thiết lập multi-model |

## Format chuẩn (Phase 4)

```json
{
  "proposal_text": "Mô tả đề xuất bằng ngôn ngữ tự nhiên",
  "changeset": {
    "model": "BusinessModel",
    "features": [
      {"key": "business_model", "value": "subscription"},
      {"key": "billing_mode", "value": "RECURRING"}
    ],
    "impacted_services": ["SubscriptionService", "BillingService", ...]
  },
  "metadata": {
    "intent": "business_model_change",
    "confidence": 0.95,
    "risk": "medium",
    "from_model": "retail",
    "to_model": "subscription"
  }
}
```

## Notes

- Files có format `{timestamp}_raw.json` là raw output từ LLM
- Timestamp là Unix epoch milliseconds

