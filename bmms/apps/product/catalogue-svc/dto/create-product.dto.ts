export class CreateProductDto {
  name: string;
  description: string;
  price: number;
  sku: string;
  category: string;
  imageUrl?: string;
  ownerId?: string;
}