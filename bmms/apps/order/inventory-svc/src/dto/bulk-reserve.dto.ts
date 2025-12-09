export class BulkReserveDto {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  orderId: string;
  customerId: string;
}