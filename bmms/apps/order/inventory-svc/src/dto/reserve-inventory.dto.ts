export class ReserveInventoryDto {
  productId: number;
  quantity: number;
  orderId: string;      // Order ID mà đang reserve
  customerId: number;
  reservationExpiry?: Date; // Khi nào hết hạn reservation
}