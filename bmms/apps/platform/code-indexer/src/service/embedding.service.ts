// code-indexer/src/services/embedding.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CodeChunk, EmbeddingPoint } from '../types';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private geminiClient: GoogleGenerativeAI;
  private embeddingModel = 'text-embedding-004';
  private vectorSize = 768;
  private maxRetries = 3;
  private retryDelay = 15000; // 15 giây
  private requestDelay = 13000; // 13 giây giữa mỗi request (an toàn hơn 12s)

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required for embedding generation');
    }
    
    // Override từ env nếu có
    this.requestDelay = this.configService.get<number>('GEMINI_REQUEST_DELAY') || 13000;
    
    this.geminiClient = new GoogleGenerativeAI(apiKey);
    this.logger.log('[CodeIndexer] Gemini Embedding service initialized');
    this.logger.log(`[CodeIndexer] Rate limit: ${this.requestDelay}ms between requests`);
  }

  getVectorSize(): number {
    return this.vectorSize;
  }

  /**
   * Generate embeddings cho nhiều chunks (SEQUENTIAL - từng cái một)
   */
  async generateEmbeddings(chunks: CodeChunk[]): Promise<EmbeddingPoint[]> {
    if (chunks.length === 0) return [];

    const totalChunks = chunks.length;
    const estimatedTimeMinutes = Math.ceil((totalChunks * this.requestDelay) / 1000 / 60);
    
    this.logger.log(`[CodeIndexer] Generating embeddings for ${totalChunks} chunks...`);
    this.logger.log(`[CodeIndexer] Estimated time: ~${estimatedTimeMinutes} minutes`);
    this.logger.log(`[CodeIndexer] Rate limit: 1 request every ${this.requestDelay / 1000}s`);

    const points: EmbeddingPoint[] = [];
    const startTime = Date.now();

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const progress = i + 1;
      const percentage = ((progress / totalChunks) * 100).toFixed(1);
      
      try {
        this.logger.log(`[${progress}/${totalChunks}] (${percentage}%) Processing: ${chunk.filePath}:${chunk.startLine}`);
        
        const point = await this.generateSingleEmbeddingWithRetry(chunk);
        points.push(point);
        
        // Show time stats every 10 chunks
        if (progress % 10 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
          const remaining = ((totalChunks - progress) * this.requestDelay / 1000 / 60).toFixed(1);
          this.logger.log(`[CodeIndexer] Progress: ${progress}/${totalChunks} | Elapsed: ${elapsed}min | Remaining: ~${remaining}min`);
        }

        // Delay giữa các requests (trừ request cuối)
        if (i < chunks.length - 1) {
          this.logger.debug(`[CodeIndexer] Waiting ${this.requestDelay / 1000}s...`);
          await this.sleep(this.requestDelay);
        }

      } catch (error) {
        this.logger.error(`[ERROR] Failed chunk ${chunk.id} after retries: ${error.message}`);
        this.logger.warn(`[CodeIndexer] Skipping and continuing...`);
        // Continue với chunks khác
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    this.logger.log(`[CodeIndexer] Generated ${points.length}/${chunks.length} embeddings in ${totalTime} minutes`);
    
    if (points.length === 0) {
      throw new Error('Failed to generate any embeddings');
    }
    
    return points;
  }

  /**
   * Generate embedding với retry logic
   */
  private async generateSingleEmbeddingWithRetry(
    chunk: CodeChunk,
    attempt = 1
  ): Promise<EmbeddingPoint> {
    try {
      const text = this.prepareChunkForEmbedding(chunk);
      const vector = await this.generateGeminiEmbedding(text);

      return {
        id: chunk.id,
        vector,
        payload: {
          file_path: chunk.filePath,
          content: chunk.content,
          chunk_type: chunk.type,
          name: chunk.name,
          language: chunk.metadata?.language || 'unknown',
          start_line: chunk.startLine,
          end_line: chunk.endLine,
          dependencies: chunk.dependencies || [],
          timestamp: Date.now(),
        },
      };
    } catch (error) {
      if (attempt < this.maxRetries) {
        const delay = this.retryDelay * attempt;
        this.logger.warn(
          `[WARNING] Retry ${attempt}/${this.maxRetries} for ${chunk.filePath}:${chunk.startLine} after ${delay / 1000}s`
        );
        await this.sleep(delay);
        return this.generateSingleEmbeddingWithRetry(chunk, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Generate embedding cho 1 query string
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    return this.generateGeminiEmbeddingWithRetry(query);
  }

  /**
   * Call Gemini Embedding API với retry
   */
  private async generateGeminiEmbeddingWithRetry(
    text: string,
    attempt = 1
  ): Promise<number[]> {
    try {
      return await this.generateGeminiEmbedding(text);
    } catch (error) {
      if (attempt < this.maxRetries) {
        const delay = this.retryDelay * attempt;
        this.logger.warn(`[WARNING] Retry ${attempt}/${this.maxRetries} after ${delay / 1000}s`);
        await this.sleep(delay);
        return this.generateGeminiEmbeddingWithRetry(text, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Call Gemini Embedding API
   */
  private async generateGeminiEmbedding(text: string): Promise<number[]> {
    try {
      const model = this.geminiClient.getGenerativeModel({ 
        model: this.embeddingModel 
      });

      // Timeout sau 30 giây
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Embedding timeout after 30s')), 30000)
      );

      const embeddingPromise = model.embedContent(text);
      
      const result = await Promise.race([embeddingPromise, timeoutPromise]);
      
      if (!result.embedding || !result.embedding.values) {
        throw new Error('Invalid embedding response from Gemini');
      }

      return result.embedding.values;

    } catch (error) {
      // Log chi tiết để debug
      if (error.message?.includes('429')) {
        this.logger.error('[ERROR] Rate limit exceeded! Increase delay in .env');
      }
      throw error;
    }
  }

  /**
   * Chuẩn bị text từ chunk để embedding
   */
  private prepareChunkForEmbedding(chunk: CodeChunk): string {
    let text = '';
    
    if (chunk.name) {
      text += `[${chunk.type}] ${chunk.name} in ${chunk.filePath}\n\n`;
    } else {
      text += `[${chunk.type}] in ${chunk.filePath}\n\n`;
    }
    
    text += chunk.content;

    // Truncate nếu quá dài
    if (text.length > 30000) {
      text = text.substring(0, 30000) + '...';
    }

    return text;
  }

  /**
   * Helper: Sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}