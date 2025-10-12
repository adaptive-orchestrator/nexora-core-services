export class ReleaseInventoryDto {
  productId: number;
  quantity: number;
  orderId: string;
  reason: 'order_cancelled' | 'order_completed' | 'manual_release';
}
