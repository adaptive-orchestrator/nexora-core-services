import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsArray, ArrayMinSize } from 'class-validator';

export class PurchaseAddonDto {
  @ApiProperty({
    description: 'ID of the subscription to add the add-ons to',
    example: 1,
  })
  @IsNumber()
  subscriptionId: number;

  @ApiProperty({
    description: 'ID of the customer purchasing the add-ons',
    example: 123,
  })
  @IsNumber()
  customerId: number;

  @ApiProperty({
    description: 'Array of add-on keys to purchase',
    example: ['extra_storage', 'ai_assistant'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  addonKeys: string[];
}
