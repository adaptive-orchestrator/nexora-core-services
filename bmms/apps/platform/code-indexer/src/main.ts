// code-indexer/src/main.ts
import { NestFactory } from '@nestjs/core';
import { CodeIndexerModule } from './code-indexer.module';
import { ArchmindService } from './service/archmind.service';
import { EmbeddingService } from './service/embedding.service';
import { QdrantService } from './service/qdrant.service';
import { IndexStats } from './types';

async function bootstrap() {
  console.log('[CodeIndexer] Starting Code Indexer...\n');

  const app = await NestFactory.createApplicationContext(CodeIndexerModule);

  const archmind = app.get(ArchmindService);
  const embedding = app.get(EmbeddingService);
  const qdrant = app.get(QdrantService);

  const stats: IndexStats = {
    totalFiles: 0,
    totalChunks: 0,
    totalVectors: 0,
    startTime: Date.now(),
    endTime: 0,
    duration: 0,
  };

  try {
    // Step 1: Scan codebase
    console.log('Step 1: Scanning codebase...');
    const chunks = await archmind.scanCodebase();
    stats.totalChunks = chunks.length;
    console.log(`[CodeIndexer] Found ${chunks.length} code chunks\n`);

    if (chunks.length === 0) {
      console.warn('[WARNING] No code chunks found. Check WORKSPACE_PATH.');
      await app.close();
      return;
    }

    // Step 2: Generate embeddings
    console.log('Step 2: Generating embeddings...');
    const embeddings = await embedding.generateEmbeddings(chunks);
    stats.totalVectors = embeddings.length;
    console.log(`[CodeIndexer] Generated ${embeddings.length} embeddings\n`);

    // Step 3: Upsert to Qdrant
    console.log('Step 3: Upserting to Qdrant...');
    
    // Optional: Recreate collection (clean slate)
    const shouldRecreate = process.env.RECREATE_COLLECTION === 'true';
    if (shouldRecreate) {
      console.log('Recreating collection...');
      await qdrant.recreateCollection();
    }
    
    await qdrant.upsertEmbeddings(embeddings);
    console.log('[CodeIndexer] Upsert complete\n');

    // Step 4: Verify
    console.log('Step 4: Verifying collection...');
    const info = await qdrant.getCollectionInfo();
    console.log(`Vectors: ${info.vectors_count}`);
    console.log(`Points: ${info.points_count}\n`);

    stats.endTime = Date.now();
    stats.duration = stats.endTime - stats.startTime;

    console.log('[CodeIndexer] Indexing complete!');
    console.log(`Duration: ${(stats.duration / 1000).toFixed(2)}s`);
    console.log(`Total chunks: ${stats.totalChunks}`);
    console.log(`Total vectors: ${stats.totalVectors}`);

  } catch (error) {
    console.error('[ERROR] Indexing failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  // Check if watch mode
  const watchMode = process.env.WATCH_MODE === 'true';
  if (watchMode) {
    const intervalHours = parseInt(process.env.WATCH_INTERVAL_HOURS || '6', 10);
    console.log(`\nWatch mode enabled. Re-indexing every ${intervalHours} hours...`);
    
    // Keep app alive and re-index periodically
    setInterval(async () => {
      console.log('\nRe-indexing codebase...');
      try {
        const chunks = await archmind.scanCodebase();
        const embeddings = await embedding.generateEmbeddings(chunks);
        await qdrant.upsertEmbeddings(embeddings);
        console.log('[CodeIndexer] Re-indexing complete\n');
      } catch (error) {
        console.error('[ERROR] Re-indexing failed:', error.message);
      }
    }, intervalHours * 60 * 60 * 1000);

    // Keep process running
    console.log('Press Ctrl+C to stop...\n');
  } else {
    // Close app if not in watch mode
    await app.close();
    process.exit(0);
  }
}

bootstrap().catch((error) => {
  console.error('[FATAL] Fatal error:', error);
  process.exit(1);
});