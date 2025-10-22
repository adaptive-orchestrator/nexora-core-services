// code-indexer/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ArchmindService } from './service/archmind.service';
import { EmbeddingService } from './service/embedding.service';
import { QdrantService } from './service/qdrant.service';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  providers: [
    ArchmindService,
    EmbeddingService,
    QdrantService,
  ],
  exports: [
    ArchmindService,
    EmbeddingService,
    QdrantService,
  ],
})
export class CodeIndexerModule {}