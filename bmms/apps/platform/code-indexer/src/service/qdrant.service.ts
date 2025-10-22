// code-indexer/src/services/qdrant.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { ConfigService } from '@nestjs/config';
import { EmbeddingPoint } from '../types';
import { EmbeddingService } from './embedding.service';

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private client: QdrantClient;
  private collectionName: string;
  private vectorSize: number;

  constructor(
    private configService: ConfigService,
    private embeddingService: EmbeddingService, // Inject để lấy vectorSize
  ) {
    const url = this.configService.get<string>('QDRANT_URL') || 'http://localhost:6333';
    this.collectionName = this.configService.get<string>('QDRANT_COLLECTION') || 'codebase_embeddings';
    
    // Lấy vector size từ EmbeddingService
    this.vectorSize = this.embeddingService.getVectorSize(); // 768 cho Gemini
    
    this.client = new QdrantClient({ url });
    this.logger.log(`Connected to Qdrant at ${url}`);
    this.logger.log(`Vector size: ${this.vectorSize}`);
  }

  async onModuleInit() {
    await this.ensureCollection();
  }

  /**
   * Tạo collection nếu chưa tồn tại
   */
  private async ensureCollection() {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(c => c.name === this.collectionName);

      if (!exists) {
        this.logger.log(`Creating collection: ${this.collectionName}`);
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize, // 768 cho Gemini
            distance: 'Cosine',
          },
        });
        this.logger.log(`✅ Collection created: ${this.collectionName}`);
      } else {
        this.logger.log(`✅ Collection already exists: ${this.collectionName}`);
      }
    } catch (error) {
      this.logger.error(`Failed to ensure collection: ${error.message}`);
      throw error;
    }
  }

  /**
   * Xóa toàn bộ collection và tạo lại
   */
  async recreateCollection() {
    try {
      this.logger.log(`Deleting collection: ${this.collectionName}`);
      await this.client.deleteCollection(this.collectionName);
      await this.ensureCollection();
    } catch (error) {
      this.logger.warn(`Could not delete collection: ${error.message}`);
      await this.ensureCollection();
    }
  }

  /**
   * Upsert embeddings vào Qdrant
   */
  async upsertEmbeddings(points: EmbeddingPoint[]) {
    if (points.length === 0) {
      this.logger.warn('No points to upsert');
      return;
    }

    this.logger.log(`Upserting ${points.length} points to Qdrant...`);

    // Batch upsert (1000 points mỗi lần)
    const batchSize = 1000;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: batch.map(p => ({
          id: p.id,
          vector: p.vector,
          payload: p.payload,
        })),
      });

      this.logger.log(`Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(points.length / batchSize)}`);
    }

    this.logger.log(`✅ Upserted total ${points.length} points`);
  }

  /**
   * Search vectors
   */
  async search(queryVector: number[], limit = 5) {
    const results = await this.client.search(this.collectionName, {
      vector: queryVector,
      limit,
      with_payload: true,
    });

    return results;
  }

  /**
   * Get collection info
   */
  async getCollectionInfo() {
    return await this.client.getCollection(this.collectionName);
  }
}