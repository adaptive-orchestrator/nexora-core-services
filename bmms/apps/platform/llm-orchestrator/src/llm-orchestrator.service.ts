import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { mkdir, writeFile, readFile, readdir } from 'fs/promises';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { LlmChatResponse } from './llm-orchestrator/llm-orchestrator.interface';
import { CodeSearchService } from './service/code-search.service';
import { LlmOutputValidator } from './validators/llm-output.validator';
import { HelmIntegrationService } from './service/helm-integration.service';


// Import prompts and schemas
import {
  RCA_SYSTEM_PROMPT,
  TEXT_TO_SQL_GEN_PROMPT,
  DATA_REPORTER_PROMPT,
  BUSINESS_MODEL_SYSTEM_PROMPT,
  AI_ASSISTANT_PROMPT,
  GENERAL_ASSISTANT_PROMPT,
  CODE_GENERATION_PROMPT,
  fillPromptTemplate,
} from './prompts/llm.prompts';

import {
  LLMReplySchema,
  RCAOutputSchema,
  TextToSQLOutputSchema,
  RCAOutput,
  TextToSQLOutput,
  cleanLLMJsonResponse,
  safeParseJSON,
  validateSQLReadOnly,
} from './schemas/llm-output.schema';

// =============================================================================
// INTERFACES (Exported for external use)
// =============================================================================

export interface ApiKeyState {
  key: string;
  lastUsed: number;
  errorCount: number;
  isRateLimited: boolean;
  rateLimitResetTime?: number;
}

export interface TextToSQLResult {
  success: boolean;
  question: string;
  sql?: string;
  rawData?: any[];
  naturalResponse: string;
  error?: string;
}

export interface RCAResult {
  success: boolean;
  analysis: RCAOutput | null;
  codeContext: string[];
  error?: string;
}

export interface KeyPoolStatus {
  total: number;
  available: number;
  rateLimited: number;
}

// Type alias for LLM Reply schema
type LLMReply = import('./schemas/llm-output.schema').LLMReply;

@Injectable()
export class LlmOrchestratorService {
  private readonly logger = new Logger(LlmOrchestratorService.name);
  
  // API Key Pool for Round-Robin rotation
  private apiKeys: ApiKeyState[] = [];
  private currentKeyIndex = 0;
  
  // Gemini client (lazy initialized with current key)
  private geminiClient!: GoogleGenerativeAI;
  private useRAG = process.env.USE_RAG === 'true';

  // Entity files path pattern for Text-to-SQL
  private readonly entityFilesPattern = '**/*.entity.ts';
  private entitySchemaCache: string | null = null;
  private entitySchemaCacheTime = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // Optional DataSource for Text-to-SQL
  private dataSource?: DataSource;

  constructor(
    private readonly codeSearchService: CodeSearchService,
    private readonly validator: LlmOutputValidator,
    private readonly helmIntegrationService: HelmIntegrationService,
  ) {
    this.initializeApiKeyPool();
  }

  /**
   * Set DataSource for Text-to-SQL feature (called externally or via module)
   */
  setDataSource(dataSource: DataSource): void {
    this.dataSource = dataSource;
  }

  // =============================================================================
  // API KEY ROTATION STRATEGY
  // =============================================================================

  /**
   * Initialize API key pool from environment variables
   * Supports GEMINI_API_KEYS (comma-separated) or fallback to GEMINI_API_KEY
   */
  private initializeApiKeyPool(): void {
    const keysString = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    
    const keys = keysString
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (keys.length === 0) {
      this.logger.warn('[LLM] No API keys found! Set GEMINI_API_KEYS or GEMINI_API_KEY');
      return;
    }

    this.apiKeys = keys.map(key => ({
      key,
      lastUsed: 0,
      errorCount: 0,
      isRateLimited: false,
    }));

    this.logger.log(`[LLM] Initialized API key pool with ${this.apiKeys.length} key(s)`);
    
    // Initialize Gemini client with first key
    this.geminiClient = new GoogleGenerativeAI(this.apiKeys[0].key);
  }

  /**
   * Get current active API key
   */
  private getCurrentKey(): ApiKeyState | null {
    if (this.apiKeys.length === 0) return null;
    return this.apiKeys[this.currentKeyIndex];
  }

  /**
   * Rotate to next available API key (Round-Robin)
   * @returns true if successfully rotated, false if all keys are rate-limited
   */
  private rotateKey(): boolean {
    if (this.apiKeys.length <= 1) {
      this.logger.warn('[LLM] Only one API key available, cannot rotate');
      return false;
    }

    const startIndex = this.currentKeyIndex;
    let attempts = 0;

    do {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      attempts++;

      const key = this.apiKeys[this.currentKeyIndex];
      
      // Check if rate limit has reset
      if (key.isRateLimited && key.rateLimitResetTime) {
        if (Date.now() > key.rateLimitResetTime) {
          key.isRateLimited = false;
          key.errorCount = 0;
          this.logger.log(`[LLM] Key #${this.currentKeyIndex} rate limit reset`);
        }
      }

      // Use this key if not rate-limited
      if (!key.isRateLimited) {
        this.geminiClient = new GoogleGenerativeAI(key.key);
        this.logger.log(`[LLM] Rotated to API key #${this.currentKeyIndex}`);
        return true;
      }
    } while (this.currentKeyIndex !== startIndex && attempts < this.apiKeys.length);

    this.logger.error('[LLM] All API keys are rate-limited!');
    return false;
  }

  /**
   * Mark current key as rate-limited
   */
  private markCurrentKeyRateLimited(): void {
    const key = this.getCurrentKey();
    if (key) {
      key.isRateLimited = true;
      key.errorCount++;
      // Reset after 60 seconds (Gemini free tier resets per minute)
      key.rateLimitResetTime = Date.now() + 60 * 1000;
      this.logger.warn(`[LLM] Key #${this.currentKeyIndex} marked as rate-limited`);
    }
  }

  /**
   * Get API key pool status (for monitoring)
   */
  getKeyPoolStatus(): KeyPoolStatus {
    const rateLimited = this.apiKeys.filter(k => k.isRateLimited).length;
    return {
      total: this.apiKeys.length,
      available: this.apiKeys.length - rateLimited,
      rateLimited,
    };
  }

  async ask(
    message: string,
    tenant: string = 't-unknown',
    role: string = 'guest',
    lang: 'vi' | 'en' = 'vi',
  ): Promise<LlmChatResponse> {
    this.logger.log(`[ASK] ==================== NEW REQUEST ====================`);
    this.logger.log(`[ASK] Message: "${message.substring(0, 100)}..."`);
    this.logger.log(`[ASK] Tenant: ${tenant}, Role: ${role}, Lang: ${lang}`);
    this.logger.log(`[ASK] USE_RAG flag: ${this.useRAG}`);
    
     // RAG: Tìm code liên quan
    let codeContext = '';
    if (this.useRAG) {
      this.logger.log(`[RAG] ✅ Enabled - Searching for relevant code...`);
      const relevantCode = await this.codeSearchService.searchRelevantCode(message, 5);
      
      if (relevantCode.length > 0) {
        this.logger.log(`[RAG] Found ${relevantCode.length} relevant code snippets`);
        codeContext = '\n\n=== CODE CONTEXT FROM YOUR SYSTEM ===\n';
        codeContext += 'The following code snippets are from your actual codebase, retrieved using RAG:\n\n';
        
        relevantCode.forEach((code, idx) => {
          codeContext += `\n【Snippet ${idx + 1}/${relevantCode.length}】\n`;
          codeContext += `📁 File: ${code.file_path}\n`;
          codeContext += `📍 Lines: ${code.start_line}-${code.end_line}\n`;
          codeContext += `🏷️  Type: ${code.chunk_type}${code.name ? ` (${code.name})` : ''}\n`;
          codeContext += `🎯 Relevance: ${(code.score * 100).toFixed(1)}%\n`;
          codeContext += `\`\`\`typescript\n${code.content.substring(0, 1200)}\n\`\`\`\n`;
        });
        codeContext += '\n=== END CODE CONTEXT ===\n';
        codeContext += 'Use this context to describe how the actual system works, not generic theory.\n';
      } else {
        this.logger.warn(`[RAG] No relevant code found for query: "${message.substring(0, 50)}..."`);
      }
    } else {
      this.logger.warn(`[RAG] Disabled (USE_RAG=${process.env.USE_RAG})`);
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
      console.log(`[LLM] Wrote clean JSON to: ${outputPath}`);
    } catch (err) {
      console.error('[LLM] Failed to write output file:', err);
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

    // ADD: Business logic validation
    const validationResult = this.validator.validate(validated);
    
    if (!validationResult.isValid) {
      throw new Error(
        `LLM output validation failed:\n${validationResult.errors.join('\n')}`,
      );
    }
    
    // Log warnings if any
    if (validationResult.warnings.length > 0) {
        console.log('[LLM Validator] Warnings:', validationResult.warnings.join('; '));
    }
    
    // Log metadata
    if (validationResult.metadata) {
      console.log('[LLM Validator] Metadata:', JSON.stringify(validationResult.metadata, null, 2));
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

    // [LLM] AUTO-TRIGGER HELM DEPLOYMENT
    // Automatically generate changeset and trigger Helm deployment after successful LLM processing
    try {
      const autoDeployEnabled = process.env.AUTO_DEPLOY_ENABLED === 'true';
      const dryRunDefault = process.env.DEFAULT_DRY_RUN !== 'false'; // Default: true
      
      if (autoDeployEnabled || dryRunDefault) {
        // Trigger Helm deployment in background (don't wait)
        this.helmIntegrationService.triggerDeployment(response, dryRunDefault)
          .then((result) => {
            if (result.success) {
              console.log('[LLM] Helm changeset generated:', result.changesetPath);
              if (result.deployed) {
                console.log('[LLM] Helm deployment completed successfully');
              }
            }
          })
          .catch(err => {
            console.error('[LLM] Failed to trigger Helm deployment:', err.message);
          });
      }
    } catch (error) {
      // Don't fail the LLM request if deployment trigger fails
      console.error('[LLM] Error triggering Helm deployment:', error instanceof Error ? error.message : String(error));
    }

    return response;
  }

  // -------------------------------
  // Gemini (Google API) with Retry & Key Rotation
  // -------------------------------
  
  /**
   * Call Gemini API with automatic retry and key rotation on rate limit
   */
  private async callGeminiWithRetry(
    prompt: string,
    systemPrompt: string,
    maxRetries?: number,
  ): Promise<string> {
    const retries = maxRetries ?? this.apiKeys.length;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const modelName = process.env.LLM_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
        
        const model = this.geminiClient.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
        });

        const chat = model.startChat();
        const result = await chat.sendMessage(prompt);
        
        // Update key usage stats
        const currentKey = this.getCurrentKey();
        if (currentKey) {
          currentKey.lastUsed = Date.now();
          currentKey.errorCount = 0; // Reset on success
        }

        return result.response.text() || '{}';
        
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a rate limit error (HTTP 429)
        const isRateLimitError = 
          error?.status === 429 ||
          error?.message?.includes('429') ||
          error?.message?.toLowerCase().includes('rate limit') ||
          error?.message?.toLowerCase().includes('quota exceeded') ||
          error?.message?.toLowerCase().includes('resource exhausted');

        if (isRateLimitError) {
          this.logger.warn(`[LLM] Rate limit hit on attempt ${attempt + 1}/${retries}`);
          this.markCurrentKeyRateLimited();
          
          // Try to rotate to next key
          const rotated = this.rotateKey();
          if (!rotated) {
            // All keys exhausted, wait before retry
            this.logger.warn('[LLM] All keys rate-limited. Waiting 5 seconds...');
            await this.sleep(5000);
          } else {
            // Small delay before retry with new key
            await this.sleep(1000);
          }
        } else {
          // Non-rate-limit error, don't retry
          this.logger.error(`[LLM] API error: ${error.message}`);
          throw error;
        }
      }
    }

    throw lastError || new Error('All API retry attempts exhausted');
  }

  /**
   * Legacy callGemini method - now uses retry pattern
   */
  private async callGemini(
    message: string,
    tenant: string,
    role: string,
    lang: string,
    codeContext: string = '',
  ): Promise<string> {
    const userPrompt = `tenant_id=${tenant}; role=${role}; lang=${lang};
${codeContext}

Yêu cầu: ${message}`;

    // Detect câu hỏi tổng quát về hệ thống (user-facing questions)
    const isGeneralSystemQuestion = this.isGeneralSystemQuestion(message);
    const selectedPrompt = isGeneralSystemQuestion ? GENERAL_ASSISTANT_PROMPT : AI_ASSISTANT_PROMPT;
    
    if (isGeneralSystemQuestion) {
      this.logger.log(`[LLM] 🎯 Detected general system question - using GENERAL_ASSISTANT_PROMPT`);
    }

    return this.callGeminiWithRetry(userPrompt, selectedPrompt);
  }

  /**
   * Check if the message is a general user-facing question about the system
   */
  private isGeneralSystemQuestion(message: string): boolean {
    const generalPatterns = [
      // Việt - câu hỏi về identity
      /bạn là (ai|gì)/i,
      /bạn là ai/i,
      /là ai\??$/i,
      // Việt - câu hỏi về hệ thống
      /hệ thống.*(làm được|có thể|hỗ trợ|cung cấp|làm gì)/i,
      /làm được gì/i,
      /có thể làm gì/i,
      /nexora.*(là|làm)/i,
      /giới thiệu.*(hệ thống|bản thân|nexora)/i,
      /mô tả.*(hệ thống|tổng quan|kiến trúc)/i,
      /có những (tính năng|chức năng|khả năng)/i,
      /tính năng.*(gì|nào)/i,
      /chức năng.*(gì|nào)/i,
      // RAG questions
      /sử dụng.*rag/i,
      /rag.*là gì/i,
      /có.*rag/i,
      // English
      /who are you/i,
      /what (can|do) you/i,
      /what is (this|nexora|the) system/i,
      /describe.*(system|yourself|architecture)/i,
      /introduce.*(yourself|nexora|system)/i,
      /what features/i,
      /how does.*(system|rag|nexora) work/i,
    ];

    const matched = generalPatterns.some(pattern => pattern.test(message));
    
    // Debug logging
    this.logger.log(`[PROMPT-DETECT] Message: "${message.substring(0, 50)}..."`);
    this.logger.log(`[PROMPT-DETECT] Is general question: ${matched}`);
    
    return matched;
  }

  /**
   * Generic chat method for Gemini with retry
   */
  private async callGeminiChat(
    prompt: string,
    context: any[],
    systemPrompt: string,
  ): Promise<string> {
    // For chat with history, we need a slightly different approach
    const modelName = process.env.LLM_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
    const maxRetries = this.apiKeys.length;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const model = this.geminiClient.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
        });

        // Build conversation history for Gemini
        const history = context.map((msg: any) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        }));

        const chat = model.startChat({ history });
        const result = await chat.sendMessage(prompt);

        return result.response.text() || '';
        
      } catch (error: any) {
        lastError = error;
        
        const isRateLimitError = 
          error?.status === 429 ||
          error?.message?.includes('429') ||
          error?.message?.toLowerCase().includes('rate limit');

        if (isRateLimitError) {
          this.markCurrentKeyRateLimited();
          const rotated = this.rotateKey();
          if (!rotated) {
            await this.sleep(5000);
          } else {
            await this.sleep(1000);
          }
        } else {
          throw error;
        }
      }
    }

    throw lastError || new Error('All API retry attempts exhausted');
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // -------------------------------
  // AI Chat Methods
  // -------------------------------
  
  /**
   * Generate text response for AI chat
   * Includes RAG context when enabled
   */
  async generateText(prompt: string, context: any[]): Promise<string> {
    try {
      // Detect loại câu hỏi để chọn prompt phù hợp
      const isGeneralQuestion = this.isGeneralSystemQuestion(prompt);
      const selectedPrompt = isGeneralQuestion ? GENERAL_ASSISTANT_PROMPT : AI_ASSISTANT_PROMPT;
      
      if (isGeneralQuestion) {
        this.logger.log(`[generateText] 🎯 Detected GENERAL system question - using GENERAL_ASSISTANT_PROMPT`);
      } else {
        this.logger.log(`[generateText] 🔧 Detected TECHNICAL question - using AI_ASSISTANT_PROMPT`);
      }

      // RAG: Tìm code liên quan
      let codeContext = '';
      if (this.useRAG) {
        this.logger.log(`[generateText] RAG enabled - searching for relevant code...`);
        const relevantCode = await this.codeSearchService.searchRelevantCode(prompt, 5);
        
        if (relevantCode.length > 0) {
          this.logger.log(`[generateText] Found ${relevantCode.length} relevant code snippets`);
          codeContext = this.codeSearchService.formatCodeContext(relevantCode);
        }
      }
      
      const enrichedPrompt = codeContext 
        ? `${prompt}\n\n${codeContext}`
        : prompt;
      
      return await this.callGeminiChat(enrichedPrompt, context, selectedPrompt);
    } catch (error) {
      console.error('[AI Chat] Error:', error);
      return 'I apologize, but I encountered an error processing your request. Please try again.';
    }
  }

  /**
   * Generate code based on prompt
   * Includes RAG context for referencing existing codebase patterns
   */
  async generateCode(prompt: string, context: any[]): Promise<{ code: string; language: string; explanation: string }> {
    try {
      // RAG: Tìm code patterns liên quan trong codebase
      let codeContext = '';
      if (this.useRAG) {
        this.logger.log(`[generateCode] RAG enabled - searching for relevant code patterns...`);
        const relevantCode = await this.codeSearchService.searchRelevantCode(prompt, 5);
        
        if (relevantCode.length > 0) {
          this.logger.log(`[generateCode] Found ${relevantCode.length} relevant code snippets`);
          codeContext = this.codeSearchService.formatCodeContext(relevantCode);
        }
      }
      
      const enrichedPrompt = codeContext 
        ? `${prompt}\n\nUse the following code from the existing codebase as reference for patterns and style:\n${codeContext}`
        : prompt;
      
      const responseText = await this.callGeminiChat(enrichedPrompt, context, CODE_GENERATION_PROMPT);

      // Parse JSON response
      const cleaned = cleanLLMJsonResponse(responseText);
      const parsed = JSON.parse(cleaned);
      
      return {
        code: parsed.code || '',
        language: parsed.language || 'python',
        explanation: parsed.explanation || 'Code generated successfully'
      };
    } catch (error) {
      console.error('[Code Generation] Error:', error);
      return {
        code: '// Error generating code',
        language: 'text',
        explanation: 'Failed to generate code. Please try again with a clearer prompt.'
      };
    }
  }

  // =============================================================================
  // ROOT CAUSE ANALYSIS (RCA)
  // =============================================================================

  /**
   * Analyze incident/error log and provide Root Cause Analysis
   * @param errorLog - The error log or stack trace to analyze
   * @returns RCA result with analysis and suggestions
   */
  async analyzeIncident(errorLog: string): Promise<RCAResult> {
    try {
      this.logger.log('[RCA] Starting incident analysis...');
      
      // Step 1: Extract file names from stack trace using regex
      const fileNames = this.extractFileNamesFromStackTrace(errorLog);
      this.logger.log(`[RCA] Extracted ${fileNames.length} file references: ${fileNames.join(', ')}`);

      // Step 2: Search for relevant code using RAG
      let codeContextResults: any[] = [];
      
      if (this.useRAG) {
        // Priority 1: Search by file names
        for (const fileName of fileNames.slice(0, 3)) { // Limit to first 3 files
          const results = await this.codeSearchService.searchRelevantCode(fileName, 2);
          codeContextResults.push(...results);
        }

        // Priority 2: If no results, search by error message content
        if (codeContextResults.length === 0) {
          const errorKeywords = this.extractErrorKeywords(errorLog);
          const results = await this.codeSearchService.searchRelevantCode(errorKeywords, 3);
          codeContextResults.push(...results);
        }
      }

      // Step 3: Format code context for LLM
      const codeContext = codeContextResults.length > 0
        ? this.codeSearchService.formatCodeContext(codeContextResults)
        : 'No relevant code found in codebase.';

      // Step 4: Build and send prompt to LLM
      const prompt = fillPromptTemplate(RCA_SYSTEM_PROMPT, {
        ERROR_LOG: errorLog,
        CODE_CONTEXT: codeContext,
      });

      const response = await this.callGeminiWithRetry(
        'Analyze this error and provide RCA in JSON format.',
        prompt,
      );

      // Step 5: Parse and validate response
      const parseResult = safeParseJSON(response, RCAOutputSchema);
      
      if (!parseResult.success) {
        this.logger.warn(`[RCA] Failed to parse LLM response: ${parseResult.error}`);
        return {
          success: false,
          analysis: null,
          codeContext: codeContextResults.map(c => c.file_path),
          error: `Failed to parse analysis: ${parseResult.error}`,
        };
      }

      this.logger.log('[RCA] Analysis completed successfully');
      
      return {
        success: true,
        analysis: parseResult.data,
        codeContext: codeContextResults.map(c => c.file_path),
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[RCA] Error: ${message}`);
      return {
        success: false,
        analysis: null,
        codeContext: [],
        error: message,
      };
    }
  }

  /**
   * Extract file names from stack trace
   */
  private extractFileNamesFromStackTrace(stackTrace: string): string[] {
    const patterns = [
      // TypeScript/JavaScript: at Function (/path/to/file.ts:123:45)
      /at\s+.*?\(([^:]+\.(?:ts|js|tsx|jsx)):\d+:\d+\)/gi,
      // Python: File "/path/to/file.py", line 123
      /File\s+"([^"]+\.py)"/gi,
      // Java: at com.example.Class(File.java:123)
      /at\s+[\w.]+\(([^:]+\.java):\d+\)/gi,
      // Generic: any .ts/.js/.py file reference
      /([a-zA-Z0-9_\-./]+\.(?:ts|js|py|java|tsx|jsx))/gi,
    ];

    const fileNames = new Set<string>();

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(stackTrace)) !== null) {
        const fileName = match[1]?.split('/').pop()?.split('\\').pop();
        if (fileName) {
          fileNames.add(fileName);
        }
      }
    }

    return Array.from(fileNames);
  }

  /**
   * Extract key error terms for fallback search
   */
  private extractErrorKeywords(errorLog: string): string {
    // Extract error type and message
    const patterns = [
      /(?:Error|Exception|TypeError|ReferenceError):\s*(.+?)(?:\n|$)/i,
      /(?:Cannot|Failed|Unable)\s+(?:to\s+)?(.+?)(?:\n|$)/i,
      /undefined\s+(.+?)(?:\n|$)/i,
    ];

    const keywords: string[] = [];
    
    for (const pattern of patterns) {
      const match = errorLog.match(pattern);
      if (match) {
        keywords.push(match[1].substring(0, 100));
      }
    }

    return keywords.join(' ').substring(0, 200) || errorLog.substring(0, 200);
  }

  // =============================================================================
  // TEXT-TO-SQL & NATURAL RESPONSE
  // =============================================================================

  /**
   * Handle natural language question and return data with natural response
   * @param question - Natural language question about data
   * @returns SQL result with natural language response
   */
  async handleTextToSql(question: string): Promise<TextToSQLResult> {
    try {
      this.logger.log(`[Text-to-SQL] Processing: "${question.substring(0, 50)}..."`);

      // Check if DataSource is available
      if (!this.dataSource || !this.dataSource.isInitialized) {
        return {
          success: false,
          question,
          naturalResponse: 'Database connection not available. Please configure DataSource.',
          error: 'DataSource not initialized',
        };
      }

      // Step 1: Get entity schema context
      const schemaContext = await this.loadEntitySchemas();
      
      if (!schemaContext) {
        return {
          success: false,
          question,
          naturalResponse: 'Unable to load database schema. Please check entity files.',
          error: 'Schema context not available',
        };
      }

      // Step 2: Generate SQL from natural language
      const sqlGenPrompt = fillPromptTemplate(TEXT_TO_SQL_GEN_PROMPT, {
        SCHEMA_CONTEXT: schemaContext,
        USER_QUESTION: question,
      });

      const sqlResponse = await this.callGeminiWithRetry(
        question,
        sqlGenPrompt,
      );

      // Parse SQL generation result
      const sqlParseResult = safeParseJSON(sqlResponse, TextToSQLOutputSchema);
      
      if (!sqlParseResult.success) {
        return {
          success: false,
          question,
          naturalResponse: 'Không thể tạo câu truy vấn từ câu hỏi của bạn. Vui lòng thử lại với câu hỏi rõ ràng hơn.',
          error: `SQL generation failed: ${sqlParseResult.error}`,
        };
      }

      const { sql, params } = sqlParseResult.data;
      this.logger.log(`[Text-to-SQL] Generated SQL: ${sql}`);

      // Step 3: Validate SQL is read-only
      if (!validateSQLReadOnly(sql)) {
        return {
          success: false,
          question,
          sql,
          naturalResponse: 'Chỉ hỗ trợ truy vấn đọc dữ liệu (SELECT). Không thể thực hiện các thao tác thay đổi dữ liệu.',
          error: 'SQL query is not read-only',
        };
      }

      // Step 4: Execute SQL query
      let rawData: any[];
      try {
        rawData = await this.dataSource.query(sql, params);
        this.logger.log(`[Text-to-SQL] Query returned ${rawData.length} rows`);
      } catch (dbError: any) {
        this.logger.error(`[Text-to-SQL] Database error: ${dbError.message}`);
        return {
          success: false,
          question,
          sql,
          naturalResponse: `Lỗi khi truy vấn database: ${dbError.message}`,
          error: dbError.message,
        };
      }

      // Step 5: Generate natural language response
      const reporterPrompt = fillPromptTemplate(DATA_REPORTER_PROMPT, {
        USER_QUESTION: question,
        SQL_QUERY: sql,
        SQL_RESULT: JSON.stringify(rawData.slice(0, 50)), // Limit for context size
      });

      const naturalResponse = await this.callGeminiWithRetry(
        'Generate a natural response in Vietnamese based on the data.',
        reporterPrompt,
      );

      return {
        success: true,
        question,
        sql,
        rawData,
        naturalResponse: naturalResponse.trim(),
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Text-to-SQL] Error: ${message}`);
      return {
        success: false,
        question,
        naturalResponse: `Có lỗi xảy ra khi xử lý câu hỏi: ${message}`,
        error: message,
      };
    }
  }

  /**
   * Load and cache entity schemas for Text-to-SQL context
   */
  private async loadEntitySchemas(): Promise<string | null> {
    // Check cache
    const now = Date.now();
    if (this.entitySchemaCache && (now - this.entitySchemaCacheTime) < this.CACHE_TTL_MS) {
      return this.entitySchemaCache;
    }

    try {
      // Search for entity files using code search service
      const entityResults = await this.codeSearchService.searchRelevantCode(
        'entity TypeORM Column Table PrimaryGeneratedColumn',
        20,
      );

      if (entityResults.length === 0) {
        this.logger.warn('[Text-to-SQL] No entity files found via RAG');
        return this.buildSchemaFromDataSource();
      }

      // Filter only .entity.ts files
      const entityFiles = entityResults.filter(r => 
        r.file_path.endsWith('.entity.ts')
      );

      // Build schema context
      let schemaContext = '=== DATABASE ENTITIES ===\n\n';
      
      for (const entity of entityFiles.slice(0, 10)) { // Limit to 10 entities
        schemaContext += `// ${entity.file_path}\n`;
        schemaContext += entity.content.substring(0, 2000); // Limit content size
        schemaContext += '\n\n';
      }

      // Cache the result
      this.entitySchemaCache = schemaContext;
      this.entitySchemaCacheTime = now;

      return schemaContext;

    } catch (error) {
      this.logger.error(`[Text-to-SQL] Error loading entity schemas: ${error}`);
      return this.buildSchemaFromDataSource();
    }
  }

  /**
   * Fallback: Build schema from DataSource metadata
   */
  private buildSchemaFromDataSource(): string | null {
    if (!this.dataSource?.isInitialized) {
      return null;
    }

    try {
      const entities = this.dataSource.entityMetadatas;
      let schema = '=== DATABASE SCHEMA (from metadata) ===\n\n';

      for (const entity of entities) {
        schema += `Table: ${entity.tableName}\n`;
        schema += `Columns:\n`;
        
        for (const column of entity.columns) {
          schema += `  - ${column.propertyName} (${column.type})`;
          if (column.isPrimary) schema += ' [PK]';
          if (column.isNullable) schema += ' [nullable]';
          schema += '\n';
        }
        
        // Relations
        if (entity.relations.length > 0) {
          schema += `Relations:\n`;
          for (const relation of entity.relations) {
            schema += `  - ${relation.propertyName} -> ${relation.inverseEntityMetadata?.tableName || 'unknown'}\n`;
          }
        }
        
        schema += '\n';
      }

      return schema;
    } catch (error) {
      this.logger.error(`[Text-to-SQL] Error building schema from DataSource: ${error}`);
      return null;
    }
  }

  // -------------------------------
  // Business Model Recommendation
  // -------------------------------
  
  /**
   * Tư vấn mô hình kinh doanh phù hợp dựa trên mô tả của người dùng
   */
  async recommendBusinessModel(request: {
    business_description: string;
    target_audience?: string;
    revenue_preference?: string;
    lang?: string;
  }): Promise<{
    greeting: string;
    recommendation_intro: string;
    recommended_model: string;
    why_this_fits: string;
    how_it_works: string;
    next_steps: string[];
    alternatives_intro?: string;
    alternatives?: Array<{ model: string; brief_reason: string }>;
    closing?: string;
  }> {
    const lang = request.lang || 'vi';
    
    const systemPrompt = `Bạn là một chuyên gia tư vấn kinh doanh thân thiện và nhiệt tình. Nhiệm vụ của bạn là giúp người dùng (có thể không biết gì về công nghệ hay mô hình kinh doanh) chọn được cách vận hành phù hợp nhất.

**CÁCH NÓI CHUYỆN:**
- Nói như đang tư vấn trực tiếp cho một người bạn
- Dùng ngôn ngữ đơn giản, tránh thuật ngữ chuyên môn  
- Giải thích bằng ví dụ thực tế dễ hiểu (Netflix, Shopee, phòng gym...)
- Thể hiện sự quan tâm và động viên

**CÁC LỰA CHỌN CÓ SẴN:**

1. **retail** - \"Bán hàng truyền thống\" [CHỌN NÀY KHI BÁN SẢN PHẨM VẬT LÝ]
   - Khách mua -> Thanh toán 1 lần -> Nhận hàng -> Xong
   - Giống như: Shopee, Tiki, cửa hàng điện tử, cửa hàng quần áo
   - PHÙ HỢP VỚI: Bán linh kiện, thiết bị, quần áo, thực phẩm, đồ gia dụng, sản phẩm handmade, v.v.
   - DẤU HIỆU NHẬN BIẾT: người dùng nói "bán", "kinh doanh", "cửa hàng", "sản phẩm", "hàng hóa", "ship", "giao hàng"
   
2. **subscription** - \"Thu phí định kỳ\" [CHỌN KHI CUNG CẤP DỊCH VỤ SỐ/NỘI DUNG]
   - Khách đăng ký -> Trả tiền hàng tháng/năm -> Được sử dụng dịch vụ LIÊN TỤC
   - Giống như: Netflix, Spotify, phòng gym, SaaS, khóa học online membership
   - PHÙ HỢP VỚI: Streaming, phần mềm, nội dung số, dịch vụ cloud, membership
   - DẤU HIỆU NHẬN BIẾT: "hàng tháng", "định kỳ", "membership", "thành viên", "truy cập không giới hạn"
   
3. **freemium** - "Miễn phí cơ bản, trả tiền nâng cấp"
   - Khách dùng free -> Thích -> Trả tiền để có thêm tính năng
   - Giống như: Canva, Notion, game mobile
   - PHÙ HỢP VỚI: Ứng dụng, công cụ online, game
   - DẤU HIỆU NHẬN BIẾT: "miễn phí", "free", "nâng cấp", "premium features"
   
4. **multi** - "Kết hợp nhiều cách"
   - Vừa bán hàng, vừa có gói membership, vừa có tính năng premium
   - Giống như: Amazon (vừa bán hàng, vừa có Prime)
   - PHÙ HỢP VỚI: Doanh nghiệp lớn muốn đa dạng hóa nguồn thu

**QUAN TRỌNG - QUY TẬC CHỌN:**
- Nếu người dùng nói về BÁN SẢN PHẨM VẬT LÝ (linh kiện, điện tử, quần áo, đồ ăn, v.v.) -> LUÔN chọn **retail**
- Chỉ chọn **subscription** khi họ nói rõ về DỊCH VỤ SỐ hoặc NỘI DUNG định kỳ
- Nếu không chắc chắn và sản phẩm là vật lý -> mặc định chọn **retail**

**[BẮT BUỘC]: PHẢI TRẢ VỀ TẤT CẢ 9 TRƯỜNG DƯỚI ĐÂY. KHÔNG ĐƯỢC BỎ QUA TRƯỜNG NÀO!**

**OUTPUT FORMAT (CHỈ JSON, KHÔNG markdown, KHÔNG code block):**
{
  "greeting": "[BẮT BUỘC] Lời chào thân thiện có emoji",
  "recommendation_intro": "[BẮT BUỘC] Giới thiệu ngắn về đề xuất, VD: 'Dựa vào mô tả của bạn, mình nghĩ cách phù hợp nhất là:'",
  "recommended_model": "[BẮT BUỘC] Chỉ 1 trong 4 giá trị: retail | subscription | freemium | multi",
  "why_this_fits": "[BẮT BUỘC] Giải thích 2-3 lý do TẠI SAO cách này phù hợp với mô tả của họ",
  "how_it_works": "[BẮT BUỘC] Giải thích CÁCH HOẠT ĐỘNG đơn giản với ví dụ thực tế",
  "next_steps": "[BẮT BUỘC] Mảng 3 bước tiếp theo, VD: ['Bấm chọn mô hình này', 'Thêm sản phẩm', 'Bắt đầu bán']",
  "alternatives_intro": "[BẮT BUỘC] VD: 'Nếu bạn chưa chắc chắn, đây là lựa chọn khác:'",
  "alternatives": "[BẮT BUỘC] Mảng 2 lựa chọn khác: [{'model': '...', 'brief_reason': '1 dòng mô tả'}]",
  "closing": "[BẮT BUỘC] Lời kết động viên"
}

**VÍ DỤ RESPONSE HOÀN CHỈNH:**
{"greeting":"Chào bạn!","recommendation_intro":"Dựa vào việc bạn muốn bán linh kiện điện tử, mình đề xuất:","recommended_model":"retail","why_this_fits":"1. Linh kiện điện tử là sản phẩm vật lý, khách mua 1 lần và nhận hàng. 2. Giống như các shop Shopee/Tiki bán linh kiện - mô hình đã chứng minh hiệu quả. 3. Dễ quản lý tồn kho và định giá theo từng sản phẩm.","how_it_works":"Rất đơn giản: Bạn đăng linh kiện lên -> Khách xem và đặt mua -> Thanh toán -> Bạn giao hàng. Giống như mở shop trên Shopee vậy!","next_steps":["Bấm chọn mô hình 'Bán hàng truyền thống'","Thêm các linh kiện của bạn vào kho","Bắt đầu nhận đơn hàng đầu tiên!"],"alternatives_intro":"Nếu sau này bạn muốn mở rộng:","alternatives":[{"model":"multi","brief_reason":"Kết hợp thêm gói membership VIP cho khách thường xuyên"},{"model":"subscription","brief_reason":"Nếu bạn có dịch vụ sửa chữa định kỳ"}],"closing":"Bắt đầu với retail là lựa chọn an toàn nhất cho việc bán linh kiện. Chúc bạn kinh doanh thành công!"}`;

    const userPrompt = `Người dùng cần tư vấn:

"${request.business_description}"
${request.target_audience ? `\nKhách hàng họ nhắm đến: "${request.target_audience}"` : ''}
${request.revenue_preference ? `\nHọ mong muốn về thu nhập: "${request.revenue_preference}"` : ''}

Hãy tư vấn thật thân thiện, dễ hiểu bằng ${lang === 'vi' ? 'tiếng Việt' : 'English'}. Giải thích như đang nói chuyện với một người bạn không biết gì về kinh doanh online. Nhớ trả lời đúng format JSON.`;

    try {
      const responseText = await this.callGeminiChat(userPrompt, [], systemPrompt);
      
      // Log raw response from Gemini
      console.log('[Recommend Model] Raw Gemini response:', responseText);
      
      // Clean and parse response
      let cleaned = responseText.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
      }
      
      console.log('[Recommend Model] Cleaned response:', cleaned);
      
      const parsed = JSON.parse(cleaned);
      
      console.log('[Recommend Model] Parsed JSON keys:', Object.keys(parsed));
      console.log('[Recommend Model] Parsed JSON:', JSON.stringify(parsed, null, 2));
      
      const result = {
        greeting: parsed.greeting || 'Chào bạn!',
        recommendation_intro: parsed.recommendation_intro || 'Dựa vào mô tả của bạn, mình đề xuất:',
        recommended_model: parsed.recommended_model || 'retail',
        why_this_fits: parsed.why_this_fits || 'Cách này sẽ phù hợp với nhu cầu của bạn.',
        how_it_works: parsed.how_it_works || 'Khách hàng sẽ mua sản phẩm/dịch vụ của bạn một cách dễ dàng.',
        next_steps: parsed.next_steps || ['Bấm nút bên dưới để bắt đầu'],
        alternatives_intro: parsed.alternatives_intro || 'Nếu bạn chưa chắc, đây là một số lựa chọn khác:',
        alternatives: parsed.alternatives || [],
        closing: parsed.closing || 'Chúc bạn kinh doanh thành công!',
      };
      
      console.log('[Recommend Model] Final result:', JSON.stringify(result, null, 2));
      
      return result;
    } catch (error) {
      console.log('[Recommend Model] Error:', error);
      console.log('[Recommend Model] Error details:', (error as Error).message);
      return {
        greeting: 'Chào bạn!',
        recommendation_intro: 'Mình đã xem qua mô tả của bạn và đây là đề xuất:',
        recommended_model: 'retail',
        why_this_fits: 'Xin lỗi, mình không thể phân tích chi tiết được. Nhưng cách "Bán hàng truyền thống" là lựa chọn an toàn và dễ bắt đầu nhất.',
        how_it_works: 'Bạn đăng sản phẩm -> Khách hàng xem và đặt mua -> Thanh toán -> Giao hàng. Đơn giản vậy thôi!',
        next_steps: [
          'Bấm nút bên dưới để chọn cách này',
          'Thêm sản phẩm/dịch vụ của bạn vào hệ thống',
          'Bắt đầu bán hàng!'
        ],
        closing: 'Bạn có thể thay đổi sang cách khác sau nếu cần nhé!',
      };
    }
  }

  /**
   * Generate detailed changeset with impacted services for Human-in-the-loop workflow
   */
  generateDetailedChangeset(
    from_model: string,
    to_model: string,
    business_description: string,
  ): {
    changeset: {
      model: string;
      features: Array<{ key: string; value: string }>;
      impacted_services: string[];
      services_to_enable: string[];
      services_to_disable: string[];
      services_to_restart: string[];
    };
    metadata: {
      intent: string;
      confidence: number;
      risk: 'low' | 'medium' | 'high';
      from_model: string;
      to_model: string;
    };
  } {
    // Determine affected services based on Helm SERVICE_PROFILES
    // These match the actual services enabled/disabled in helm charts
    const modelSpecificServices: Record<string, string[]> = {
      retail: ['OrderService', 'InventoryService'],
      subscription: ['SubscriptionService', 'PromotionService', 'PricingService'],
      freemium: ['SubscriptionService', 'PromotionService', 'PricingService'],
      multi: ['OrderService', 'InventoryService', 'SubscriptionService', 'PromotionService', 'PricingService'],
    };

    // Core services that are ALWAYS running but need restart when model changes (function changes)
    const coreServicesToRestart = ['BillingService', 'PaymentService', 'CatalogueService'];

    const fromServices = new Set(modelSpecificServices[from_model] || modelSpecificServices.retail);
    const toServices = new Set(modelSpecificServices[to_model] || modelSpecificServices.retail);
    
    // Services to ENABLE (in to_model but NOT in from_model)
    const servicesToEnable = Array.from(toServices).filter(s => !fromServices.has(s));
    
    // Services to DISABLE (in from_model but NOT in to_model)
    const servicesToDisable = Array.from(fromServices).filter(s => !toServices.has(s));
    
    // Services to RESTART (core services that change function)
    const servicesToRestart = [...coreServicesToRestart];
    
    // All impacted services
    const impacted = [
      ...servicesToEnable,
      ...servicesToDisable,
      ...servicesToRestart,
    ] as string[];

    // Determine risk level
    let risk: 'low' | 'medium' | 'high' = 'low';
    const descLower = business_description.toLowerCase();
    
    if (descLower.includes('xóa') || descLower.includes('delete') || descLower.includes('drop') || descLower.includes('remove all')) {
      risk = 'high';
    } else if (descLower.includes('giá') || descLower.includes('price') || descLower.includes('billing') || descLower.includes('thanh toán')) {
      risk = 'medium';
    } else if (to_model === 'multi') {
      risk = 'medium'; // Multi model is more complex
    }

    // Generate features based on target model
    const features: Array<{ key: string; value: string }> = [
      { key: 'business_model', value: to_model },
    ];

    if (to_model === 'subscription') {
      features.push(
        { key: 'subscription_frequency', value: 'monthly' },
        { key: 'billing_mode', value: 'RECURRING' },
      );
    } else if (to_model === 'freemium') {
      features.push(
        { key: 'free_tier_enabled', value: 'true' },
        { key: 'premium_features', value: 'advanced_analytics,priority_support' },
      );
    } else if (to_model === 'multi') {
      features.push(
        { key: 'retail_enabled', value: 'true' },
        { key: 'subscription_enabled', value: 'true' },
      );
    }

    return {
      changeset: {
        model: 'BusinessModel',
        features,
        impacted_services: impacted,
        services_to_enable: servicesToEnable,
        services_to_disable: servicesToDisable,
        services_to_restart: servicesToRestart,
      },
      metadata: {
        intent: 'business_model_change',
        confidence: risk === 'high' ? 0.75 : risk === 'medium' ? 0.85 : 0.95,
        risk,
        from_model,
        to_model,
      },
    };
  }
}

