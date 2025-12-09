import { Type } from "class-transformer";
import { IsOptional, IsString, ValidateNested, IsUUID } from "class-validator";
import { OrderItemDto } from "./order-item.dto";

export class CreateOrderDto {
  @IsUUID()
  customerId: string;

  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  shippingAddress?: string;

  @IsOptional()
  @IsString()
  billingAddress?: string;
}