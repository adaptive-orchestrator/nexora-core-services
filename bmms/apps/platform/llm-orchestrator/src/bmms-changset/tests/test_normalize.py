import json
from src.bmms_changelet.normalize_input import normalize

def test_alias_product_catalog_to_catalogue():
    raw_input = {
        "proposal_text": "Chuyển nhóm sản phẩm A sang subscription theo tháng",
        "changeset": {
            "model": "product_catalog",  # LLM sinh ra tên này
            "features": [
                {"key": "product_group", "value": "A"},
                {"key": "subscription_type", "value": "monthly"}
            ],
            "impacted_services": ["billing", "product_catalog"]
        },
        "metadata": {
            "intent": "change_product_subscription",
            "confidence": 0.9,
            "risk": "low"
        }
    }

    normalized = normalize(raw_input)

    # Service phải được map thành 'catalogue'
    assert normalized["changes"][0]["service"] == "catalogue"

    # Các field quan trọng phải tồn tại
    assert "id" in normalized
    assert "timestamp" in normalized
    assert normalized["metadata"]["confidence"] == 0.9
