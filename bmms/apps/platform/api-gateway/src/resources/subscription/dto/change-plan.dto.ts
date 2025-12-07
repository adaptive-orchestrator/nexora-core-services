import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsUUID } from 'class-validator';

export class ChangePlanDto {
  @ApiProperty({
    description: 'New plan ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  newPlanId: string;

  @ApiProperty({
    description: 'Apply change immediately (true) or at end of billing period (false)',
    example: true,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  immediate?: boolean;
}
