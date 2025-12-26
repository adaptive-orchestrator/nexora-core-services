/**
 * Zod schemas for LLM output validation
 * Ensures type-safe parsing of LLM responses
 */

import { z } from 'zod';

// =============================================================================
// RCA (Root Cause Analysis) Schema
// =============================================================================

export const RCAOutputSchema = z.object({
  summary: z.string().min(1, 'Summary is required'),
  error_type: z.enum([
    'RuntimeError',
    'TypeError',
    'NetworkError',
    'DatabaseError',
    'ValidationError',
    'AuthError',
    'Unknown',
  ]).default('Unknown'),
  root_cause: z.string().min(1, 'Root cause is required'),
  affected_component: z.string().optional(),
  suggested_fix: z.string().min(1, 'Suggested fix is required'),
  prevention: z.string().optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type RCAOutput = z.infer<typeof RCAOutputSchema>;

// =============================================================================
// Text-to-SQL Schema
// =============================================================================

export const TextToSQLOutputSchema = z.object({
  sql: z.string().min(1, 'SQL query is required'),
  params: z.array(z.union([z.string(), z.number(), z.boolean()])).default([]),
  explanation: z.string().optional(),
});

export type TextToSQLOutput = z.infer<typeof TextToSQLOutputSchema>;

// Validate SQL is SELECT only
export function validateSQLReadOnly(sql: string): boolean {
  const normalizedSql = sql.toUpperCase().trim();
  
  const dangerousKeywords = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 
    'ALTER', 'CREATE', 'GRANT', 'REVOKE', 'EXECUTE',
    'EXEC', 'CALL', 'MERGE', 'UPSERT'
  ];
  
  for (const keyword of dangerousKeywords) {
    // Check if keyword appears at start or after whitespace/newline
    const pattern = new RegExp(`(^|\\s)${keyword}\\s`, 'i');
    if (pattern.test(normalizedSql)) {
      return false;
    }
  }
  
  // Must start with SELECT or WITH (for CTEs)
  if (!normalizedSql.startsWith('SELECT') && !normalizedSql.startsWith('WITH')) {
    return false;
  }
  
  return true;
}

// =============================================================================
// Data Reporter Schema
// =============================================================================

export const DataReportOutputSchema = z.object({
  response: z.string().min(1, 'Response is required'),
  insights: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
});

export type DataReportOutput = z.infer<typeof DataReportOutputSchema>;

// =============================================================================
// Business Model Schema (existing)
// =============================================================================

export const LLMReplySchema = z.object({
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

export type LLMReply = z.infer<typeof LLMReplySchema>;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Clean JSON response from LLM (remove markdown code blocks)
 */
export function cleanLLMJsonResponse(response: string): string {
  let cleaned = response.trim();
  
  // Remove markdown code blocks
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```[a-zA-Z]*\n?/, '')
      .replace(/```$/, '')
      .trim();
  }
  
  // Try to extract JSON object if wrapped in other text
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      cleaned = match[0];
    }
  }
  
  return cleaned;
}

/**
 * Safe JSON parse with fallback
 */
export function safeParseJSON<T>(
  jsonString: string,
  schema: z.ZodType<T>,
): { success: true; data: T } | { success: false; error: string } {
  try {
    const cleaned = cleanLLMJsonResponse(jsonString);
    const parsed = JSON.parse(cleaned);
    const validated = schema.parse(parsed);
    return { success: true, data: validated };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}
