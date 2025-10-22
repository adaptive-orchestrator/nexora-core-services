// code-indexer/src/types/index.ts

export interface CodeFile {
  path: string;
  content: string;
  language: string;
  size: number;
}

export interface CodeChunk {
  id: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  type: 'function' | 'class' | 'interface' | 'component' | 'service' | 'module' | 'other';
  name?: string;
  dependencies?: string[];
  metadata?: {
    language: string;
    framework?: string;
    imports?: string[];
  };
}

export interface EmbeddingPoint {
  id: string;
  vector: number[];
  payload: {
    file_path: string;
    content: string;
    chunk_type: string;
    name?: string;
    language: string;
    start_line: number;
    end_line: number;
    dependencies?: string[];
    timestamp: number;
  };
}

export interface IndexStats {
  totalFiles: number;
  totalChunks: number;
  totalVectors: number;
  startTime: number;
  endTime: number;
  duration: number;
}