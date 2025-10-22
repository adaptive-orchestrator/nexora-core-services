// code-indexer/src/services/archmind.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { CodeFile, CodeChunk } from '../types';
import * as crypto from 'crypto';

@Injectable()
export class ArchmindService {
  private readonly logger = new Logger(ArchmindService.name);
  private workspacePath: string;
  private excludePatterns: string[];
  private includePatterns: string[];
  private maxChunkSize: number;

  constructor(private configService: ConfigService) {
    this.workspacePath = this.configService.get<string>('WORKSPACE_PATH') || '/workspace';
    
    // Exclude patterns
    this.excludePatterns = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
      '**/*.min.js',
      '**/*.map',
      '**/.next/**',
      '**/out/**',
      '**/*.log',
      '**/test/**',
      '**/tests/**',
      '**/*.spec.ts',
      '**/*.test.ts',
    ];

    // Include patterns - Có thể override từ env
    const customPatterns = this.configService.get<string>('INCLUDE_PATTERNS');
    
    if (customPatterns) {
      // Từ env: INCLUDE_PATTERNS=**/*.service.ts,**/*.controller.ts
      this.includePatterns = customPatterns.split(',').map(p => p.trim());
      this.logger.log(`📝 Using custom patterns from .env`);
    } else {
      // Mặc định: Chỉ lấy files quan trọng
      const indexMode = this.configService.get<string>('INDEX_MODE') || 'essential';
      
      if (indexMode === 'full') {
        // Full mode: Index tất cả
        this.includePatterns = [
          '**/*.ts',
          '**/*.tsx',
          '**/*.js',
          '**/*.jsx',
          '**/*.py',
          '**/*.java',
          '**/*.go',
        ];
        this.logger.log(`📚 Index mode: FULL (all code files)`);
      } else if (indexMode === 'essential') {
        // Essential mode: Chỉ service, controller, module
        this.includePatterns = [
          '**/*.service.ts',
          '**/*.controller.ts',
          '**/*.module.ts',
          '**/*.gateway.ts',
          '**/*.resolver.ts',
          '**/*.entity.ts',
          '**/*.model.ts',
          '**/*.interface.ts',
        ];
        this.logger.log(`🎯 Index mode: ESSENTIAL (core files only)`);
      } else if (indexMode === 'minimal') {
        // Minimal mode: Chỉ service và controller
        this.includePatterns = [
          '**/*.service.ts',
          '**/*.controller.ts',
          '**/*.module.ts',
        ];
        this.logger.log(`⚡ Index mode: MINIMAL (services & controllers only)`);
      } else {
        // Custom patterns
        this.includePatterns = [indexMode];
      }
    }

    this.maxChunkSize = 3000;
    
    this.logger.log(`📁 Workspace: ${this.workspacePath}`);
    this.logger.log(`📋 Patterns: ${this.includePatterns.join(', ')}`);
    this.logger.log(`📏 Max chunk size: ${this.maxChunkSize} chars`);
  }

  /**
   * Quét toàn bộ codebase và trả về chunks
   */
  async scanCodebase(): Promise<CodeChunk[]> {
    this.logger.log('🔍 Scanning codebase...');

    // 1. Tìm tất cả files code
    const files = await this.findCodeFiles();
    this.logger.log(`📂 Found ${files.length} code files`);

    if (files.length === 0) {
      this.logger.warn('⚠️  No files found. Check WORKSPACE_PATH and patterns.');
      this.logger.warn(`   Workspace: ${this.workspacePath}`);
      this.logger.warn(`   Patterns: ${this.includePatterns.join(', ')}`);
      return [];
    }

    // Show preview
    if (files.length > 0) {
      this.logger.log(`📄 Sample files:`);
      files.slice(0, 5).forEach(f => {
        this.logger.log(`   - ${f.path} (${(f.size / 1024).toFixed(1)}KB)`);
      });
      if (files.length > 5) {
        this.logger.log(`   ... and ${files.length - 5} more`);
      }
    }

    // 2. Parse từng file thành chunks
    const allChunks: CodeChunk[] = [];
    
    for (const file of files) {
      try {
        const chunks = await this.parseFile(file);
        allChunks.push(...chunks);
      } catch (error) {
        this.logger.warn(`Failed to parse ${file.path}: ${error.message}`);
      }
    }

    this.logger.log(`✅ Extracted ${allChunks.length} chunks from ${files.length} files`);
    
    // Show chunk type distribution
    const typeCount = allChunks.reduce((acc, chunk) => {
      acc[chunk.type] = (acc[chunk.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    this.logger.log(`📊 Chunk types: ${JSON.stringify(typeCount)}`);
    
    return allChunks;
  }

  /**
   * Tìm tất cả files code
   */
  private async findCodeFiles(): Promise<CodeFile[]> {
    const filePaths: string[] = [];
    
    this.logger.log(`🔎 Searching with patterns...`);
    
    for (const pattern of this.includePatterns) {
      try {
        const matches = await glob(pattern, {
          cwd: this.workspacePath,
          ignore: this.excludePatterns,
          absolute: true,
          nodir: true, // Chỉ lấy files, không lấy directories
        });
        
        this.logger.log(`   ${pattern}: ${matches.length} files`);
        filePaths.push(...matches);
      } catch (error) {
        this.logger.warn(`Error with pattern ${pattern}: ${error.message}`);
      }
    }

    // Remove duplicates
    const uniquePaths = [...new Set(filePaths)];

    // Read file content
    const files: CodeFile[] = [];
    for (const filePath of uniquePaths) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);
        
        // Skip files quá lớn (>500KB)
        if (stats.size > 500000) {
          this.logger.warn(`⏭️  Skipping large file: ${filePath} (${(stats.size / 1024).toFixed(0)}KB)`);
          continue;
        }

        // Skip empty files
        if (content.trim().length === 0) {
          continue;
        }
        
        files.push({
          path: path.relative(this.workspacePath, filePath),
          content,
          language: this.detectLanguage(filePath),
          size: stats.size,
        });
      } catch (error) {
        this.logger.warn(`Cannot read file ${filePath}: ${error.message}`);
      }
    }

    return files;
  }

  /**
   * Parse 1 file thành nhiều chunks
   */
  private async parseFile(file: CodeFile): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];
    const lines = file.content.split('\n');

    // Strategy: Phân tích theo language
    if (file.language === 'typescript' || file.language === 'javascript') {
      chunks.push(...this.parseTypeScriptFile(file, lines));
    } else if (file.language === 'python') {
      chunks.push(...this.parsePythonFile(file, lines));
    } else {
      // Fallback: Split by sliding window
      chunks.push(...this.parseByWindow(file, lines));
    }

    // Filter chunks quá ngắn (< 50 chars)
    return chunks.filter(c => c.content.length > 50);
  }

  /**
   * Parse TypeScript/JavaScript file
   */
  private parseTypeScriptFile(file: CodeFile, lines: string[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    // Regex patterns
    const classPattern = /^\s*export\s+(abstract\s+)?class\s+(\w+)/;
    const functionPattern = /^\s*export\s+(async\s+)?function\s+(\w+)/;
    const interfacePattern = /^\s*export\s+interface\s+(\w+)/;
    const typePattern = /^\s*export\s+type\s+(\w+)/;
    const servicePattern = /^\s*@Injectable\(\)/;
    const componentPattern = /^\s*@Component\(/;
    const controllerPattern = /^\s*@Controller\(/;

    let currentChunk: { startLine: number; type: string; name?: string } | null = null;
    let buffer: string[] = [];
    let braceCount = 0;

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;

      // Detect start of new chunk
      if (classPattern.test(line)) {
        if (currentChunk) chunks.push(this.createChunk(file, currentChunk, buffer));
        const match = line.match(classPattern);
        currentChunk = { startLine: lineNum, type: 'class', name: match?.[2] };
        buffer = [line];
        braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      } else if (functionPattern.test(line)) {
        if (currentChunk) chunks.push(this.createChunk(file, currentChunk, buffer));
        const match = line.match(functionPattern);
        currentChunk = { startLine: lineNum, type: 'function', name: match?.[2] };
        buffer = [line];
        braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      } else if (interfacePattern.test(line)) {
        if (currentChunk) chunks.push(this.createChunk(file, currentChunk, buffer));
        const match = line.match(interfacePattern);
        currentChunk = { startLine: lineNum, type: 'interface', name: match?.[1] };
        buffer = [line];
        braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      } else if (typePattern.test(line)) {
        if (currentChunk) chunks.push(this.createChunk(file, currentChunk, buffer));
        const match = line.match(typePattern);
        currentChunk = { startLine: lineNum, type: 'interface', name: match?.[1] };
        buffer = [line];
        braceCount = 0;
      } else if (servicePattern.test(line) || componentPattern.test(line) || controllerPattern.test(line)) {
        if (currentChunk) chunks.push(this.createChunk(file, currentChunk, buffer));
        currentChunk = { startLine: lineNum, type: 'service', name: undefined };
        buffer = [line];
        braceCount = 0;
      } else if (currentChunk) {
        buffer.push(line);
        
        braceCount += (line.match(/{/g) || []).length;
        braceCount -= (line.match(/}/g) || []).length;

        if (braceCount === 0 && buffer.length > 5) {
          chunks.push(this.createChunk(file, currentChunk, buffer));
          currentChunk = null;
          buffer = [];
        } else if (buffer.join('\n').length > this.maxChunkSize) {
          chunks.push(this.createChunk(file, currentChunk, buffer));
          currentChunk = null;
          buffer = [];
        }
      }
    });

    if (currentChunk && buffer.length > 0) {
      chunks.push(this.createChunk(file, currentChunk, buffer));
    }

    return chunks;
  }

  /**
   * Parse Python file
   */
  private parsePythonFile(file: CodeFile, lines: string[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    const classPattern = /^class\s+(\w+)/;
    const functionPattern = /^def\s+(\w+)/;

    let currentChunk: { startLine: number; type: string; name?: string } | null = null;
    let buffer: string[] = [];
    let baseIndent = 0;

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const indent = line.search(/\S/);

      if (classPattern.test(line)) {
        if (currentChunk) chunks.push(this.createChunk(file, currentChunk, buffer));
        const match = line.match(classPattern);
        currentChunk = { startLine: lineNum, type: 'class', name: match?.[1] };
        buffer = [line];
        baseIndent = indent;
      } else if (functionPattern.test(line)) {
        if (currentChunk && indent <= baseIndent) {
          chunks.push(this.createChunk(file, currentChunk, buffer));
        }
        const match = line.match(functionPattern);
        currentChunk = { startLine: lineNum, type: 'function', name: match?.[1] };
        buffer = [line];
        baseIndent = indent;
      } else if (currentChunk) {
        if (indent !== -1 && indent <= baseIndent && buffer.length > 5) {
          chunks.push(this.createChunk(file, currentChunk, buffer));
          currentChunk = null;
          buffer = [];
        } else {
          buffer.push(line);
        }
      }
    });

    if (currentChunk && buffer.length > 0) {
      chunks.push(this.createChunk(file, currentChunk, buffer));
    }

    return chunks;
  }

  /**
   * Fallback: Split by sliding window
   */
  private parseByWindow(file: CodeFile, lines: string[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const windowSize = 100;
    const overlap = 20;

    for (let i = 0; i < lines.length; i += windowSize - overlap) {
      const window = lines.slice(i, i + windowSize);
      const content = window.join('\n');
      
      if (content.trim().length < 50) continue;
      
      chunks.push({
        id: this.generateChunkId(file.path, i),
        filePath: file.path,
        content,
        startLine: i + 1,
        endLine: Math.min(i + windowSize, lines.length),
        type: 'other',
        metadata: {
          language: file.language,
        },
      });
    }

    return chunks;
  }

  private createChunk(
    file: CodeFile,
    meta: { startLine: number; type: string; name?: string },
    buffer: string[],
  ): CodeChunk {
    let content = buffer.join('\n');
    
    if (content.length > this.maxChunkSize) {
      content = content.substring(0, this.maxChunkSize) + '\n// ... truncated';
    }

    return {
      id: this.generateChunkId(file.path, meta.startLine),
      filePath: file.path,
      content,
      startLine: meta.startLine,
      endLine: meta.startLine + buffer.length - 1,
      type: meta.type as any,
      name: meta.name,
      metadata: {
        language: file.language,
      },
    };
  }

  private generateChunkId(filePath: string, line: number): string {
    const hash = crypto.createHash('md5')
      .update(`${filePath}:${line}`)
      .digest('hex');
    return hash;
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath);
    const map: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.vue': 'vue',
      '.svelte': 'svelte',
    };
    return map[ext] || 'unknown';
  }
}