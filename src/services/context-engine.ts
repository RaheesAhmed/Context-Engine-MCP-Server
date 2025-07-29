import path from 'path';
import { configManager } from '../config/index.js';
import logger, { PerformanceLogger, logMemoryUsage } from '../utils/logger.js';
import { 
  validateInput,
  AnalyzeProjectSchema,
  SearchProjectSchema,
  EditMultipleFilesSchema,
  GetFileRelationshipsSchema
} from '../utils/validation.js';
import { 
  ProcessingError,
  handleAsyncError,
  createErrorFromUnknown 
} from '../utils/errors.js';
import { fileManager } from './file-manager.js';
import { LanguageAnalyzer } from './language-analyzer.js';
import { projectCache, analysisCache } from './cache-manager.js';
import type {
  ProjectContext,
  ProjectMetadata,
  SearchResult,
  FileChange,
  EditResult,
  FileRelationships,
  FileInfo
} from '../types/index.js';

export class ContextEngine {
  private static instance: ContextEngine;
  private watchedProjects = new Set<string>();

  private constructor() {
    logger.info('Context Engine initialized');
  }

  static getInstance(): ContextEngine {
    if (!ContextEngine.instance) {
      ContextEngine.instance = new ContextEngine();
    }
    return ContextEngine.instance;
  }

  /**
   * Analyze entire project structure and context
   */
  async analyzeProject(projectPath: string, forceRefresh = false): Promise<ProjectContext> {
    // Validate input
    const validatedInput = validateInput(AnalyzeProjectSchema, { projectPath, forceRefresh });
    const { projectPath: validatedPath } = validatedInput;

    const perf = new PerformanceLogger(`analyzeProject: ${validatedPath}`);
    const projectKey = path.resolve(validatedPath);

    try {
      // Check cache unless force refresh
      if (!forceRefresh) {
        const cached = projectCache.get(projectKey);
        if (cached) {
          perf.end({ cacheHit: true });
          logger.info('Project analysis retrieved from cache', { projectPath: validatedPath });
          return cached;
        }
      }

      logger.info('Starting project analysis', { projectPath: validatedPath, forceRefresh });

      // Find all relevant files
      const files = await fileManager.findFiles(validatedPath, configManager.get('filePatterns'));
      perf.checkpoint('files_found');

      // Extract project metadata
      const metadata = await this.extractProjectMetadata(validatedPath);
      perf.checkpoint('metadata_extracted');

      // Analyze files concurrently with batching
      const fileInfoMap = new Map<string, FileInfo>();
      const batchSize = 10; // Process files in batches to avoid overwhelming the system
      
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const batchPromises = batch.map(async (filePath) => {
          try {
            const fileInfo = await this.analyzeFile(filePath, validatedPath);
            if (fileInfo) {
              const relativePath = path.relative(validatedPath, filePath);
              fileInfoMap.set(relativePath, fileInfo);
            }
          } catch (error) {
            logger.warn('Failed to analyze file', { 
              filePath, 
              error: error instanceof Error ? error.message : String(error) 
            });
          }
        });

        await Promise.all(batchPromises);
        
        // Log progress for large projects
        if (files.length > 50) {
          logger.debug(`Analyzed ${Math.min(i + batchSize, files.length)}/${files.length} files`);
        }
      }

      perf.checkpoint('files_analyzed');
      logMemoryUsage('project analysis');

      // Build project structure
      const context: ProjectContext = {
        projectPath: projectKey,
        timestamp: new Date().toISOString(),
        files: fileInfoMap,
        structure: this.buildProjectStructure(fileInfoMap),
        metadata
      };

      // Cache the result
      projectCache.set(projectKey, context, 3600000); // 1 hour TTL
      this.watchedProjects.add(projectKey);

      const duration = perf.end({
        totalFiles: files.length,
        analyzedFiles: fileInfoMap.size,
        languages: context.structure.languages.length,
        frameworks: metadata.frameworks.length
      });

      logger.info('Project analysis completed', {
        projectPath: validatedPath,
        duration: `${duration.toFixed(2)}ms`,
        totalFiles: files.length,
        analyzedFiles: fileInfoMap.size,
        languages: context.structure.languages,
        frameworks: metadata.frameworks
      });

      return context;

    } catch (error) {
      perf.end({ error: true });
      const contextError = createErrorFromUnknown(error);
      logger.error('Project analysis failed', {
        projectPath: validatedPath,
        error: contextError.message,
        stack: contextError.stack
      });
      throw new ProcessingError(
        'project analysis',
        `Failed to analyze project: ${contextError.message}`,
        { projectPath: validatedPath }
      );
    }
  }

  /**
   * Get comprehensive project context
   */
  async getProjectContext(projectPath: string): Promise<ProjectContext | null> {
    const projectKey = path.resolve(projectPath);
    const cached = projectCache.get(projectKey);
    
    if (cached) {
      logger.debug('Retrieved project context from cache', { projectPath });
      return cached;
    }

    logger.warn('Project context not found, run analyze_project first', { projectPath });
    return null;
  }

  /**
   * Search across project files with intelligent filtering
   */
  async searchInProject(
    projectPath: string,
    query: string,
    options: {
      caseSensitive?: boolean;
      includeStructure?: boolean;
      filePatterns?: string[];
      maxResults?: number;
    } = {}
  ): Promise<SearchResult[]> {
    // Validate input
    const validatedInput = validateInput(SearchProjectSchema, {
      projectPath,
      query,
      caseSensitive: options.caseSensitive,
      includeStructure: options.includeStructure
    });

    const perf = new PerformanceLogger(`searchInProject: ${query}`);

    try {
      const context = await this.getProjectContext(projectPath);
      if (!context) {
        throw new ProcessingError(
          'search',
          'Project not analyzed. Please run analyze_project first.',
          { projectPath }
        );
      }

      const {
        caseSensitive = false,
        includeStructure = true,
        filePatterns = [],
        maxResults = 100
      } = options;

      const results: SearchResult[] = [];
      const searchRegex = new RegExp(query, caseSensitive ? 'g' : 'gi');

      // Filter files by patterns if specified
      const filesToSearch = filePatterns.length > 0
        ? Array.from(context.files.entries()).filter(([relativePath]) =>
            filePatterns.some(pattern => new RegExp(pattern).test(relativePath))
          )
        : Array.from(context.files.entries());

      for (const [relativePath, fileInfo] of filesToSearch) {
        if (results.length >= maxResults) break;

        const matches: SearchResult['matches'] = [];

        // Search in file content
        if (fileInfo.content) {
          const lines = fileInfo.content.split('\n');
          for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum]!;
            if (searchRegex.test(line)) {
              const contextStart = Math.max(0, lineNum - 2);
              const contextEnd = Math.min(lines.length, lineNum + 3);
              
              matches.push({
                line: lineNum + 1,
                content: line.trim(),
                context: lines.slice(contextStart, contextEnd)
              });

              // Reset regex for next search
              searchRegex.lastIndex = 0;
            }
          }
        }

        // Search in code structure if requested
        if (includeStructure && fileInfo.structure) {
          const structureTypes = ['functions', 'classes', 'exports'] as const;
          
          for (const type of structureTypes) {
            const items = fileInfo.structure[type] || [];
            for (const item of items) {
              if (searchRegex.test(item)) {
                matches.push({
                  type: type.slice(0, -1), // Remove 's' from end
                  name: item
                });
                searchRegex.lastIndex = 0;
              }
            }
          }
        }

        if (matches.length > 0) {
          results.push({
            file: relativePath,
            language: fileInfo.language,
            matches: matches.slice(0, 20) // Limit matches per file
          });
        }
      }

      perf.end({
        resultsCount: results.length,
        totalMatches: results.reduce((sum, r) => sum + r.matches.length, 0)
      });

      logger.info('Search completed', {
        query,
        projectPath,
        resultsCount: results.length,
        searchedFiles: filesToSearch.length
      });

      return results;

    } catch (error) {
      perf.end({ error: true });
      throw error;
    }
  }

  /**
   * Edit multiple files with coordinated changes and rollback capability
   */
  async editMultipleFiles(
    projectPath: string,
    changes: FileChange[]
  ): Promise<EditResult[]> {
    // Validate input
    const validatedInput = validateInput(EditMultipleFilesSchema, { projectPath, changes });
    const { changes: validatedChanges } = validatedInput;

    const perf = new PerformanceLogger(`editMultipleFiles: ${validatedChanges.length} files`);

    try {
      const results: EditResult[] = [];
      const processedFiles: string[] = [];

      // Create backup timestamp for this operation
      const operationId = Date.now().toString();
      logger.info('Starting multi-file edit operation', {
        operationId,
        projectPath,
        fileCount: validatedChanges.length
      });

      for (const change of validatedChanges) {
        try {
          const fullPath = path.resolve(projectPath, change.filePath);
          
          // Validate path is within project boundaries
          if (!fileManager.validateProjectBoundaries(fullPath, projectPath)) {
            throw new ProcessingError(
              'path validation',
              `File path is outside project boundaries: ${change.filePath}`,
              { filePath: change.filePath, projectPath }
            );
          }

          switch (change.action) {
            case 'create':
              await fileManager.writeFile(fullPath, change.content || '', {
                createBackup: change.backup !== false,
                ensureDirectory: true
              });
              results.push({ file: change.filePath, status: 'created' });
              break;

            case 'update':
              await fileManager.writeFile(fullPath, change.content || '', {
                createBackup: change.backup !== false,
                ensureDirectory: false
              });
              results.push({ file: change.filePath, status: 'updated' });
              break;

            case 'delete':
              await fileManager.deleteFile(fullPath, change.backup !== false);
              results.push({ file: change.filePath, status: 'deleted' });
              break;

            default:
              throw new ProcessingError(
                'invalid action',
                `Unknown action: ${(change as any).action}`,
                { action: (change as any).action }
              );
          }

          processedFiles.push(change.filePath);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          results.push({
            file: change.filePath,
            status: 'error',
            error: errorMessage
          });

          logger.error('File operation failed', {
            operationId,
            filePath: change.filePath,
            action: change.action,
            error: errorMessage
          });
        }
      }

      // Invalidate project cache to force re-analysis
      const projectKey = path.resolve(projectPath);
      projectCache.delete(projectKey);

      const duration = perf.end({
        totalFiles: validatedChanges.length,
        successfulFiles: results.filter(r => r.status !== 'error').length,
        failedFiles: results.filter(r => r.status === 'error').length
      });

      logger.info('Multi-file edit operation completed', {
        operationId,
        duration: `${duration.toFixed(2)}ms`,
        results: results.map(r => `${r.file}: ${r.status}`)
      });

      return results;

    } catch (error) {
      perf.end({ error: true });
      throw error;
    }
  }

  /**
   * Get file dependency relationships
   */
  async getFileRelationships(
    projectPath: string,
    targetFilePath?: string
  ): Promise<Record<string, FileRelationships>> {
    // Validate input
    const validatedInput = validateInput(GetFileRelationshipsSchema, { 
      projectPath, 
      filePath: targetFilePath 
    });

    const perf = new PerformanceLogger('getFileRelationships');

    try {
      const context = await this.getProjectContext(projectPath);
      if (!context) {
        throw new ProcessingError(
          'relationships',
          'Project not analyzed. Please run analyze_project first.',
          { projectPath }
        );
      }

      const relationships: Record<string, FileRelationships> = {};

      // If specific file requested, analyze only that file
      if (targetFilePath) {
        const fileInfo = context.files.get(targetFilePath);
        if (fileInfo) {
          relationships[targetFilePath] = {
            dependencies: fileInfo.dependencies,
            dependents: this.findDependents(targetFilePath, context)
          };
        }
      } else {
        // Analyze all files
        for (const [filePath, fileInfo] of context.files) {
          relationships[filePath] = {
            dependencies: fileInfo.dependencies,
            dependents: this.findDependents(filePath, context)
          };
        }
      }

      perf.end({ filesAnalyzed: Object.keys(relationships).length });

      return relationships;

    } catch (error) {
      perf.end({ error: true });
      throw error;
    }
  }

  /**
   * Get project statistics and health metrics
   */
  async getProjectStats(projectPath: string): Promise<{
    overview: {
      totalFiles: number;
      totalLines: number;
      languages: string[];
      frameworks: string[];
    };
    dependencies: {
      totalDependencies: number;
      circularDependencies: string[][];
      orphanedFiles: string[];
    };
    codeHealth: {
      averageFileSize: number;
      largestFiles: Array<{ file: string; size: number; lines: number }>;
      duplicatedCode: Array<{ files: string[]; similarity: number }>;
    };
    performance: {
      analysisTime: string;
      cacheHitRate: number;
      memoryUsage: string;
    };
  }> {
    const perf = new PerformanceLogger('getProjectStats');

    try {
      const context = await this.getProjectContext(projectPath);
      if (!context) {
        throw new ProcessingError(
          'stats',
          'Project not analyzed. Please run analyze_project first.',
          { projectPath }
        );
      }

      const files = Array.from(context.files.values());
      const totalLines = files.reduce((sum, file) => sum + file.lines, 0);
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      // Find largest files
      const largestFiles = files
        .sort((a, b) => b.size - a.size)
        .slice(0, 10)
        .map(file => ({
          file: file.path,
          size: file.size,
          lines: file.lines
        }));

      // Find orphaned files (files with no dependencies and no dependents)
      const relationships = await this.getFileRelationships(projectPath);
      const orphanedFiles = Object.entries(relationships)
        .filter(([, rel]) => rel.dependencies.length === 0 && rel.dependents.length === 0)
        .map(([filePath]) => filePath);

      // Get cache statistics
      const cacheStats = projectCache.getStats();

      const stats = {
        overview: {
          totalFiles: files.length,
          totalLines,
          languages: context.structure.languages,
          frameworks: context.metadata.frameworks
        },
        dependencies: {
          totalDependencies: Object.values(relationships).reduce(
            (sum, rel) => sum + rel.dependencies.length, 0
          ),
          circularDependencies: [], // TODO: Implement circular dependency detection
          orphanedFiles
        },
        codeHealth: {
          averageFileSize: Math.round(totalSize / files.length),
          largestFiles,
          duplicatedCode: [] // TODO: Implement code duplication detection
        },
        performance: {
          analysisTime: 'N/A', // Would need to track from last analysis
          cacheHitRate: cacheStats.size > 0 ? 0.8 : 0, // Rough estimate
          memoryUsage: cacheStats.memoryUsage
        }
      };

      perf.end(stats.overview);
      return stats;

    } catch (error) {
      perf.end({ error: true });
      throw error;
    }
  }

  /**
   * Clear all caches and reset state
   */
  clearAllCaches(): void {
    projectCache.clear();
    analysisCache.clear();
    fileManager.clearCache();
    this.watchedProjects.clear();
    
    logger.info('All caches cleared');
  }

  /**
   * Private helper methods
   */

  private async analyzeFile(filePath: string, projectRoot: string): Promise<FileInfo | null> {
    try {
      const fileInfo = await fileManager.getFileInfo(filePath);
      if (!fileInfo) return null;

      // Extract dependencies using language analyzer
      const dependencies = await LanguageAnalyzer.extractDependencies(
        fileInfo.content,
        fileInfo.language as any
      );

      // Extract code structure using language analyzer
      const structure = await LanguageAnalyzer.extractCodeStructure(
        fileInfo.content,
        fileInfo.language as any
      );

      return {
        ...fileInfo,
        dependencies,
        structure
      };

    } catch (error) {
      logger.error('Error analyzing file', {
        filePath,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  private async extractProjectMetadata(projectPath: string): Promise<ProjectMetadata> {
    const metadata: ProjectMetadata = {
      name: path.basename(projectPath),
      type: 'unknown',
      version: '0.0.0',
      description: '',
      dependencies: {},
      scripts: {},
      frameworks: []
    };

    try {
      // Check for package.json (Node.js)
      const packageJsonPath = path.join(projectPath, 'package.json');
      try {
        const packageJsonContent = await fileManager.readFile(packageJsonPath, false);
        const packageJson = JSON.parse(packageJsonContent);
        
        metadata.name = packageJson.name || metadata.name;
        metadata.version = packageJson.version || metadata.version;
        metadata.description = packageJson.description || '';
        metadata.dependencies = {
          ...(packageJson.dependencies || {}),
          ...(packageJson.devDependencies || {})
        };
        metadata.scripts = packageJson.scripts || {};
        metadata.type = 'nodejs';

        // Detect frameworks
        const deps = Object.keys(metadata.dependencies);
        if (deps.includes('react')) metadata.frameworks.push('React');
        if (deps.includes('vue')) metadata.frameworks.push('Vue');
        if (deps.includes('@angular/core')) metadata.frameworks.push('Angular');
        if (deps.includes('express')) metadata.frameworks.push('Express');
        if (deps.includes('next')) metadata.frameworks.push('Next.js');
        if (deps.includes('nuxt')) metadata.frameworks.push('Nuxt.js');
        if (deps.includes('svelte')) metadata.frameworks.push('Svelte');

      } catch (e) {
        // package.json not found or invalid
      }

      // Check for requirements.txt (Python)
      const reqPath = path.join(projectPath, 'requirements.txt');
      try {
        const requirements = await fileManager.readFile(reqPath, false);
        metadata.type = metadata.type === 'unknown' ? 'python' : metadata.type;
        
        const deps = requirements.split('\n')
          .filter(line => line.trim())
          .reduce((acc, line) => {
            const [pkg] = line.split(/[>=<]/);
            const trimmedPkg = pkg ? pkg.trim() : '';
            if (trimmedPkg.length > 0) {
              acc[trimmedPkg] = line;
            }
            return acc;
          }, {} as Record<string, string>);

        metadata.dependencies = { ...metadata.dependencies, ...deps };

        // Detect Python frameworks
        const depNames = Object.keys(deps);
        if (depNames.includes('django')) metadata.frameworks.push('Django');
        if (depNames.includes('flask')) metadata.frameworks.push('Flask');
        if (depNames.includes('fastapi')) metadata.frameworks.push('FastAPI');

      } catch (e) {
        // requirements.txt not found
      }

      // Check for README files
      const readmePatterns = ['README.md', 'README.txt', 'README.rst', 'readme.md'];
      for (const readme of readmePatterns) {
        try {
          const readmePath = path.join(projectPath, readme);
          const readmeContent = await fileManager.readFile(readmePath, false);
          metadata.readme = readmeContent.substring(0, 2000); // First 2000 chars
          break;
        } catch (e) {
          // README not found
        }
      }

    } catch (error) {
      logger.error('Error extracting project metadata', {
        projectPath,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return metadata;
  }

  private buildProjectStructure(files: Map<string, FileInfo>) {
    const languages = new Set<string>();
    const frameworks = new Set<string>();
    const functions: Record<string, string[]> = {};
    const classes: Record<string, string[]> = {};

    for (const [relativePath, fileInfo] of files) {
      languages.add(fileInfo.language);

      // Track functions and classes
      fileInfo.structure.functions.forEach(func => {
        if (!functions[func]) functions[func] = [];
        functions[func]!.push(relativePath);
      });

      fileInfo.structure.classes.forEach(cls => {
        if (!classes[cls]) classes[cls] = [];
        classes[cls]!.push(relativePath);
      });
    }

    return {
      totalFiles: files.size,
      languages: Array.from(languages),
      frameworks: Array.from(frameworks),
      dependencies: new Map<string, string[]>(),
      exports: new Map<string, string[]>(),
      functions,
      classes
    };
  }

  private findDependents(targetFile: string, context: ProjectContext): string[] {
    const dependents: string[] = [];

    for (const [filePath, fileInfo] of context.files) {
      if (filePath === targetFile) continue;

      // Check if this file depends on the target file
      const isDependent = fileInfo.dependencies.some(dep => {
        // Handle relative imports
        if (dep.startsWith('./') || dep.startsWith('../')) {
          const resolvedDep = path.resolve(path.dirname(filePath), dep);
          const resolvedTarget = path.resolve(targetFile);
          return resolvedDep === resolvedTarget || 
                 resolvedDep === resolvedTarget.replace(/\.[^.]+$/, '');
        }
        
        // Handle module imports that might match file names
        return dep.includes(path.basename(targetFile, path.extname(targetFile)));
      });

      if (isDependent) {
        dependents.push(filePath);
      }
    }

    return dependents;
  }
}

// Export singleton instance
export const contextEngine = ContextEngine.getInstance();
