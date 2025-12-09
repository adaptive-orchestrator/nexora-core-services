import { Injectable, Logger } from '@nestjs/common';

/**
 * Validation result structure
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    serviceCount: number;
    productCount?: number;
    planCount?: number;
    estimatedPods: number;
  };
}

/**
 * LLM Output Validator
 * Validates business logic, service mapping, and shared service pattern
 */
@Injectable()
export class LlmOutputValidator {
  private readonly logger = new Logger(LlmOutputValidator.name);

  // Valid service names that can be deployed
  private readonly VALID_SERVICES = [
    'AuthService',
    'CustomerService',
    'CRMOrchestratorService',
    'CatalogueService',
    'ProductCatalogService',
    'PricingEngineService',
    'PromotionService',
    'OrderService',
    'SubscriptionService',
    'InventoryService',
    'BillingService',
    'PaymentService',
    'APIGatewayService',
    'LLMOrchestratorService',
    'CodeIndexerService',
    'JobSchedulerService',
  ];

  // Business model to required services mapping
  private readonly MODEL_REQUIREMENTS = {
    retail: ['OrderService', 'InventoryService'],
    subscription: ['SubscriptionService', 'PromotionService'],
    freemium: ['SubscriptionService', 'PromotionService'],
    multi: ['OrderService', 'InventoryService', 'SubscriptionService', 'PromotionService'],
  };

  /**
   * Main validation function
   */
  validate(llmOutput: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Basic structure validation
    if (!llmOutput.changeset) {
      errors.push('Missing changeset in LLM output');
      return { isValid: false, errors, warnings };
    }

    const { changeset, metadata } = llmOutput;

    // 2. Validate impacted_services array
    if (!Array.isArray(changeset.impacted_services) || changeset.impacted_services.length === 0) {
      errors.push('impacted_services must be a non-empty array');
    } else {
      // Check for invalid service names
      const invalidServices = changeset.impacted_services.filter(
        (service: string) => !this.VALID_SERVICES.includes(service),
      );
      if (invalidServices.length > 0) {
        errors.push(`Invalid service names: ${invalidServices.join(', ')}`);
      }

      // Check for duplicate services
      const uniqueServices = new Set(changeset.impacted_services);
      if (uniqueServices.size !== changeset.impacted_services.length) {
        warnings.push('Duplicate services detected in impacted_services array');
      }
    }

    // 3. Validate business model requirements
    if (changeset.model) {
      const modelType = this.extractModelType(changeset);
      const requiredServices = this.MODEL_REQUIREMENTS[modelType as keyof typeof this.MODEL_REQUIREMENTS];

      if (requiredServices) {
        const missingServices = requiredServices.filter(
          (service: string) => !changeset.impacted_services.includes(service),
        );
        if (missingServices.length > 0) {
          warnings.push(
            `Business model '${modelType}' typically requires: ${missingServices.join(', ')}`,
          );
        }
      }
    }

    // 4. Validate shared service pattern (CRITICAL)
    const sharedServiceValidation = this.validateSharedServicePattern(changeset);
    errors.push(...sharedServiceValidation.errors);
    warnings.push(...sharedServiceValidation.warnings);

    // 5. Validate features array
    if (!Array.isArray(changeset.features)) {
      errors.push('changeset.features must be an array');
    } else {
      changeset.features.forEach((feature: any, index: number) => {
        if (!feature.key || feature.value === undefined) {
          errors.push(`Feature at index ${index} missing key or value`);
        }
      });
    }

    // 6. Validate metadata
    if (metadata) {
      if (!metadata.intent) {
        warnings.push('metadata.intent is missing');
      }
      if (metadata.confidence !== undefined && (metadata.confidence < 0 || metadata.confidence > 1)) {
        warnings.push('metadata.confidence should be between 0 and 1');
      }
    }

    // 7. Calculate metadata
    const serviceCount = changeset.impacted_services?.length || 0;
    const productCount = this.extractFeatureValue(changeset, 'retail_products_count');
    const planCount = this.extractFeatureValue(changeset, 'subscription_plans_count');
    const estimatedPods = this.estimatePodCount(changeset);

    // Log validation result
    if (errors.length > 0) {
      this.logger.error(`[ERROR] Validation failed: ${errors.join('; ')}`);
    } else if (warnings.length > 0) {
      this.logger.warn(`[WARNING] Validation warnings: ${warnings.join('; ')}`);
    } else {
      this.logger.log(`[LLM] Validation passed: ${serviceCount} services, ~${estimatedPods} pods`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        serviceCount,
        productCount,
        planCount,
        estimatedPods,
      },
    };
  }

  /**
   * Validate SHARED SERVICE PATTERN
   * Critical: Ensure LLM doesn't request multiple deployments for same service
   */
  private validateSharedServicePattern(changeset: any): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const productCount = this.extractFeatureValue(changeset, 'retail_products_count');
    const planCount = this.extractFeatureValue(changeset, 'subscription_plans_count');

    // Check if service count matches product/plan count (WRONG!)
    if (productCount && changeset.impacted_services.length === productCount) {
      errors.push(
        `SHARED SERVICE PATTERN VIOLATION: Found ${productCount} products and ${changeset.impacted_services.length} services. ` +
          `Expected 1 OrderService to handle all ${productCount} products, not ${productCount} separate services.`,
      );
    }

    if (planCount && changeset.impacted_services.length === planCount) {
      errors.push(
        `SHARED SERVICE PATTERN VIOLATION: Found ${planCount} subscription plans and ${changeset.impacted_services.length} services. ` +
          `Expected 1 SubscriptionService to handle all ${planCount} plans, not ${planCount} separate services.`,
      );
    }

    // Check for service name patterns like "OrderService-Product1", "OrderService-Product2"
    const serviceNamePattern = /Service-\d+|Service-[A-Z]/;
    const suspiciousServices = changeset.impacted_services.filter((service: string) =>
      serviceNamePattern.test(service),
    );

    if (suspiciousServices.length > 0) {
      errors.push(
        `SHARED SERVICE PATTERN VIOLATION: Suspicious service names detected: ${suspiciousServices.join(', ')}. ` +
          `Services should NOT have product/plan identifiers in their names.`,
      );
    }

    // Warning if too many services for simple model
    if (changeset.impacted_services.length > 15) {
      warnings.push(
        `Large number of services (${changeset.impacted_services.length}). Verify this is intentional.`,
      );
    }

    // Info logging
    if (productCount || planCount) {
      this.logger.log(
        `[LLM] SHARED SERVICE PATTERN: ${productCount || 0} products, ${planCount || 0} plans -> ${changeset.impacted_services.length} unique services`,
      );
    }

    return { errors, warnings };
  }

  /**
   * Extract model type from changeset
   */
  private extractModelType(changeset: any): string {
    // Try to extract from features
    const modelFeature = changeset.features?.find((f: any) => f.key === 'business_model');
    if (modelFeature) {
      return modelFeature.value;
    }

    // Fallback to model field
    if (changeset.model) {
      return changeset.model.toLowerCase().replace(/businessmodel|model/gi, '').trim();
    }

    return 'unknown';
  }

  /**
   * Extract feature value by key
   */
  private extractFeatureValue(changeset: any, key: string): number | undefined {
    const feature = changeset.features?.find((f: any) => f.key === key);
    if (feature && typeof feature.value === 'number') {
      return feature.value;
    }
    if (feature && !isNaN(Number(feature.value))) {
      return Number(feature.value);
    }
    return undefined;
  }

  /**
   * Estimate pod count based on services and replicas
   */
  private estimatePodCount(changeset: any): number {
    const serviceCount = changeset.impacted_services?.length || 0;
    const replicasFeature = changeset.features?.find((f: any) => f.key === 'replicas');
    const replicas = replicasFeature ? Number(replicasFeature.value) || 1 : 1;

    // Base estimation: each service gets 1-2 replicas
    return serviceCount * Math.max(1, replicas);
  }
}
