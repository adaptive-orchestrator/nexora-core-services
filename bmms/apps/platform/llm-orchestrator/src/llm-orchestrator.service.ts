import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { mkdir, writeFile } from 'fs/promises';
import * as path from 'path';


// Zod schema for validation (keep your existing schema)
import { z } from 'zod';
import { LlmChatResponse } from './llm-orchestrator/llm-orchestrator.interface';

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
}`;

@Injectable()
export class LlmOrchestratorService {
  [x: string]: any;
  private provider = (process.env.LLM_PROVIDER || 'deepseek').toLowerCase();
  private geminiClient: GoogleGenerativeAI;

  constructor() {
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
  ): Promise<string> {
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const model = this.geminiClient.getGenerativeModel({ model: modelName });

    const prompt = `tenant_id=${tenant}; role=${role}; lang=${lang};\n\nYêu cầu: ${message}\n\n${SYSTEM_PROMPT}`;

    const result = await model.generateContent(prompt);

    return result.response.text() || '{}';
  }
}

// import { Injectable } from '@nestjs/common';


// import { GoogleGenerativeAI } from '@google/generative-ai';
// import { LLMReply, LLMReplySchema } from './schemas';
// import { mkdir, writeFile } from 'fs/promises';
// import * as path from 'path';



// const SYSTEM_PROMPT = `You are an assistant that converts Vietnamese business requests into a JSON ChangeSet.

// Return ONLY JSON, no prose. Shape: {
//  "proposal_text": string,
//  "changeset": {"model": string, "features": Array<{"key": string, "value": string|number|boolean}>, "impacted_services": string[]},
//  "metadata": {"intent": string, "confidence": number, "risk": "low"|"medium"|"high"}
// }`;

// @Injectable()
// export class LlmOrchestratorService {
//   private provider = (process.env.LLM_PROVIDER || 'deepseek').toLowerCase();
//   private geminiClient: GoogleGenerativeAI;

//   constructor() {
//     this.geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
//   }

//   async ask(
//     message: string,
//     tenant?: string,
//     role?: string,
//     lang: 'vi' | 'en' = 'vi',
//   ): Promise<LLMReply> {
//     const content =
//       this.provider === 'ollama'
//         ? await this.callOllama(message, tenant, role, lang)
//         : this.provider === 'deepseek'
//           ? await this.callDeepSeek(message, tenant, role, lang)
//           : await this.callGemini(message, tenant, role, lang);




//     // Parse vÃ  validate JSON
//     let parsed: unknown;
//     try {
//       parsed = JSON.parse(content);
//     } catch {
//       const match = String(content).match(/\{[\s\S]*\}/);
//       if (!match) throw new Error('LLM did not return JSON');
//       parsed = JSON.parse(match[0]);
//     }

//     // ðŸ§© LÃ m sáº¡ch code fence náº¿u cÃ³
//     let cleaned = content.trim();
//     if (cleaned.startsWith('```')) {
//       cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
//     }
//     if(cleaned.endsWith('```')) {
//       cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
//     }

//     // ðŸ§© Ghi ra file JSON
//     const dir = path.resolve(process.cwd(), 'apps/platform/llm-orchestrator/src/bmms-changset/tests/llm_output');
//     await mkdir(dir, { recursive: true });
//     const outputPath = path.join(dir, 'test1_raw.json');
//     await writeFile(outputPath, cleaned, 'utf8');
//     console.log(`[LLM] Wrote clean JSON to: ${outputPath}`);



//     // ============= Note cho docker===================
//     // services:
//     // llm:
//     // build: .
//     //   volumes:
//     //  - ./apps/platform/llm-orchestrator/src/bmms-changset/tests/llm_output:/app/apps/platform/llm-orchestrator/src/bmms-changset/tests/llm_output


//     return LLMReplySchema.parse(parsed);
//   }

//   // -------------------------------
//   // DeepSeek (OpenAI-compatible)
//   // -------------------------------
//   private async callDeepSeek(
//     message: string,
//     tenant?: string,
//     role?: string,
//     lang: string = 'vi',
//   ): Promise<string> {
//     const base = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
//     const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
//     const key = process.env.DEEPSEEK_API_KEY;
//     if (!key) throw new Error('Missing DEEPSEEK_API_KEY');

//     const res = await fetch(`${base}/chat/completions`, {
//       method: 'POST',
//       headers: {
//         Authorization: `Bearer ${key}`,
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         model,
//         temperature: 0.2,
//         messages: [
//           { role: 'system', content: SYSTEM_PROMPT },
//           {
//             role: 'user',
//             content: `tenant_id=${tenant || 't-unknown'}; role=${role || 'guest'
//               }; lang=${lang};\n\nYÃªu cáº§u: ${message}`,
//           },
//         ],
//       }),
//     });

//     if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`);
//     const data: any = await res.json();
//     return data?.choices?.[0]?.message?.content ?? '{}';
//   }

//   // -------------------------------
//   // Ollama (Local)
//   // -------------------------------
//   private async callOllama(
//     message: string,
//     tenant?: string,
//     role?: string,
//     lang: string = 'vi',
//   ): Promise<string> {
//     const base = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
//     const model = process.env.OLLAMA_MODEL || 'llama3.1';

//     const res = await fetch(`${base}/api/chat`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         model,
//         stream: false,
//         messages: [
//           { role: 'system', content: SYSTEM_PROMPT },
//           {
//             role: 'user',
//             content: `tenant_id=${tenant || 't-unknown'}; role=${role || 'guest'
//               }; lang=${lang};\n\nYÃªu cáº§u: ${message}`,
//           },
//         ],
//       }),
//     });

//     if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
//     const data: any = await res.json();
//     return data?.message?.content ?? '{}';
//   }

//   // -------------------------------
//   // Gemini (Google API)
//   // -------------------------------
//   private async callGemini(
//     message: string,
//     tenant?: string,
//     role?: string,
//     lang: string = 'vi',
//   ): Promise<string> {
//     const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
//     const model = this.geminiClient.getGenerativeModel({ model: modelName });

//     const prompt = `tenant_id=${tenant || 't-unknown'}; role=${role || 'guest'
//       }; lang=${lang};\n\nYÃªu cáº§u: ${message}\n\n${SYSTEM_PROMPT}`;

//     const result = await model.generateContent(prompt);

//     return result.response.text() || '{}';
//   }
// }