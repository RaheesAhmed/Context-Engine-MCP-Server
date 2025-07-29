import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { glob } from 'glob';
import { configManager } from '../config/index.js';
import logger, { PerformanceLogger, logMemoryUsage } from '../utils/logger.js';
import { 
  validatePath, 
  validateProjectPath, 
  validateFileSize, 
  isPathWithinDirectory 
} from '../utils/validation.js';
import { 
  FileNotFoundError, 
  FileSizeLimitError, 
  PathValidationError,
  ProcessingError,
  handleAsyncError 
} from '../utils/errors.js';
import { fileCache } from './cache-manager.js';
import type { FileInfo } from '../types/index.js';

export class FileManager {
  private static instance: FileManager;
  private readonly maxFileSize: number;
  private readonly supportedExtensions: Set<string>;

  private constructor() {
    this.maxFileSize = configManager.get('maxFileSize');
    this.supportedExtensions = new Set([
      '.js', '.jsx', '.mjs', '.cjs',
      '.ts', '.tsx',
      '.py', '.pyw',
      '.java',
      '.cs',
      '.cpp', '.cxx', '.cc', '.c++', '.c', '.h', '.hpp',
      '.php',
      '.rb',
      '.go',
      '.rs',
      '.vue',
      '.svelte',
      '.html', '.htm',
      '.css', '.scss', '.sass', '.less',
      '.json',
      '.yml', '.yaml',
      '.md', '.txt',
      '.xml',
      '.sql'
    ]);
  }

  static getInstance(): FileManager {
    if (!FileManager.instance) {
      FileManager.instance = new FileManager();
    }
    return FileManager.instance;
  }

  /**
   * Safely read a file with validation and caching
   */
  async readFile(filePath: string, useCache = true): Promise<string> {
    const perf = new PerformanceLogger(`readFile: ${filePath}`);

    try {
      // Validate path
      const normalizedPath = validatePath(filePath);
      const absolutePath = path.resolve(normalizedPath);

      // Check cache first
      if (useCache) {
        const cached = fileCache.get(absolutePath);
        if (cached) {
          perf.end({ cacheHit: true });
          return cached;
        }
      }

      // Check if file exists and get stats
      const stats = await fs.stat(absolutePath).catch(() => {
        throw new FileNotFoundError(absolutePath);
      });

      // Validate file size
      validateFileSize(stats.size, this.maxFileSize, absolutePath);

      // Read file content
      const content = await handleAsyncError(
        fs.readFile(absolutePath, 'utf-8'),
        { operation: 'read file', filePath: absolutePath }
      );

      // Cache the content if requested
      if (useCache) {
        const hash = this.generateFileHash(content);
        fileCache.set(absolutePath, content);
        
        logger.debug('File cached', { 
          filePath: absolutePath, 
          size: content.length,
          hash: hash.substring(0, 8)
        });
      }

      perf.end({ fileSize: stats.size, cached: false });
      return content;

    } catch (error) {
      perf.end({ error: true });
      throw error;
    }
  }

  /**
   * Safely write a file with backup creation
   */
  async writeFile(
    filePath: string, 
    content: string, 
    options: { 
      createBackup?: boolean; 
      ensureDirectory?: boolean;
      encoding?: BufferEncoding;
    } = {}
  ): Promise<void> {
    const perf = new PerformanceLogger(`writeFile: ${filePath}`);
    const { createBackup = true, ensureDirectory = true, encoding = 'utf-8' } = options;

    try {
      // Validate path
      const normalizedPath = validatePath(filePath);
      const absolutePath = path.resolve(normalizedPath);

      // Validate content size
      const contentSize = Buffer.byteLength(content, encoding);
      validateFileSize(contentSize, this.maxFileSize, absolutePath);

      // Ensure directory exists
      if (ensureDirectory) {
        await this.ensureDirectory(path.dirname(absolutePath));
      }

      // Create backup if file exists and backup is requested
      if (createBackup) {
        await this.createBackup(absolutePath);
      }

      // Write file
      await handleAsyncError(
        fs.writeFile(absolutePath, content, encoding),
        { operation: 'write file', filePath: absolutePath }
      );

      // Update cache
      fileCache.set(absolutePath, content);

      perf.end({ fileSize: contentSize, backedUp: createBackup });
      logger.info('File written successfully', { 
        filePath: absolutePath, 
        size: contentSize 
      });

    } catch (error) {
      perf.end({ error: true });
      throw error;
    }
  }

  /**
   * Safely delete a file with backup creation
   */
  async deleteFile(filePath: string, createBackup = true): Promise<void> {
    const perf = new PerformanceLogger(`deleteFile: ${filePath}`);

    try {
      // Validate path
      const normalizedPath = validatePath(filePath);
      const absolutePath = path.resolve(normalizedPath);

      // Check if file exists
      const exists = await this.fileExists(absolutePath);
      if (!exists) {
        logger.warn('Attempted to delete non-existent file', { filePath: absolutePath });
        return;
      }

      // Create backup if requested
      if (createBackup) {
        await this.createBackup(absolutePath);
      }

      // Delete file
      await handleAsyncError(
        fs.unlink(absolutePath),
        { operation: 'delete file', filePath: absolutePath }
      );

      // Remove from cache
      fileCache.delete(absolutePath);

      perf.end({ backedUp: createBackup });
      logger.info('File deleted successfully', { 
        filePath: absolutePath, 
        backedUp: createBackup 
      });

    } catch (error) {
      perf.end({ error: true });
      throw error;
    }
  }

  /**
   * Get file information with caching
   */
  async getFileInfo(filePath: string): Promise<FileInfo | null> {
    const perf = new PerformanceLogger(`getFileInfo: ${filePath}`);

    try {
      // Validate path
      const normalizedPath = validatePath(filePath);
      const absolutePath = path.resolve(normalizedPath);

      // Check cache first
      const cacheKey = `fileInfo:${absolutePath}`;
      const cached = fileCache.get(cacheKey);
      if (cached) {
        perf.end({ cacheHit: true });
        return cached;
      }

      // Get file stats
      const stats = await fs.stat(absolutePath).catch(() => null);
      if (!stats) {
        perf.end({ exists: false });
        return null;
      }

      // Validate file size
      if (stats.size > this.maxFileSize) {
        logger.warn('File too large for processing', { 
          filePath: absolutePath, 
          size: stats.size,
          maxSize: this.maxFileSize 
        });
        return null;
      }

      // Read content if file is supported
      const extension = path.extname(absolutePath).toLowerCase();
      let content = '';
      let structure = {
        functions: [],
        classes: [],
        exports: [],
        imports: [],
        variables: [],
        comments: []
      };

      if (this.supportedExtensions.has(extension) && stats.isFile()) {
        try {
          content = await this.readFile(absolutePath, false);
          const hash = this.generateFileHash(content);
          
          // Create file info
          const fileInfo: FileInfo = {
            path: path.relative(process.cwd(), absolutePath),
            absolutePath,
            language: this.detectLanguage(absolutePath),
            size: stats.size,
            lines: content.split('\n').length,
            hash,
            lastModified: stats.mtime,
            dependencies: [], // Will be filled by language analyzer
            structure, // Will be filled by language analyzer
            content: content.length > configManager.get('maxContentLength') 
              ? content.substring(0, configManager.get('maxContentLength')) + '\n... [truncated]'
              : content
          };

          // Cache file info
          fileCache.set(cacheKey, fileInfo, 3600000); // 1 hour TTL

          perf.end({ fileSize: stats.size, cached: false });
          return fileInfo;

        } catch (error) {
          logger.error('Error processing file info', { 
            filePath: absolutePath, 
            error: error instanceof Error ? error.message : String(error) 
          });
          return null;
        }
      }

      perf.end({ supported: false });
      return null;

    } catch (error) {
      perf.end({ error: true });
      throw error;
    }
  }

  /**
   * Find files matching patterns with exclusions
   */
  async findFiles(
    searchPath: string, 
    patterns: string[] = ['**/*'], 
    ignorePatterns: string[] = []
  ): Promise<string[]> {
    const perf = new PerformanceLogger(`findFiles: ${searchPath}`);

    try {
      // Validate and resolve search path
      const normalizedPath = validateProjectPath(searchPath);
      
      // Combine patterns with ignore patterns
      const allIgnorePatterns = [
        ...configManager.get('ignorePatterns'),
        ...ignorePatterns
      ];

      const globResults = await handleAsyncError(
        glob(patterns, {
          cwd: normalizedPath,
          ignore: allIgnorePatterns,
          absolute: true,
          dot: false
        }),
        { operation: 'find files', searchPath: normalizedPath }
      );

      // Convert glob results to strings - glob returns string[]
      const files = Array.isArray(globResults) ? globResults : [globResults];

      // Filter files by supported extensions and size
      const filteredFiles: string[] = [];
      
      for (const file of files) {
        try {
          const stats = await fs.stat(file);
          
          // Skip directories
          if (!stats.isFile()) continue;
          
          // Skip files that are too large
          if (stats.size > this.maxFileSize) {
            logger.debug('Skipping large file', { filePath: file, size: stats.size });
            continue;
          }

          // Check if extension is supported
          const extension = path.extname(file).toLowerCase();
          if (this.supportedExtensions.has(extension) || extension === '') {
            filteredFiles.push(file);
          }

        } catch (error) {
          logger.debug('Error checking file', { 
            filePath: file, 
            error: error instanceof Error ? error.message : String(error) 
          });
          continue;
        }
      }

      perf.end({ totalFiles: files.length, filteredFiles: filteredFiles.length });
      logMemoryUsage('find files');

      return filteredFiles;

    } catch (error) {
      perf.end({ error: true });
      throw error;
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      const normalizedPath = validatePath(filePath);
      const absolutePath = path.resolve(normalizedPath);
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a backup of a file
   */
  private async createBackup(filePath: string): Promise<void> {
    try {
      const exists = await this.fileExists(filePath);
      if (!exists) return;

      const backupDir = path.join(
        path.dirname(filePath),
        configManager.get('backupDirectory'),
        new Date().toISOString().split('T')[0]! // Today's date
      );

      await this.ensureDirectory(backupDir);

      const fileName = path.basename(filePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `${fileName}.${timestamp}.backup`);

      const content = await fs.readFile(filePath, 'utf-8');
      await fs.writeFile(backupPath, content, 'utf-8');

      logger.debug('Backup created', { originalFile: filePath, backupFile: backupPath });

    } catch (error) {
      logger.error('Failed to create backup', { 
        filePath, 
        error: error instanceof Error ? error.message : String(error) 
      });
      // Don't throw error for backup failures to avoid blocking the operation
    }
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new ProcessingError(
        'directory creation',
        `Failed to create directory: ${dirPath}`,
        { dirPath, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Generate MD5 hash of file content
   */
  private generateFileHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.pyw': 'python',
      '.java': 'java',
      '.cs': 'csharp',
      '.cpp': 'cpp',
      '.cxx': 'cpp',
      '.cc': 'cpp',
      '.c++': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.vue': 'vue',
      '.svelte': 'svelte',
    };

    const ext = path.extname(filePath).toLowerCase();
    return languageMap[ext] || 'text';
  }

  /**
   * Validate that a path is within project boundaries
   */
  validateProjectBoundaries(filePath: string, projectRoot: string): boolean {
    try {
      const normalizedFile = path.resolve(filePath);
      const normalizedRoot = path.resolve(projectRoot);
      return isPathWithinDirectory(normalizedFile, normalizedRoot);
    } catch {
      return false;
    }
  }

  /**
   * Get disk usage statistics for a directory
   */
  async getDiskUsage(dirPath: string): Promise<{
    totalFiles: number;
    totalSize: number;
    largestFile: { path: string; size: number } | null;
    filesByExtension: Record<string, { count: number; size: number }>;
  }> {
    const perf = new PerformanceLogger(`getDiskUsage: ${dirPath}`);

    try {
      const normalizedPath = validateProjectPath(dirPath);
      const files = await this.findFiles(normalizedPath);
      
      let totalSize = 0;
      let largestFile: { path: string; size: number } | null = null;
      const filesByExtension: Record<string, { count: number; size: number }> = {};

      for (const file of files) {
        try {
          const stats = await fs.stat(file);
          const size = stats.size;
          totalSize += size;

          // Track largest file
          if (!largestFile || size > largestFile.size) {
            largestFile = { path: file, size };
          }

          // Track by extension
          const ext = path.extname(file).toLowerCase() || '.txt';
          if (!filesByExtension[ext]) {
            filesByExtension[ext] = { count: 0, size: 0 };
          }
          filesByExtension[ext]!.count++;
          filesByExtension[ext]!.size += size;

        } catch (error) {
          logger.debug('Error getting file stats', { 
            filePath: file, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }

      const result = {
        totalFiles: files.length,
        totalSize,
        largestFile,
        filesByExtension
      };

      perf.end(result);
      return result;

    } catch (error) {
      perf.end({ error: true });
      throw error;
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    fileCache.clear();
    logger.info('File manager cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return fileCache.getStats();
  }
}

// Export singleton instance
export const fileManager = FileManager.getInstance();
