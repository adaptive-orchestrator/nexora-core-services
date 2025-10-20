import { ApiProperty } from '@nestjs/swagger';

export class ChangesetFeatureDto {
  @ApiProperty({ example: 'billing_frequency' })
  key: string;

  @ApiProperty({ example: 'monthly' })
  value: string;
}

export class ChangesetDto {
  @ApiProperty({ example: 'ProductSubscription' })
  model: string;

  @ApiProperty({
    type: [ChangesetFeatureDto],
    example: [
      { key: 'product_group_name', value: 'A' },
      { key: 'billing_frequency', value: 'monthly' },
      { key: 'action', value: 'change_subscription_model' },
    ],
  })
  features: ChangesetFeatureDto[];

  @ApiProperty({
    example: ['BillingService', 'ProductCatalog', 'CustomerPortal'],
  })
  impacted_services: string[];
}

export class MetadataDto {
  @ApiProperty({ example: 'update_subscription_plan' })
  intent: string;

  @ApiProperty({ example: 0.95 })
  confidence: number;

  @ApiProperty({ example: 'medium' })
  risk: string;
}

export class LlmChatResponseDto {
  @ApiProperty({
    example: 'Đề xuất chuyển nhóm sản phẩm A sang mô hình đăng ký theo tháng.',
  })
  proposal_text: string;

  @ApiProperty({ type: ChangesetDto })
  changeset: ChangesetDto;

  @ApiProperty({ type: MetadataDto })
  metadata: MetadataDto;
}

export class LlmErrorResponseDto {
  @ApiProperty({ example: 'message required' })
  error: string;
}
