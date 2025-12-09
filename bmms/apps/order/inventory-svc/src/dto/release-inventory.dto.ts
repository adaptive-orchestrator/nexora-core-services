export class ReleaseInventoryDto {
  productId: string;
  quantity: number;
  orderId: string;
  reason: 'order_cancelled' | 'order_completed' | 'manual_release';
}
