import { Injectable, Logger } from '@nestjs/common';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import * as yaml from 'js-yaml';
import { CodeSearchService } from './code-search.service';
import { HelmIntegrationService } from './helm-integration.service';
import { ConfigService } from '@nestjs/config';

/**
 * Dynamic Changeset Generation Service
 * Uses RAG to discover available services and generate custom changesets
 * WITH optional Helm dry-run validation and deployment
 */

export interface DynamicService {
  name: string;
  enabled: boolean;
  replicaCount?: number;
  needsRestart?: boolean;
  confidence?: number; // From RAG search
}

export interface DynamicChangeset {
  timestamp: string;
  intent: string;
  from_model?: string;
  to_model?: string;
  discovered_services: string[]; // All services found by RAG
  services: DynamicService[];
  risk_level: 'low' | 'medium' | 'high';
  auto_generated: boolean;
}

export interface DynamicChangesetGenerationRequest {
  user_intent: string;
  current_model?: string;
  target_model?: string;
  force_services?: string[]; // Optional: force include specific services
  exclude_services?: string[]; // Optional: force exclude specific services
  dry_run?: boolean; // Optional: validate with Helm --dry-run
  deploy_after_validation?: boolean; // Optional: deploy if validation passes
  tenant_id?: string; // Optional: tenant ID
}

/**
 * Helm validation results
 */
export interface HelmValidationResults {
  validation_passed: boolean;
  databases_output?: string;
  services_output?: string;
  validation_errors: string[];
  warnings: string[];
}

/**
 * Full response including validation and deployment status
 */
export interface DynamicChangesetFullResponse {
  success: boolean;
  changeset?: DynamicChangeset;
  jsonPath?: string;
  yamlPath?: string;
  error?: string;
  helm_validation?: HelmValidationResults;
  deployed?: boolean;
  fallback_available?: boolean;
  fallback_models?: string[];
}

@Injectable()
export class DynamicChangesetService {
  private readonly logger = new Logger(DynamicChangesetService.name);
  private readonly outputDir: string;
  private readonly helmChartsPath: string;
  private readonly validModels = ['retail', 'subscription', 'freemium', 'multi'];

  constructor(
    private readonly codeSearchService: CodeSearchService,
    private readonly helmIntegrationService: HelmIntegrationService,
    private readonly configService: ConfigService,
  ) {
    // Output directory: nexora-core-services/bmms/llm_output/dynamic_changesets/
    this.outputDir = join(process.cwd(), 'llm_output', 'dynamic_changesets');
    this.helmChartsPath = this.configService.get<string>('HELM_CHARTS_PATH', '/app/helm-charts');
  }

  /**
   * Generate dynamic changeset based on user intent and RAG discovery
   * This is the main entry point for dynamic generation
   * Now supports Helm validation and automatic deployment
   */
  async generateDynamicChangeset(
    request: DynamicChangesetGenerationRequest,
  ): Promise<DynamicChangesetFullResponse> {
    try {
      this.logger.log(`[DynamicChangeset] Starting generation for: "${request.user_intent}"`);
      this.logger.log(`[DynamicChangeset] Options: dry_run=${request.dry_run}, deploy_after_validation=${request.deploy_after_validation}`);

      // Step 1: Use RAG to discover all available services in codebase
      const discoveredServices = await this.discoverServicesViaRAG(request.user_intent);
      this.logger.log(`[DynamicChangeset] Discovered ${discoveredServices.length} services via RAG`);

      // Step 2: Analyze intent to determine which services should be enabled/disabled
      const analyzedServices = await this.analyzeServiceRequirements(
        request,
        discoveredServices,
      );

      // Step 3: Determine risk level based on changes
      const riskLevel = this.assessRiskLevel(analyzedServices, request);

      // Step 4: Build changeset
      const changeset: DynamicChangeset = {
        timestamp: new Date().toISOString(),
        intent: request.user_intent,
        from_model: request.current_model,
        to_model: request.target_model,
        discovered_services: discoveredServices.map(s => s.name),
        services: analyzedServices,
        risk_level: riskLevel,
        auto_generated: true,
      };

      // Step 5: Save to files (JSON + YAML)
      const timestamp = Date.now();
      const jsonPath = await this.saveAsJson(changeset, timestamp);
      const yamlPath = await this.saveAsYaml(changeset, timestamp);

      this.logger.log(`[DynamicChangeset] ✅ Generated successfully`);
      this.logger.log(`[DynamicChangeset]    JSON: ${jsonPath}`);
      this.logger.log(`[DynamicChangeset]    YAML: ${yamlPath}`);

      // Step 6: Helm validation (if dry_run requested)
      let helmValidation: HelmValidationResults | undefined;
      let deployed = false;

      if (request.dry_run === true) {
        this.logger.log(`[DynamicChangeset] 🔍 Running Helm dry-run validation...`);
        helmValidation = await this.validateWithHelm(changeset, yamlPath);
        
        if (!helmValidation.validation_passed) {
          this.logger.warn(`[DynamicChangeset] ❌ Helm validation FAILED`);
          return {
            success: false,
            changeset,
            jsonPath,
            yamlPath,
            error: `Helm validation failed: ${helmValidation.validation_errors.join('; ')}`,
            helm_validation: helmValidation,
            deployed: false,
            fallback_available: true,
            fallback_models: this.validModels,
          };
        }

        this.logger.log(`[DynamicChangeset] ✅ Helm validation PASSED`);

        // Step 7: Deploy if validation passed and deploy_after_validation is true
        if (request.deploy_after_validation === true) {
          this.logger.log(`[DynamicChangeset] 🚀 Deploying to K8s cluster...`);
          try {
            deployed = await this.deployChangeset(changeset, yamlPath);
            this.logger.log(`[DynamicChangeset] ✅ Deployment ${deployed ? 'SUCCEEDED' : 'FAILED'}`);
          } catch (deployError: any) {
            this.logger.error(`[DynamicChangeset] ❌ Deployment failed: ${deployError.message}`);
            return {
              success: false,
              changeset,
              jsonPath,
              yamlPath,
              error: `Deployment failed: ${deployError.message}`,
              helm_validation: helmValidation,
              deployed: false,
              fallback_available: true,
              fallback_models: this.validModels,
            };
          }
        }
      }

      return {
        success: true,
        changeset,
        jsonPath,
        yamlPath,
        helm_validation: helmValidation,
        deployed,
        fallback_available: !deployed && helmValidation?.validation_passed !== true,
        fallback_models: this.validModels,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[DynamicChangeset] Error: ${message}`);
      return {
        success: false,
        error: message,
        fallback_available: true,
        fallback_models: this.validModels,
      };
    }
  }

  /**
   * Validate changeset with Helm --dry-run
   * Reuses logic from HelmIntegrationService
   */
  async validateWithHelm(
    changeset: DynamicChangeset,
    yamlPath: string,
  ): Promise<HelmValidationResults> {
    try {
      this.logger.log(`[DynamicChangeset] Validating with Helm dry-run...`);
      
      // Convert DynamicChangeset to HelmChangeset format
      const helmChangeset = this.convertToHelmFormat(changeset);
      
      // Save in helm format for validation
      const helmYamlPath = await this.saveHelmFormatYaml(helmChangeset, yamlPath);
      
      // Use HelmIntegrationService to run dry-run
      // Create mock LLM response with the changeset
      const mockLlmResponse = {
        metadata: {
          to_model: changeset.to_model || 'custom',
        },
        changeset: {
          features: [
            { key: 'business_model', value: changeset.to_model || 'custom' },
          ],
        },
      };
      
      const result = await this.helmIntegrationService.triggerDeployment(mockLlmResponse, true);
      
      return {
        validation_passed: result.helmDryRunResults?.validationPassed ?? false,
        databases_output: result.helmDryRunResults?.databasesOutput || '',
        services_output: result.helmDryRunResults?.servicesOutput || '',
        validation_errors: result.helmDryRunResults?.validationErrors || [],
        warnings: result.helmDryRunResults?.warnings || [],
      };
    } catch (error: any) {
      this.logger.error(`[DynamicChangeset] Helm validation error: ${error.message}`);
      return {
        validation_passed: false,
        validation_errors: [error.message],
        warnings: [],
      };
    }
  }

  /**
   * Deploy changeset to K8s cluster
   */
  async deployChangeset(
    changeset: DynamicChangeset,
    yamlPath: string,
  ): Promise<boolean> {
    try {
      this.logger.log(`[DynamicChangeset] Deploying changeset...`);
      
      // Create mock LLM response with the changeset
      const mockLlmResponse = {
        metadata: {
          to_model: changeset.to_model || 'custom',
        },
        changeset: {
          features: [
            { key: 'business_model', value: changeset.to_model || 'custom' },
          ],
        },
      };
      
      // Deploy using HelmIntegrationService (dry_run = false)
      const result = await this.helmIntegrationService.triggerDeployment(mockLlmResponse, false);
      
      return result.deployed === true;
    } catch (error: any) {
      this.logger.error(`[DynamicChangeset] Deployment error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Convert DynamicChangeset to Helm-compatible format
   */
  private convertToHelmFormat(changeset: DynamicChangeset): any {
    const helmFormat: any = {
      global: {
        businessModel: changeset.to_model || 'custom',
      },
      services: {},
      databases: {},
    };

    // Map services
    const serviceMap: Record<string, string> = {
      orderservice: 'order',
      inventoryservice: 'inventory',
      subscriptionservice: 'subscription',
      promotionservice: 'promotion',
      pricingservice: 'pricing',
      billingservice: 'billing',
      paymentservice: 'payment',
    };

    for (const service of changeset.services) {
      const normalizedName = service.name.toLowerCase().replace('service', '');
      const helmName = serviceMap[service.name.toLowerCase()] || normalizedName;
      
      helmFormat.services[helmName] = {
        enabled: service.enabled,
        ...(service.replicaCount && { replicaCount: service.replicaCount }),
      };

      // Auto-create database entry
      if (service.enabled) {
        helmFormat.databases[`${helmName}db`] = {
          enabled: true,
        };
      }
    }

    return helmFormat;
  }

  /**
   * Save Helm-format YAML for validation
   */
  private async saveHelmFormatYaml(helmChangeset: any, originalPath: string): Promise<string> {
    const helmPath = originalPath.replace('.yaml', '-helm.yaml');
    const yamlContent = yaml.dump(helmChangeset, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });
    await writeFile(helmPath, yamlContent, 'utf8');
    return helmPath;
  }

  /**
   * Use RAG (Code Search) to discover available services in the codebase
   * Searches for NestJS services, Docker services, Kubernetes deployments, etc.
   */
  private async discoverServicesViaRAG(intent: string): Promise<DynamicService[]> {
    const services: DynamicService[] = [];

    // Search patterns to find services
    const searchQueries = [
      'NestJS service @Injectable',
      'Docker service container',
      'Kubernetes deployment service',
      'microservice architecture',
      intent, // Also search based on user intent
    ];

    const allResults: any[] = [];

    for (const query of searchQueries) {
      const results = await this.codeSearchService.searchRelevantCode(query, 10);
      allResults.push(...results);
    }

    // Extract service names from code search results
    const serviceNames = new Set<string>();
    const servicePattern = /(?:class|service|export)\s+(\w+Service)/gi;
    const dockerPattern = /(?:service|container):\s*(\w+(?:-\w+)*)/gi;

    for (const result of allResults) {
      // Extract from TypeScript class names
      let match;
      while ((match = servicePattern.exec(result.content)) !== null) {
        serviceNames.add(match[1]);
      }

      // Extract from Docker compose
      while ((match = dockerPattern.exec(result.content)) !== null) {
        const serviceName = match[1]
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join('');
        serviceNames.add(serviceName + 'Service');
      }

      // Extract from file paths
      if (result.file_path.includes('apps/')) {
        const pathParts = result.file_path.split('/');
        const appIndex = pathParts.indexOf('apps');
        if (appIndex >= 0 && pathParts.length > appIndex + 1) {
          const appName = pathParts[appIndex + 1];
          const serviceName = appName
            .split('-')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join('') + 'Service';
          serviceNames.add(serviceName);
        }
      }
    }

    // Convert to DynamicService objects
    for (const name of serviceNames) {
      services.push({
        name,
        enabled: false, // Will be determined in next step
        confidence: this.calculateServiceConfidence(name, allResults),
      });
    }

    // Always include core services that we know exist
    const coreServices = [
      'OrderService',
      'InventoryService',
      'SubscriptionService',
      'PromotionService',
      'PricingService',
      'BillingService',
      'PaymentService',
      'CatalogueService',
      'CustomerService',
      'AuthService',
      'APIGatewayService',
      'CRMOrchestratorService',
    ];

    for (const coreName of coreServices) {
      if (!services.some(s => s.name === coreName)) {
        services.push({
          name: coreName,
          enabled: false,
          confidence: 1.0, // High confidence for core services
        });
      }
    }

    return services.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  }

  /**
   * Calculate confidence score for a service based on RAG results
   */
  private calculateServiceConfidence(serviceName: string, ragResults: any[]): number {
    let score = 0;
    const normalizedName = serviceName.toLowerCase().replace('service', '');

    for (const result of ragResults) {
      const content = result.content.toLowerCase();
      if (content.includes(serviceName.toLowerCase())) {
        score += result.score || 0.5;
      }
      if (content.includes(normalizedName)) {
        score += 0.3;
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Analyze which services should be enabled/disabled based on intent
   */
  private async analyzeServiceRequirements(
    request: DynamicChangesetGenerationRequest,
    discoveredServices: DynamicService[],
  ): Promise<DynamicService[]> {
    const intent = request.user_intent.toLowerCase();
    const analyzedServices: DynamicService[] = [];

    // Apply force include/exclude
    const forceInclude = new Set(request.force_services || []);
    const forceExclude = new Set(request.exclude_services || []);

    for (const service of discoveredServices) {
      const serviceLower = service.name.toLowerCase();
      let enabled = false;
      let needsRestart = false;

      // Force rules first
      if (forceInclude.has(service.name)) {
        enabled = true;
      } else if (forceExclude.has(service.name)) {
        enabled = false;
      } else {
        // Intent-based analysis
        // Check if service is mentioned in intent
        if (intent.includes(serviceLower.replace('service', ''))) {
          enabled = true;
        }

        // Model-based defaults
        if (request.target_model) {
          switch (request.target_model) {
            case 'retail':
              enabled = ['order', 'inventory', 'catalogue', 'billing', 'payment'].some(
                keyword => serviceLower.includes(keyword),
              );
              break;
            case 'subscription':
              enabled = ['subscription', 'promotion', 'pricing', 'billing', 'payment'].some(
                keyword => serviceLower.includes(keyword),
              );
              break;
            case 'freemium':
              enabled = ['subscription', 'promotion', 'pricing', 'auth'].some(
                keyword => serviceLower.includes(keyword),
              );
              break;
            case 'multi':
              enabled = true; // Enable all for multi-model
              break;
          }
        }

        // Core services always on (unless explicitly excluded)
        if (['auth', 'gateway', 'customer', 'catalogue'].some(
          keyword => serviceLower.includes(keyword),
        )) {
          enabled = true;
        }

        // Detect if restart is needed (pricing, billing changes)
        if (intent.includes('giá') || intent.includes('price') || intent.includes('billing')) {
          if (['billing', 'payment', 'pricing'].some(keyword => serviceLower.includes(keyword))) {
            needsRestart = true;
          }
        }
      }

      analyzedServices.push({
        ...service,
        enabled,
        needsRestart,
      });
    }

    return analyzedServices;
  }

  /**
   * Assess risk level based on what services are being changed
   */
  private assessRiskLevel(
    services: DynamicService[],
    request: DynamicChangesetGenerationRequest,
  ): 'low' | 'medium' | 'high' {
    const intent = request.user_intent.toLowerCase();

    // HIGH RISK keywords
    if (/xóa|delete|drop|remove|destroy/i.test(intent)) {
      return 'high';
    }

    // Check critical services being disabled
    const criticalServices = ['billing', 'payment', 'auth', 'customer'];
    const disablingCritical = services.some(
      s => !s.enabled && criticalServices.some(c => s.name.toLowerCase().includes(c)),
    );

    if (disablingCritical) {
      return 'high';
    }

    // MEDIUM RISK: pricing/billing changes
    if (/giá|price|billing|thanh toán/i.test(intent)) {
      return 'medium';
    }

    // Check number of services affected
    const changedCount = services.filter(s => s.needsRestart || s.enabled).length;
    if (changedCount > 5) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Save changeset as JSON file
   */
  private async saveAsJson(changeset: DynamicChangeset, timestamp: number): Promise<string> {
    await mkdir(this.outputDir, { recursive: true });
    const filePath = join(this.outputDir, `dynamic-changeset-${timestamp}.json`);
    await writeFile(filePath, JSON.stringify(changeset, null, 2), 'utf8');
    return filePath;
  }

  /**
   * Save changeset as YAML file (Helm-compatible format)
   */
  private async saveAsYaml(changeset: DynamicChangeset, timestamp: number): Promise<string> {
    await mkdir(this.outputDir, { recursive: true });
    
    // Convert to Helm-compatible YAML structure
    const helmFormat: any = {
      metadata: {
        generated_at: changeset.timestamp,
        intent: changeset.intent,
        risk_level: changeset.risk_level,
        auto_generated: changeset.auto_generated,
        from_model: changeset.from_model,
        to_model: changeset.to_model,
      },
      global: {
        businessModel: changeset.to_model || 'custom',
      },
      services: {},
      databases: {},
    };

    // Add services
    for (const service of changeset.services) {
      const serviceName = service.name.replace('Service', '').toLowerCase();
      helmFormat.services[serviceName] = {
        enabled: service.enabled,
        ...(service.replicaCount && { replicaCount: service.replicaCount }),
        ...(service.needsRestart && { needsRestart: service.needsRestart }),
      };

      // Auto-create database entry if service is enabled
      if (service.enabled) {
        helmFormat.databases[`${serviceName}db`] = {
          enabled: true,
        };
      }
    }

    const filePath = join(this.outputDir, `dynamic-changeset-${timestamp}.yaml`);
    const yamlContent = yaml.dump(helmFormat, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });

    await writeFile(filePath, yamlContent, 'utf8');
    return filePath;
  }
}
