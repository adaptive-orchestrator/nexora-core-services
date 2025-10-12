export class BulkReserveDto {
  items: Array<{
    productId: number;
    quantity: number;
  }>;
  orderId: string;
  customerId: number;
}