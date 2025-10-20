from bmms_changelet.validator import validate_changeset, load_catalogue, load_schema

def test_scale_order_valid():
    catalogue = load_catalogue("schema/service_catalogue.yaml")
    schema = load_schema("schema/changeset.schema.json")
    changeset = {
        "id": "chg-0001",
        "intent": "scale_order",
        "timestamp": "2025-09-14T12:00:00Z",
        "request_context": {"tenant_id":"tenant-demo","requested_by":"linh","role":"admin"},
        "changes": [
            {"action": "scale", "service": "order", "config": {"replicas": 5}}
        ],
        "metadata": {"confidence": 0.95, "risk":"low"}
    }
    res = validate_changeset(changeset, catalogue, schema)
    assert res['status'] == 'validated'
