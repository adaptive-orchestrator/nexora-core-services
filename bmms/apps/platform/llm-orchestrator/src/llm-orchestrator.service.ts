import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { mkdir, writeFile } from 'fs/promises';
import * as path from 'path';


// Zod schema for validation (keep your existing schema)
import { z } from 'zod';
import { LlmChatResponse } from './llm-orchestrator/llm-orchestrator.interface';
import { CodeSearchService } from './service/code-search.service';

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

const SYSTEM_PROMPT = `You are an assistant that converts Vietnamese business requests into a JSON ChangeSet.

Return ONLY JSON, no prose. Shape: {
 "proposal_text": string,
 "changeset": {"model": string, "features": Array<{"key": string, "value": string|number|boolean}>, "impacted_services": string[]},
 "metadata": {"intent": string, "confidence": number, "risk": "low"|"medium"|"high"}
}

Return ONLY valid JSON in this format:
{
  "proposal_text": "Detailed explanation in Vietnamese",
  "changeset": {
    "model": "ModelName",
    "features": [{"key": "fieldName", "value": "value"}],
    "impacted_services": ["service1", "service2"]
  },
  "metadata": {
    "intent": "create|update|delete",
    "confidence": 0.95,
    "risk": "low|medium|high"
  }
}`;

@Injectable()
export class LlmOrchestratorService {
  [x: string]: any;
  private provider = (process.env.LLM_PROVIDER || 'deepseek').toLowerCase();
  private geminiClient: GoogleGenerativeAI;
  private useRAG = process.env.USE_RAG === 'true'; // 👈 Feature flag

  constructor(private codeSearchService: CodeSearchService, // 👈 Inject
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

    const content =
      this.provider === 'ollama'
        ? await this.callOllama(message, tenant, role, lang)
        : this.provider === 'deepseek'
          ? await this.callDeepSeek(message, tenant, role, lang)
          : await this.callGemini(message, tenant, role, lang);

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

    return response;
  }

  // -------------------------------
  // DeepSeek (OpenAI-compatible)
  // -------------------------------
  private async callDeepSeek(
    message: string,
    tenant: string,
    role: string,
    lang: string,
  ): Promise<string> {
    const base = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) throw new Error('Missing DEEPSEEK_API_KEY');

    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `tenant_id=${tenant}; role=${role}; lang=${lang};\n\nYêu cầu: ${message}`,
          },
        ],
      }),
    });

    if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content ?? '{}';
  }

  // -------------------------------
  // Ollama (Local)
  // -------------------------------
  private async callOllama(
    message: string,
    tenant: string,
    role: string,
    lang: string,
  ): Promise<string> {
    const base = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'llama3.1';

    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `tenant_id=${tenant}; role=${role}; lang=${lang};\n\nYêu cầu: ${message}`,
          },
        ],
      }),
    });

    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return data?.message?.content ?? '{}';
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
}
