start auth-svc
auth/signup

start catalogue  --- cái này chưa có update
create

start /inventory
create

start order
create

Order-svc 
  └─ emit order.created 
       └─> Inventory-svc lắng nghe (ORDER_CREATED)
            └─ reserve stock
            └─ emit inventory.reserved
                 └─> Billing-svc lắng nghe (INVENTORY_RESERVED)
                      └─ tạo invoice
                      └─ emit invoice.created