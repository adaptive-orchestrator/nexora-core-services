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
   * @param dryRun - If true, execute helm --dry-run to validate without deploying
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

      // 3. If dry run, execute Helm --dry-run for validation
      if (isDryRun) {
        this.logger.log(`[LLM] [DRY-RUN] Executing Helm dry-run validation...`);
        
        const kubeEnv = await this.setupInClusterAuth();
        const validationErrors: string[] = [];
        const warnings: string[] = [];
        
        // Test databases deployment with --dry-run
        const dbDryRun = await this.helmUpgrade(
          'databases',
          join(this.helmChartsPath, 'databases'),
          'database',
          changesetPath,
          kubeEnv,
          true, // dryRun = true
        );
        
        // Test services deployment with --dry-run
        const svcDryRun = await this.helmUpgrade(
          'dynamic-services',
          join(this.helmChartsPath, 'dynamic-services'),
          'business-services',
          changesetPath,
          kubeEnv,
          true, // dryRun = true
        );
        
        // Collect validation errors
        if (!dbDryRun.success) {
          validationErrors.push(`Databases validation failed: ${dbDryRun.error}`);
        }
        if (!svcDryRun.success) {
          validationErrors.push(`Services validation failed: ${svcDryRun.error}`);
        }
        
        // Parse warnings from stderr
        if (dbDryRun.stderr) {
          const dbWarnings = dbDryRun.stderr.split('\n').filter((line: string) => line.includes('WARNING'));
          warnings.push(...dbWarnings);
        }
        if (svcDryRun.stderr) {
          const svcWarnings = svcDryRun.stderr.split('\n').filter((line: string) => line.includes('WARNING'));
          warnings.push(...svcWarnings);
        }
        
        const validationPassed = validationErrors.length === 0;
        
        this.logger.log(`[LLM] [DRY-RUN] Validation ${validationPassed ? 'PASSED' : 'FAILED'}`);
        if (validationErrors.length > 0) {
          this.logger.error(`[LLM] [DRY-RUN] Errors: ${validationErrors.join('; ')}`);
        }
        
        return {
          success: true,
          dryRun: true,
          changeset,
          changesetPath,
          helmDryRunResults: {
            validationPassed,
            databasesOutput: dbDryRun.renderedManifests || dbDryRun.output || '',
            servicesOutput: svcDryRun.renderedManifests || svcDryRun.output || '',
            validationErrors,
            warnings,
          },
          message: validationPassed 
            ? 'Helm dry-run validation PASSED. No resources were modified.' 
            : 'Helm dry-run validation FAILED. See errors for details.',
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

      // 5. Execute Helm deployment (real)
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

    // Setup in-cluster authentication ONCE for all kubectl/helm commands
    const kubeEnv = await this.setupInClusterAuth();

    try {
      // Step 0: Delete disabled services BEFORE helm upgrade
      this.logger.log('[LLM] Step 0: Cleaning up disabled services...');
      await this.deleteDisabledServices(changeset);

      // Step 1: Deploy databases
      this.logger.log('[LLM] Step 1/3: Deploying databases...');
      const dbResult = await this.helmUpgrade(
        'databases',
        join(this.helmChartsPath, 'databases'),
        'database',
        changesetPath,
        kubeEnv,
      );
      results.push({ component: 'databases', ...dbResult });

      // Step 2: Deploy dynamic services
      this.logger.log('[LLM] Step 2/3: Deploying dynamic services...');
      const svcResult = await this.helmUpgrade(
        'dynamic-services',
        join(this.helmChartsPath, 'dynamic-services'),
        'business-services',
        changesetPath,
        kubeEnv,
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
   * Setup in-cluster authentication for kubectl/helm
   */
  private async setupInClusterAuth(): Promise<NodeJS.ProcessEnv> {
    const kubeEnv = {
      KUBECONFIG: '/tmp/kubeconfig',
      ...process.env,
    };

    // Create kubeconfig for in-cluster authentication
    const kubeconfigContent = `
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    server: https://kubernetes.default.svc
  name: default-cluster
contexts:
- context:
    cluster: default-cluster
    namespace: default
    user: default-user
  name: default-context
current-context: default-context
users:
- name: default-user
  user:
    tokenFile: /var/run/secrets/kubernetes.io/serviceaccount/token
`;

    try {
      await writeFile('/tmp/kubeconfig', kubeconfigContent, 'utf8');
      this.logger.log('[LLM] ✓ Created in-cluster kubeconfig at /tmp/kubeconfig');
    } catch (error) {
      this.logger.warn('[LLM] ⚠ Failed to create kubeconfig, using default');
    }

    return kubeEnv;
  }

  /**
   * Delete disabled services and databases
   * This is necessary because Helm's {{- if .enabled }} doesn't delete existing resources
   */
  private async deleteDisabledServices(changeset: HelmChangeset): Promise<void> {
    const servicesToDelete: string[] = [];
    const databasesToDelete: string[] = [];

    // Find disabled services
    for (const [serviceName, config] of Object.entries(changeset.services)) {
      if (!config.enabled) {
        servicesToDelete.push(`${serviceName}-service`);
      }
    }

    // Find disabled databases
    for (const [dbName, config] of Object.entries(changeset.databases)) {
      if (!config.enabled) {
        databasesToDelete.push(dbName);
      }
    }

    this.logger.log(`[LLM] Services to delete: ${servicesToDelete.join(', ') || 'none'}`);
    this.logger.log(`[LLM] Databases to delete: ${databasesToDelete.join(', ') || 'none'}`);

    // Delete disabled services
    for (const service of servicesToDelete) {
      try {
        await execAsync(`kubectl delete deployment ${service} -n business-services --ignore-not-found=true`);
        this.logger.log(`[LLM]   ✓ Deleted deployment: ${service}`);
      } catch (error: any) {
        this.logger.warn(`[LLM]   ! Failed to delete ${service}: ${error.message}`);
      }
    }

    // Delete disabled databases (StatefulSets)
    for (const db of databasesToDelete) {
      try {
        await execAsync(`kubectl delete statefulset ${db} -n database --ignore-not-found=true`);
        this.logger.log(`[LLM]   ✓ Deleted statefulset: ${db}`);
      } catch (error: any) {
        this.logger.warn(`[LLM]   ! Failed to delete ${db}: ${error.message}`);
      }
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
    kubeEnv: NodeJS.ProcessEnv,
    dryRun = false,  // Add dry-run parameter
  ): Promise<any> {
    const dryRunFlags = dryRun ? '--dry-run --debug' : '--wait --timeout 10m';
    const command = [
      'helm upgrade --install',
      releaseName,
      chartPath,
      `--namespace ${namespace}`,
      '--create-namespace',
      `-f "${valuesFile}"`,
      dryRunFlags,
    ].join(' ');

    this.logger.log(`[LLM] ${dryRun ? '[DRY-RUN] ' : ''}Executing: ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: dryRun ? 60000 : 600000, // 1 minute for dry-run, 10 minutes for real deploy
        env: kubeEnv,
      });

      if (stderr && !stderr.includes('WARNING')) {
        this.logger.warn(`Helm stderr: ${stderr}`);
      }

      return {
        success: true,
        output: stdout,
        dryRun,
        renderedManifests: dryRun ? stdout : null, // Contains all rendered YAML in dry-run mode
      };
    } catch (error: any) {
      this.logger.error(`Helm command failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        stderr: error.stderr,
        dryRun,
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
