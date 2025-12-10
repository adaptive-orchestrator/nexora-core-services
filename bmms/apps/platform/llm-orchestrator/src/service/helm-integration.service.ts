import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import * as yaml from 'js-yaml';

const execAsync = promisify(exec);

/**
 * Business Model types supported by Helm charts
 */
export type BusinessModel = 'retail' | 'subscription' | 'multi' | 'freemium';

/**
 * Changeset structure for Helm deployment
 */
export interface HelmChangeset {
  global: {
    businessModel: BusinessModel;
  };
  services: {
    order: { enabled: boolean; replicaCount?: number };
    inventory: { enabled: boolean; replicaCount?: number };
    subscription: { enabled: boolean; replicaCount?: number };
    promotion: { enabled: boolean; replicaCount?: number };
    pricing: { enabled: boolean; replicaCount?: number };
  };
  databases: {
    orderdb: { enabled: boolean };
    inventorydb: { enabled: boolean };
    subscriptiondb: { enabled: boolean };
    promotiondb: { enabled: boolean };
    pricingdb: { enabled: boolean };
  };
}

/**
 * Service profiles - which services run per business model
 */
const SERVICE_PROFILES: Record<BusinessModel, string[]> = {
  retail: ['order', 'inventory'],
  subscription: ['subscription', 'promotion', 'pricing'],
  freemium: ['subscription', 'promotion', 'pricing'],
  multi: ['order', 'inventory', 'subscription', 'promotion', 'pricing'],
};

@Injectable()
export class HelmIntegrationService {
  private readonly logger = new Logger(HelmIntegrationService.name);
  private readonly helmChartsPath: string;
  private readonly changesetsPath: string;
  private readonly autoDeployEnabled: boolean;
  private readonly defaultDryRun: boolean;

  constructor(private configService: ConfigService) {
    // Path to helm charts in infrastructure repo
    // Mount path: /app/helm-charts → infrastructure/aws/project-1/Cloudformation/k8s-generated/helm
    this.helmChartsPath = this.configService.get<string>(
      'HELM_CHARTS_PATH',
      '/app/helm-charts',
    );
    // Changesets directory for switch-to-{model}.yaml files
    this.changesetsPath = join(this.helmChartsPath, 'changesets');
    
    // Auto-deploy: if true, will execute helm upgrade commands
    this.autoDeployEnabled = this.configService.get<boolean>(
      'AUTO_DEPLOY_ENABLED',
      false,
    );
    
    // Default dry-run mode: if true, triggerDeployment defaults to dry-run
    this.defaultDryRun = this.configService.get<boolean>(
      'DEFAULT_DRY_RUN',
      true,
    );
    
    // Log configuration on startup
    this.logger.log(`[HelmIntegration] Initialized with:`);
    this.logger.log(`  - HELM_CHARTS_PATH: ${this.helmChartsPath}`);
    this.logger.log(`  - CHANGESETS_PATH: ${this.changesetsPath}`);
    this.logger.log(`  - AUTO_DEPLOY_ENABLED: ${this.autoDeployEnabled}`);
    this.logger.log(`  - DEFAULT_DRY_RUN: ${this.defaultDryRun}`);
  }

  /**
   * Get current Helm configuration paths
   * Useful for debugging and health checks
   */
  getConfiguration(): {
    helmChartsPath: string;
    changesetsPath: string;
    autoDeployEnabled: boolean;
    defaultDryRun: boolean;
  } {
    return {
      helmChartsPath: this.helmChartsPath,
      changesetsPath: this.changesetsPath,
      autoDeployEnabled: this.autoDeployEnabled,
      defaultDryRun: this.defaultDryRun,
    };
  }

  /**
   * Generate Helm changeset YAML from LLM output
   * @param llmResponse - Response from Gemini LLM
   * @returns Generated changeset
   */
  generateChangeset(llmResponse: any): HelmChangeset {
    // Extract business model from LLM response
    const businessModel = this.extractBusinessModel(llmResponse);
    const enabledServices = SERVICE_PROFILES[businessModel];

    this.logger.log(`[LLM] Generating changeset for business model: ${businessModel}`);
    this.logger.log(`   Enabled services: ${enabledServices.join(', ')}`);

    const changeset: HelmChangeset = {
      global: {
        businessModel,
      },
      services: {
        order: { enabled: enabledServices.includes('order') },
        inventory: { enabled: enabledServices.includes('inventory') },
        subscription: { enabled: enabledServices.includes('subscription') },
        promotion: { enabled: enabledServices.includes('promotion') },
        pricing: { enabled: enabledServices.includes('pricing') },
      },
      databases: {
        orderdb: { enabled: enabledServices.includes('order') },
        inventorydb: { enabled: enabledServices.includes('inventory') },
        subscriptiondb: { enabled: enabledServices.includes('subscription') },
        promotiondb: { enabled: enabledServices.includes('promotion') },
        pricingdb: { enabled: enabledServices.includes('pricing') },
      },
    };

    // Add replica counts if specified in LLM response
    this.applyReplicaCounts(changeset, llmResponse);

    return changeset;
  }

  /**
   * Extract business model from LLM response
   */
  private extractBusinessModel(llmResponse: any): BusinessModel {
    // Try to get from metadata.to_model
    if (llmResponse.metadata?.to_model) {
      const model = llmResponse.metadata.to_model.toLowerCase();
      if (this.isValidBusinessModel(model)) {
        return model as BusinessModel;
      }
    }

    // Try to get from changeset.features
    const businessModelFeature = llmResponse.changeset?.features?.find(
      (f: any) => f.key === 'business_model',
    );
    if (businessModelFeature) {
      const model = String(businessModelFeature.value).toLowerCase();
      if (this.isValidBusinessModel(model)) {
        return model as BusinessModel;
      }
    }

    // Default to retail
    this.logger.warn('[WARNING] Could not determine business model, defaulting to retail');
    return 'retail';
  }

  /**
   * Check if model is valid
   */
  private isValidBusinessModel(model: string): boolean {
    return ['retail', 'subscription', 'multi', 'freemium'].includes(model);
  }

  /**
   * Apply replica counts from LLM response
   */
  private applyReplicaCounts(changeset: HelmChangeset, llmResponse: any): void {
    const features = llmResponse.changeset?.features || [];
    const validServiceNames: (keyof HelmChangeset['services'])[] = ['order', 'inventory', 'subscription', 'promotion', 'pricing'];

    for (const feature of features) {
      if (feature.key.endsWith('_replicas')) {
        const serviceName = feature.key.replace('_replicas', '') as keyof HelmChangeset['services'];
        if (validServiceNames.includes(serviceName) && changeset.services[serviceName]) {
          changeset.services[serviceName].replicaCount = Number(feature.value);
        }
      }
    }
  }

  /**
   * Save changeset YAML to file
   * Saves to helmChartsPath/changesets/ with format switch-to-{model}.yaml
   * Compatible with infrastructure repo's update_model.sh script
   * @param changeset - Helm changeset
   * @param filename - Optional custom filename
   * @returns Path to saved file
   */
  async saveChangeset(changeset: HelmChangeset, filename?: string): Promise<string> {
    // Use switch-to-{model}.yaml format to be compatible with infrastructure scripts
    // Or use changeset-{model}-{timestamp}.yaml if filename provided
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = filename || `switch-to-${changeset.global.businessModel}.yaml`;
    // Save to changesets/ directory inside helmChartsPath
    const filePath = join(this.changesetsPath, file);

    // Create directory if not exists
    await mkdir(this.changesetsPath, { recursive: true });

    // Convert to YAML and save
    const yamlContent = yaml.dump(changeset, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });

    await writeFile(filePath, yamlContent, 'utf8');
    this.logger.log(`[LLM] Saved changeset to: ${filePath}`);

    return filePath;
  }

  /**
   * Trigger Helm deployment using shell command
   * @param llmResponse - LLM response containing changeset
   * @param dryRun - If true, only generate files without deploying (uses DEFAULT_DRY_RUN env if not specified)
   */
  async triggerDeployment(llmResponse: any, dryRun?: boolean): Promise<any> {
    // Use provided dryRun value, or fall back to defaultDryRun config
    const isDryRun = dryRun ?? this.defaultDryRun;
    const mode = isDryRun ? 'DRY-RUN' : 'DEPLOY';
    this.logger.log(`[LLM] [${mode}] Starting Helm deployment...`);

    try {
      // 1. Generate changeset from LLM response
      const changeset = this.generateChangeset(llmResponse);

      // 2. Save changeset to file
      const changesetPath = await this.saveChangeset(changeset);

      // 3. If dry run, just return the changeset
      if (isDryRun) {
        this.logger.log(`[LLM] [DRY-RUN] Changeset generated and saved to: ${changesetPath}`);
        return {
          success: true,
          dryRun: true,
          changeset,
          changesetPath,
          message: `Changeset generated (dry-run mode). File saved to: ${changesetPath}`,
        };
      }

      // 4. Check if auto-deploy is enabled
      if (!this.autoDeployEnabled) {
        this.logger.warn('[WARNING] Auto-deploy is disabled. Changeset saved but not applied.');
        return {
          success: true,
          deployed: false,
          changeset,
          changesetPath,
          message: 'Auto-deploy disabled. Changeset saved for manual deployment.',
        };
      }

      // 5. Execute Helm deployment
      const deployResult = await this.executeHelmDeployment(changeset, changesetPath);

      return {
        success: true,
        deployed: true,
        changeset,
        changesetPath,
        deployResult,
        message: 'Deployment completed successfully',
      };
    } catch (error: any) {
      this.logger.error(`[ERROR] Deployment failed: ${error.message}`);
      return {
        success: false,
        deployed: false,
        error: error.message,
      };
    }
  }

  /**
   * Execute Helm upgrade/install commands
   */
  private async executeHelmDeployment(
    changeset: HelmChangeset,
    changesetPath: string,
  ): Promise<any> {
    const results: any[] = [];

    try {
      // Step 1: Deploy databases
      this.logger.log('[LLM] Step 1/2: Deploying databases...');
      const dbResult = await this.helmUpgrade(
        'databases',
        join(this.helmChartsPath, 'databases'),
        'database',
        changesetPath,
      );
      results.push({ component: 'databases', ...dbResult });

      // Step 2: Deploy dynamic services
      this.logger.log('[LLM] Step 2/2: Deploying dynamic services...');
      const svcResult = await this.helmUpgrade(
        'dynamic-services',
        join(this.helmChartsPath, 'dynamic-services'),
        'business-services',
        changesetPath,
      );
      results.push({ component: 'dynamic-services', ...svcResult });

      this.logger.log('[LLM] Helm deployment completed successfully');
      return { success: true, results };
    } catch (error: any) {
      this.logger.error(`[ERROR] Helm deployment failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute helm upgrade --install command
   */
  private async helmUpgrade(
    releaseName: string,
    chartPath: string,
    namespace: string,
    valuesFile: string,
  ): Promise<any> {
    const command = [
      'helm upgrade --install',
      releaseName,
      chartPath,
      `--namespace ${namespace}`,
      '--create-namespace',
      `-f "${valuesFile}"`,
      '--wait',
      '--timeout 10m',
    ].join(' ');

    this.logger.log(`[LLM] Executing: ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 600000, // 10 minutes
      });

      if (stderr && !stderr.includes('WARNING')) {
        this.logger.warn(`Helm stderr: ${stderr}`);
      }

      return {
        success: true,
        output: stdout,
      };
    } catch (error: any) {
      this.logger.error(`Helm command failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        stderr: error.stderr,
      };
    }
  }

  /**
   * Check Helm release status
   */
  async getHelmStatus(releaseName: string, namespace: string): Promise<any> {
    try {
      const { stdout } = await execAsync(
        `helm status ${releaseName} -n ${namespace} -o json`,
      );
      return JSON.parse(stdout);
    } catch (error: any) {
      this.logger.error(`Failed to get Helm status: ${error.message}`);
      throw error;
    }
  }

  /**
   * List all Helm releases
   */
  async listHelmReleases(): Promise<any> {
    try {
      const { stdout } = await execAsync('helm list -A -o json');
      return JSON.parse(stdout);
    } catch (error: any) {
      this.logger.error(`Failed to list Helm releases: ${error.message}`);
      throw error;
    }
  }

  /**
   * Rollback Helm release
   */
  async rollbackRelease(releaseName: string, namespace: string, revision?: number): Promise<any> {
    try {
      const revisionArg = revision ? ` ${revision}` : '';
      const { stdout } = await execAsync(
        `helm rollback ${releaseName}${revisionArg} -n ${namespace} --wait`,
      );
      return { success: true, output: stdout };
    } catch (error: any) {
      this.logger.error(`Failed to rollback: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get deployment diff (helm diff plugin required)
   */
  async getDeploymentDiff(
    changeset: HelmChangeset,
    changesetPath: string,
  ): Promise<string> {
    try {
      // Try to use helm-diff plugin
      const { stdout } = await execAsync(
        `helm diff upgrade dynamic-services ${join(this.helmChartsPath, 'dynamic-services')} -n business-services -f "${changesetPath}"`,
      );
      return stdout;
    } catch (error: any) {
      // If helm-diff not installed, return a simple message
      this.logger.warn('helm-diff plugin not available, skipping diff');
      return 'Diff not available (helm-diff plugin not installed)';
    }
  }
}
