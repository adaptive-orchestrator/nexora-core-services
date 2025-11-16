import { ApiProperty } from '@nestjs/swagger';

export class AddonResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'extra_storage' })
  addonKey: string;

  @ApiProperty({ example: 'Extra Storage 100GB' })
  name: string;

  @ApiProperty({ example: 'Additional 100GB storage space for your account' })
  description: string;

  @ApiProperty({ example: 50000 })
  price: number;

  @ApiProperty({ example: 'monthly', enum: ['monthly', 'yearly', 'onetime'] })
  billingPeriod: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: { storage_gb: 100 } })
  features: Record<string, any>;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;
}

export class UserAddonResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  subscriptionId: number;

  @ApiProperty({ example: 1 })
  addonId: number;

  @ApiProperty({ example: 123 })
  customerId: number;

  @ApiProperty({ example: 50000 })
  price: number;

  @ApiProperty({ example: 'active', enum: ['active', 'cancelled', 'expired'] })
  status: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  purchasedAt: Date;

  @ApiProperty({ example: '2024-02-01T00:00:00.000Z', required: false })
  expiresAt?: Date;

  @ApiProperty({ example: '2024-02-01T00:00:00.000Z', required: false })
  nextBillingDate?: Date;

  @ApiProperty({ example: '2024-01-15T00:00:00.000Z', required: false })
  cancelledAt?: Date;
}
