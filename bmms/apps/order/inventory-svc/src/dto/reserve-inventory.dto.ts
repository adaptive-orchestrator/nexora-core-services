export class ReserveInventoryDto {
  productId: string;
  quantity: number;
  orderId: string;      // Order ID mà đang reserve
  customerId: string;
  reservationExpiry?: Date; // Khi nào hết hạn reservation
}