import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsArray, IsEnum, ValidateNested, IsNumber, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { z } from 'zod';

/**
 * Valid business models
 */
export const VALID_BUSINESS_MODELS = ['retail', 'subscription', 'freemium', 'multi'] as const;
export type BusinessModel = typeof VALID_BUSINESS_MODELS[number];

/**
 * Risk levels
 */
export const RISK_LEVELS = ['low', 'medium', 'high'] as const;
export type RiskLevel = typeof RISK_LEVELS[number];

// ====== Zod Schemas for Runtime Validation ======

export const DynamicChangesetRequestSchema = z.object({
  user_intent: z.string().min(1, 'user_intent is required').max(2000, 'user_intent too long'),
  current_model: z.enum(VALID_BUSINESS_MODELS).optional(),
  target_model: z.enum(VALID_BUSINESS_MODELS).optional(),
  force_services: z.array(z.string()).optional().default([]),
  exclude_services: z.array(z.string()).optional().default([]),
  dry_run: z.boolean().optional().default(true),
  deploy_after_validation: z.boolean().optional().default(false),
  tenant_id: z.string().optional().default('default'),
});

export const DynamicServiceSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
  replica_count: z.number().int().min(0).max(10).optional(),
  needs_restart: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const DynamicChangesetDataSchema = z.object({
  timestamp: z.string(),
  intent: z.string(),
  from_model: z.string().optional(),
  to_model: z.string().optional(),
  discovered_services: z.array(z.string()),
  services: z.array(DynamicServiceSchema),
  risk_level: z.enum(RISK_LEVELS),
  auto_generated: z.boolean(),
});

export const HelmDryRunResultsSchema = z.object({
  validation_passed: z.boolean(),
  databases_output: z.string().optional(),
  services_output: z.string().optional(),
  validation_errors: z.array(z.string()).optional().default([]),
  warnings: z.array(z.string()).optional().default([]),
});

export const DynamicChangesetResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  error: z.string().optional(),
  changeset: DynamicChangesetDataSchema.optional(),
  json_path: z.string().optional(),
  yaml_path: z.string().optional(),
  helm_validation: HelmDryRunResultsSchema.optional(),
  deployed: z.boolean().optional(),
  fallback_available: z.boolean().optional(),
  fallback_models: z.array(z.enum(VALID_BUSINESS_MODELS)).optional(),
});

// ====== TypeScript Types from Zod ======

export type DynamicChangesetRequestType = z.infer<typeof DynamicChangesetRequestSchema>;
export type DynamicServiceType = z.infer<typeof DynamicServiceSchema>;
export type DynamicChangesetDataType = z.infer<typeof DynamicChangesetDataSchema>;
export type HelmDryRunResultsType = z.infer<typeof HelmDryRunResultsSchema>;
export type DynamicChangesetResponseType = z.infer<typeof DynamicChangesetResponseSchema>;

// ====== Class-Validator DTOs for NestJS ======

export class DynamicServiceDto {
  @ApiProperty({ example: 'OrderService', description: 'Service name' })
  @IsString()
  name: string;

  @ApiProperty({ example: true, description: 'Is service enabled' })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ example: 2, description: 'Replica count' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  replica_count?: number;

  @ApiPropertyOptional({ example: false, description: 'Needs restart' })
  @IsOptional()
  @IsBoolean()
  needs_restart?: boolean;

  @ApiPropertyOptional({ example: 0.95, description: 'RAG confidence score (0-1)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}

export class DynamicChangesetRequestDto {
  @ApiProperty({
    example: 'Tôi muốn chuyển sang mô hình subscription với các tính năng thanh toán định kỳ',
    description: 'User intent / business description cho AI phân tích',
  })
  @IsString()
  user_intent: string;

  @ApiPropertyOptional({
    example: 'retail',
    enum: VALID_BUSINESS_MODELS,
    description: 'Current business model',
  })
  @IsOptional()
  @IsEnum(VALID_BUSINESS_MODELS)
  current_model?: BusinessModel;

  @ApiPropertyOptional({
    example: 'subscription',
    enum: VALID_BUSINESS_MODELS,
    description: 'Target business model (optional, AI will suggest if not provided)',
  })
  @IsOptional()
  @IsEnum(VALID_BUSINESS_MODELS)
  target_model?: BusinessModel;

  @ApiPropertyOptional({
    example: ['BillingService', 'PaymentService'],
    description: 'Force include these services regardless of AI decision',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  force_services?: string[];

  @ApiPropertyOptional({
    example: ['LegacyService'],
    description: 'Force exclude these services regardless of AI decision',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  exclude_services?: string[];

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'If true, only validate with Helm --dry-run without deploying',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  dry_run?: boolean = true;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description: 'If true and dry_run passes, automatically deploy to K8s',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  deploy_after_validation?: boolean = false;

  @ApiPropertyOptional({
    example: 'tenant-123',
    default: 'default',
    description: 'Tenant ID',
  })
  @IsOptional()
  @IsString()
  tenant_id?: string = 'default';
}

export class HelmDryRunResultsDto {
  @ApiProperty({ example: true })
  validation_passed: boolean;

  @ApiPropertyOptional({ description: 'Rendered database manifests YAML' })
  databases_output?: string;

  @ApiPropertyOptional({ description: 'Rendered services manifests YAML' })
  services_output?: string;

  @ApiPropertyOptional({ example: [], description: 'Validation errors if any' })
  validation_errors?: string[];

  @ApiPropertyOptional({ example: [], description: 'Helm warnings' })
  warnings?: string[];
}

export class DynamicChangesetDataDto {
  @ApiProperty({ example: '2026-01-02T10:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: 'Chuyển sang subscription model' })
  intent: string;

  @ApiPropertyOptional({ example: 'retail' })
  from_model?: string;

  @ApiPropertyOptional({ example: 'subscription' })
  to_model?: string;

  @ApiProperty({ example: ['OrderService', 'SubscriptionService', 'BillingService'] })
  discovered_services: string[];

  @ApiProperty({ type: [DynamicServiceDto] })
  @ValidateNested({ each: true })
  @Type(() => DynamicServiceDto)
  services: DynamicServiceDto[];

  @ApiProperty({ example: 'medium', enum: RISK_LEVELS })
  risk_level: RiskLevel;

  @ApiProperty({ example: true })
  auto_generated: boolean;
}

export class DynamicChangesetResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Dynamic changeset generated and validated successfully' })
  message: string;

  @ApiPropertyOptional({ example: 'Validation failed: invalid service name' })
  error?: string;

  @ApiPropertyOptional({ type: DynamicChangesetDataDto })
  @ValidateNested()
  @Type(() => DynamicChangesetDataDto)
  changeset?: DynamicChangesetDataDto;

  @ApiPropertyOptional({ example: '/app/changesets/dynamic-1704186000000.json' })
  json_path?: string;

  @ApiPropertyOptional({ example: '/app/changesets/dynamic-1704186000000.yaml' })
  yaml_path?: string;

  @ApiPropertyOptional({ type: HelmDryRunResultsDto })
  @ValidateNested()
  @Type(() => HelmDryRunResultsDto)
  helm_validation?: HelmDryRunResultsDto;

  @ApiPropertyOptional({ example: true, description: 'Was deployed to K8s' })
  deployed?: boolean;

  @ApiPropertyOptional({ 
    example: true, 
    description: 'If validation failed, indicates fallback to switch-model API is available' 
  })
  fallback_available?: boolean;

  @ApiPropertyOptional({ 
    example: ['retail', 'subscription', 'freemium', 'multi'],
    description: 'Available models for fallback if AI-generated config failed'
  })
  fallback_models?: BusinessModel[];
}

// ====== Validation Helper Functions ======

/**
 * Validate request using Zod schema
 */
export function validateDynamicChangesetRequest(data: unknown): {
  success: boolean;
  data?: DynamicChangesetRequestType;
  errors?: z.ZodError;
} {
  const result = DynamicChangesetRequestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Validate response using Zod schema
 */
export function validateDynamicChangesetResponse(data: unknown): {
  success: boolean;
  data?: DynamicChangesetResponseType;
  errors?: z.ZodError;
} {
  const result = DynamicChangesetResponseSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Check if a model is valid
 */
export function isValidBusinessModel(model: string): model is BusinessModel {
  return VALID_BUSINESS_MODELS.includes(model as BusinessModel);
}
