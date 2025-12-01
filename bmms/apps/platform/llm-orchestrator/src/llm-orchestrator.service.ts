import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { mkdir, writeFile } from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { LlmChatResponse } from './llm-orchestrator/llm-orchestrator.interface';
import { CodeSearchService } from './service/code-search.service';
import { LlmOutputValidator } from './validators/llm-output.validator';
import { K8sIntegrationService } from './service/k8s-integration.service';
import { debug } from '@bmms/common';

const LLMReplySchema = z.object({
  proposal_text: z.string(),
  changeset: z.object({
    model: z.string(),
    features: z.array(
      z.object({
        key: z.string(),
        value: z.union([z.string(), z.number(), z.boolean()]),
      }),
    ),
    impacted_services: z.array(z.string()),
  }),
  metadata: z.object({
    intent: z.string(),
    confidence: z.number(),
    risk: z.enum(['low', 'medium', 'high']),
  }),
});

type LLMReply = z.infer<typeof LLMReplySchema>;

const SYSTEM_PROMPT = `You are an expert business analyst that converts Vietnamese business model requests into JSON ChangeSet for Kubernetes deployment automation.

**BUSINESS MODELS:**
1. **Retail Model**: One-time purchase, inventory management
   - Required services: OrderService, InventoryService
   - BillingService mode: ONETIME
   - Note: 1 OrderService handles ALL retail products via database (product_id)
   
2. **Subscription Model**: Recurring payment, subscription plans
   - Required services: SubscriptionService, PromotionService
   - BillingService mode: RECURRING
   - Note: 1 SubscriptionService handles ALL subscription plans via database
   
3. **Freemium Model**: Free tier with optional paid add-ons
   - Required services: SubscriptionService (with is_free=true), PromotionService
   - BillingService mode: FREEMIUM (free base + pay for add-ons)
   - Add-ons: Extra storage, premium features, etc. (charged separately)
   - Note: Same SubscriptionService handles free users + add-on purchases
   
4. **Freemium + Add-on Model**: Free base plan with purchasable add-ons
   - Base plan: Free (no billing)
   - Add-ons: Paid features billed separately (e.g., extra storage, AI features)
   - BillingService mode: ADDON (only bill for add-ons, not base subscription)
   
5. **Multi-Model**: Support multiple models simultaneously
   - Required services: ALL of the above
   - BillingService mode: HYBRID (handle all billing types)
   - Note: SHARED SERVICE PATTERN - Each service type deploys ONCE, not per product
   - Example: 2 retail products + 1 subscription → Still only 1 OrderService, 1 SubscriptionService

**CORE SERVICES (always needed):**
- AuthService, CustomerService, CRMOrchestratorService
- APIGatewayService
- CatalogueService (Product domain)
- BillingService, PaymentService (Finance domain)

**SERVICE MAPPING:**
- OrderService → order-svc (namespace: order, port: 3011)
- InventoryService → inventory-svc (namespace: order, port: 3013)
- SubscriptionService → subscription-svc (namespace: order, port: 3012)
- PromotionService → promotion-svc (namespace: product, port: 3009)
- CatalogueService → catalogue-svc (namespace: product, port: 3007)
- BillingService → billing-svc (namespace: finance, port: 3003)
- PaymentService → payment-svc (namespace: finance, port: 3015)
- AuthService → auth-svc (namespace: customer, port: 3000)
- CustomerService → customer-svc (namespace: customer, port: 3001)
- CRMOrchestratorService → crm-orchestrator (namespace: customer, port: 3002)
- APIGatewayService → api-gateway (namespace: platform, port: 3099)

**INTENT TYPES:**
- "business_model_change": Chuyển đổi từ model này sang model khác
- "business_model_expansion": Mở rộng để hỗ trợ nhiều models
- "update": Cập nhật config của services hiện tại
- "scale": Thay đổi số lượng replicas

**OUTPUT FORMAT:**
Return ONLY valid JSON in this exact format:
{
  "proposal_text": "Detailed explanation in Vietnamese about what changes are needed",
  "changeset": {
    "model": "BusinessModel|MultiBusinessModel|SubscriptionPlan|etc",
    "features": [
      {"key": "business_model", "value": "retail|subscription|freemium|multi"},
      {"key": "other_config_key", "value": "config_value"}
    ],
    "impacted_services": ["ServiceName1", "ServiceName2", ...]
  },
  "metadata": {
    "intent": "business_model_change|business_model_expansion|update|scale",
    "confidence": 0.85-0.99,
    "risk": "low|medium|high",
    "from_model": "retail|subscription|etc (if applicable)",
    "to_model": "subscription|multi|etc (if applicable)"
  }
}

**EXAMPLES:**

Example 1 - Retail to Subscription:
Input: "Chuyển sản phẩm Premium Plan sang subscription 199k/tháng"
Output: {
  "changeset": {
    "model": "BusinessModel",
    "features": [
      {"key": "business_model", "value": "subscription"},
      {"key": "subscription_price", "value": 199000}
    ],
    "impacted_services": ["SubscriptionService", "PromotionService", "BillingService", "PaymentService", "CatalogueService"]
  },
  "metadata": {
    "intent": "business_model_change",
    "from_model": "retail",
    "to_model": "subscription"
  }
}

Example 2 - Multi-Model with multiple products:
Input: "Hỗ trợ 2 retail products, 1 subscription, và 1 freemium"
Output: {
  "changeset": {
    "model": "MultiBusinessModel",
    "features": [
      {"key": "business_model", "value": "multi"},
      {"key": "supported_models", "value": "retail,subscription,freemium"},
      {"key": "retail_products_count", "value": 2},
      {"key": "subscription_plans_count", "value": 1},
      {"key": "freemium_enabled", "value": true}
    ],
    "impacted_services": ["OrderService", "InventoryService", "SubscriptionService", "PromotionService", "CatalogueService", "BillingService", "PaymentService", "APIGatewayService", "AuthService"]
  },
  "metadata": {
    "intent": "business_model_expansion",
    "to_model": "multi",
    "note": "SHARED SERVICE PATTERN: Each service in impacted_services list will be deployed ONCE (e.g., 1 OrderService handles both retail products, 1 SubscriptionService handles subscription + freemium)"
  }
}

Example 3 - Freemium with Add-ons:
Input: "Tạo gói Freemium miễn phí với 3 add-on tính phí: Extra Storage (50k/tháng), AI Assistant (100k/tháng), Priority Support (30k/tháng)"
Output: {
  "changeset": {
    "model": "FreemiumWithAddons",
    "features": [
      {"key": "business_model", "value": "freemium"},
      {"key": "base_plan_price", "value": 0},
      {"key": "addons_enabled", "value": true},
      {"key": "addon_extra_storage_price", "value": 50000},
      {"key": "addon_ai_assistant_price", "value": 100000},
      {"key": "addon_priority_support_price", "value": 30000}
    ],
    "impacted_services": ["SubscriptionService", "BillingService", "PaymentService", "CatalogueService", "AuthService"]
  },
  "metadata": {
    "intent": "business_model_change",
    "to_model": "freemium_addon",
    "billing_mode": "addon_only"
  }
}

Return ONLY the JSON, no markdown code blocks, no additional text.`;

@Injectable()
export class LlmOrchestratorService {
  [x: string]: any;
  private geminiClient: GoogleGenerativeAI;
  private useRAG = process.env.USE_RAG === 'true'; // 👈 Feature flag

  constructor(
    private codeSearchService: CodeSearchService,
    private validator: LlmOutputValidator,
    private k8sIntegrationService: K8sIntegrationService,
  ) {
    this.geminiClient = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY || '',
    );
  }

  async ask(
    message: string,
    tenant: string = 't-unknown',
    role: string = 'guest',
    lang: 'vi' | 'en' = 'vi',
  ): Promise<LlmChatResponse> {
     // 👇 RAG: Tìm code liên quan
    let codeContext = '';
    if (this.useRAG) {
      const relevantCode = await this.codeSearchService.searchRelevantCode(message, 3);
      
      if (relevantCode.length > 0) {
        codeContext = '\n\n=== RELEVANT CODE CONTEXT ===\n';
        relevantCode.forEach((code, idx) => {
          codeContext += `\n[${idx + 1}] ${code.file_path} (${code.chunk_type}${code.name ? `: ${code.name}` : ''})\n`;
          codeContext += `Score: ${code.score.toFixed(3)}\n`;
          codeContext += '```\n' + code.content.substring(0, 1000) + '\n```\n';
        });
        codeContext += '=== END CONTEXT ===\n';
      }
    }

    const content = await this.callGemini(message, tenant, role, lang, codeContext);

    // Clean code fence if present
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned
        .replace(/^```[a-zA-Z]*\n?/, '')
        .replace(/```$/, '')
        .trim();
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned
        .replace(/^```[a-zA-Z]*\n?/, '')
        .replace(/```$/, '')
        .trim();
    }

    // Write to file for debugging
    try {
      const dir = path.resolve(process.cwd(), 'llm_output');
      await mkdir(dir, { recursive: true });
      const outputPath = path.join(dir, `${Date.now()}_raw.json`);
      await writeFile(outputPath, cleaned, 'utf8');
      debug.log(`[LLM] Wrote clean JSON to: ${outputPath}`);
    } catch (err) {
      debug.error('[LLM] Failed to write output file:', err);
    }

    // Parse and validate JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = String(cleaned).match(/\{[\s\S]*\}/);
      if (!match) throw new Error('LLM did not return valid JSON');
      parsed = JSON.parse(match[0]);
    }

    const validated = LLMReplySchema.parse(parsed);

    // 👈 ADD: Business logic validation
    const validationResult = this.validator.validate(validated);
    
    if (!validationResult.isValid) {
      throw new Error(
        `LLM output validation failed:\n${validationResult.errors.join('\n')}`,
      );
    }
    
    // Log warnings if any
    if (validationResult.warnings.length > 0) {
      debug.log('[LLM Validator] Warnings:', validationResult.warnings.join('; '));
    }
    
    // Log metadata
    if (validationResult.metadata) {
      debug.log('[LLM Validator] Metadata:', JSON.stringify(validationResult.metadata, null, 2));
    }

    // Convert value to string for gRPC (proto expects string)
    const response: LlmChatResponse = {
      proposal_text: validated.proposal_text,
      changeset: {
        model: validated.changeset.model,
        features: validated.changeset.features.map((f) => ({
          key: f.key,
          value: String(f.value), // Convert to string for proto
        })),
        impacted_services: validated.changeset.impacted_services,
      },
      metadata: validated.metadata,
    };

    // 🚀 AUTO-TRIGGER K8S DEPLOYMENT VIA KAFKA
    // Automatically publish deployment event after successful LLM processing
    try {
      const autoDeployEnabled = process.env.AUTO_DEPLOY_ENABLED === 'true';
      const dryRunDefault = process.env.DEFAULT_DRY_RUN !== 'false'; // Default: true
      
      if (autoDeployEnabled || dryRunDefault) {
        // Trigger deployment in background (don't wait)
        this.k8sIntegrationService.triggerDeployment(response, dryRunDefault)
          .catch(err => {
            debug.error('[LLM] Failed to trigger K8s deployment:', err.message);
          });
      }
    } catch (error) {
      // Don't fail the LLM request if deployment trigger fails
      debug.error('[LLM] Error triggering deployment:', error instanceof Error ? error.message : String(error));
    }

    return response;
  }

  // -------------------------------
  // Gemini (Google API)
  // -------------------------------
  private async callGemini(
    message: string,
    tenant: string,
    role: string,
    lang: string,
    codeContext: string = '',
  ): Promise<string> {
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash'; // (Gemini 2.5 Flash chưa có, có thể ý bạn là 1.5)
    
    // 1. Cấu hình model với System Prompt
    const model = this.geminiClient.getGenerativeModel({
      model: modelName,
      systemInstruction: SYSTEM_PROMPT, // <-- Chỉ dẫn hệ thống đặt ở đây
    });

    // 2. Bắt đầu chat (không cần history vì đây là 1 shot)
    const chat = model.startChat();

    // 3. Tạo nội dung của User
     const userPrompt = `tenant_id=${tenant}; role=${role}; lang=${lang};
${codeContext}

Yêu cầu: ${message}`;

    // 4. Gửi tin nhắn của User
    const result = await chat.sendMessage(userPrompt);

    return result.response.text() || '{}';
  }

  // -------------------------------
  // AI Chat Methods
  // -------------------------------
  
  /**
   * Generate text response for AI chat
   */
  async generateText(prompt: string, context: any[]): Promise<string> {
    try {
      return await this.callGeminiChat(prompt, context, 'You are a helpful AI assistant. Provide clear, concise, and helpful responses.');
    } catch (error) {
      debug.error('[AI Chat] Error:', error);
      return 'I apologize, but I encountered an error processing your request. Please try again.';
    }
  }

  /**
   * Generate code based on prompt
   */
  async generateCode(prompt: string, context: any[]): Promise<{ code: string; language: string; explanation: string }> {
    const codeSystemPrompt = `You are an expert programmer. Generate clean, well-documented code based on user requests. 
Always respond in JSON format:
{
  "code": "the generated code here",
  "language": "programming language (e.g., python, javascript, typescript)",
  "explanation": "brief explanation of what the code does"
}`;

    try {
      const responseText = await this.callGeminiChat(prompt, context, codeSystemPrompt);

      // Parse JSON response
      let cleaned = responseText.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(cleaned);
      return {
        code: parsed.code || '',
        language: parsed.language || 'python',
        explanation: parsed.explanation || 'Code generated successfully'
      };
    } catch (error) {
      debug.error('[Code Generation] Error:', error);
      return {
        code: '// Error generating code',
        language: 'text',
        explanation: 'Failed to generate code. Please try again with a clearer prompt.'
      };
    }
  }

  /**
   * Generic chat method for Gemini
   */
  private async callGeminiChat(prompt: string, context: any[], systemPrompt: string): Promise<string> {
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    
    const model = this.geminiClient.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
    });

    // Build conversation history for Gemini
    const history = context.map((msg: any) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(prompt);

    return result.response.text() || '';
  }
}

