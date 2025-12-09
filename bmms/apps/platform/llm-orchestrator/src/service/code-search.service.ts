// apps/llm-orchestrator/src/services/code-search.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface CodeSearchResult {
  file_path: string;
  content: string;
  chunk_type: string;
  name?: string;
  score: number;
  start_line: number;
  end_line: number;
}

@Injectable()
export class CodeSearchService {
  private readonly logger = new Logger(CodeSearchService.name);
  private qdrantUrl: string;
  private collectionName: string;
  private geminiClient: GoogleGenerativeAI;
  private embeddingModel = 'text-embedding-004';
  private enabled: boolean;

  constructor(private configService: ConfigService) {
    this.qdrantUrl = this.configService.get<string>('QDRANT_URL') || 'http://localhost:6333';
    this.collectionName = this.configService.get<string>('QDRANT_COLLECTION') || 'codebase_embeddings';
    this.enabled = this.configService.get<string>('USE_RAG') === 'true';

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('[WARNING] GEMINI_API_KEY not found. Code search disabled.');
      this.enabled = false;
      return;
    }

    this.geminiClient = new GoogleGenerativeAI(apiKey);

    if (this.enabled) {
      this.logger.log('[LLM] Code Search Service initialized');
      this.logger.log(`   Qdrant: ${this.qdrantUrl}`);
      this.logger.log(`   Collection: ${this.collectionName}`);
    } else {
      this.logger.log('[LLM] Code Search disabled (USE_RAG=false)');
    }
  }

  /**
   * Check if RAG is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Tìm kiếm code liên quan đến query
   */
  async searchRelevantCode(query: string, limit = 3): Promise<CodeSearchResult[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      this.logger.log(`[LLM] Searching code for: "${query.substring(0, 50)}..."`);

      // 1. Generate embedding cho query
      const queryVector = await this.generateQueryEmbedding(query);

      // 2. Search trong Qdrant
      const response = await fetch(
        `${this.qdrantUrl}/collections/${this.collectionName}/points/search`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vector: queryVector,
            limit,
            with_payload: true,
            score_threshold: 0.5, // Chỉ lấy results có score > 0.5
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Qdrant search failed: ${response.status}`);
      }

      const data = await response.json();

      const results: CodeSearchResult[] = data.result.map((item: any) => ({
        file_path: item.payload.file_path,
        content: item.payload.content,
        chunk_type: item.payload.chunk_type,
        name: item.payload.name,
        score: item.score,
        start_line: item.payload.start_line,
        end_line: item.payload.end_line,
      }));

      this.logger.log(`[LLM] Found ${results.length} relevant code chunks`);

      if (results.length > 0) {
        results.forEach((r, i) => {
          this.logger.log(`   [${i + 1}] ${r.file_path}:${r.start_line} (score: ${r.score.toFixed(3)})`);
        });
      }

      return results;

    } catch (error) {
      this.logger.error(`[ERROR] Code search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate embedding cho query string
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      const model = this.geminiClient.getGenerativeModel({
        model: this.embeddingModel
      });

      const result = await model.embedContent(query);

      if (!result.embedding || !result.embedding.values) {
        throw new Error('Invalid embedding response from Gemini');
      }

      return result.embedding.values;

    } catch (error) {
      this.logger.error(`Gemini embedding failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Health check - kiểm tra Qdrant connection
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    if (!this.enabled) {
      return { healthy: false, message: 'RAG is disabled' };
    }

    try {
      const response = await fetch(`${this.qdrantUrl}/collections/${this.collectionName}`);

      if (!response.ok) {
        return { healthy: false, message: `Qdrant returned ${response.status}` };
      }

      const data = await response.json();
      const pointsCount = data.result?.points_count || 0;

      return {
        healthy: true,
        message: `Collection '${this.collectionName}' has ${pointsCount} points`
      };
    } catch (error) {
      return { healthy: false, message: error.message };
    }
  }

  /**
   * Format code context cho LLM prompt
   */
  formatCodeContext(results: CodeSearchResult[]): string {
    if (results.length === 0) return '';

    let context = '\n\n=== RELEVANT CODE CONTEXT ===\n';

    results.forEach((code, idx) => {
      context += `\n[${idx + 1}] ${code.file_path}`;
      if (code.name) {
        context += ` - ${code.chunk_type}: ${code.name}`;
      }
      context += ` (lines ${code.start_line}-${code.end_line})`;
      context += `\nRelevance: ${(code.score * 100).toFixed(1)}%\n`;
      context += '```typescript\n';

      // Truncate content nếu quá dài
      const content = code.content.length > 1000
        ? code.content.substring(0, 1000) + '\n// ... truncated'
        : code.content;

      context += content + '\n```\n';
    });

    context += '\n=== END CONTEXT ===\n';

    return context;
  }
  /**
 * Lấy tất cả embeddings từ Qdrant
 */
  async getAllEmbeddings(limit = 100, offset = 0): Promise<{
    points: CodeSearchResult[];
    total: number;
    hasMore: boolean;
  }> {
    if (!this.enabled) {
      return { points: [], total: 0, hasMore: false };
    }

    try {
      this.logger.log(`[LLM] Fetching embeddings (limit: ${limit}, offset: ${offset})`);

      // Get collection info để biết tổng số points
      const collectionInfo = await fetch(
        `${this.qdrantUrl}/collections/${this.collectionName}`
      );

      if (!collectionInfo.ok) {
        throw new Error(`Failed to get collection info: ${collectionInfo.status}`);
      }

      const collectionData = await collectionInfo.json();
      const totalPoints = collectionData.result?.points_count || 0;

      // Scroll qua tất cả points
      const response = await fetch(
        `${this.qdrantUrl}/collections/${this.collectionName}/points/scroll`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            limit,
            offset,
            with_payload: true,
            with_vector: false, // Không cần vector, chỉ lấy metadata
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Qdrant scroll failed: ${response.status}`);
      }

      const data = await response.json();

      const points: CodeSearchResult[] = data.result.points.map((item: any) => ({
        file_path: item.payload.file_path,
        content: item.payload.content,
        chunk_type: item.payload.chunk_type,
        name: item.payload.name,
        score: 1.0, // Không có score vì không phải search
        start_line: item.payload.start_line,
        end_line: item.payload.end_line,
      }));

      const hasMore = (offset + limit) < totalPoints;

      this.logger.log(`[LLM] Retrieved ${points.length}/${totalPoints} points`);

      return {
        points,
        total: totalPoints,
        hasMore,
      };

    } catch (error) {
      this.logger.error(`[ERROR] Get all embeddings failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lấy thống kê về embeddings
   */
  async getStats(): Promise<{
    total: number;
    byFileType: Record<string, number>;
    byChunkType: Record<string, number>;
  }> {
    if (!this.enabled) {
      return { total: 0, byFileType: {}, byChunkType: {} };
    }

    try {
      // Lấy tất cả points
      const allPoints = await this.getAllEmbeddings(10000, 0);

      const byFileType: Record<string, number> = {};
      const byChunkType: Record<string, number> = {};

      allPoints.points.forEach(point => {
        // File type (extension)
        const ext = point.file_path.split('.').pop() || 'unknown';
        byFileType[ext] = (byFileType[ext] || 0) + 1;

        // Chunk type
        byChunkType[point.chunk_type] = (byChunkType[point.chunk_type] || 0) + 1;
      });

      return {
        total: allPoints.total,
        byFileType,
        byChunkType,
      };

    } catch (error) {
      this.logger.error(`[ERROR] Get stats failed: ${error.message}`);
      throw error;
    }
  }
}