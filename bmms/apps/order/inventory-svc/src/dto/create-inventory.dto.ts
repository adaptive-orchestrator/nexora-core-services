export class CreateInventoryDto {
  productId: string;
  quantity: number;
  ownerId?: string;      // Owner của inventory (user ID)
  warehouseLocation?: string;
  reorderLevel?: number; // Mức tồn kho tối thiểu
  maxStock?: number;     // Mức tồn kho tối đa
}