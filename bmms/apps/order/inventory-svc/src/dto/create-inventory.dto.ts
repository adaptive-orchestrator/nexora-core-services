export class CreateInventoryDto {
  productId: number;
  quantity: number;
  warehouseLocation?: string;
  reorderLevel?: number; // Mức tồn kho tối thiểu
  maxStock?: number;     // Mức tồn kho tối đa
}