import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateFeatureDto {
  @ApiProperty({ description: 'Feature name', example: 'Advanced Analytics' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Feature description', example: 'Access to advanced analytics dashboard' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Feature key/code', example: 'ANALYTICS_PRO', required: false })
  @IsString()
  @IsOptional()
  featureKey?: string;

  @ApiProperty({ description: 'Is feature enabled', example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}
