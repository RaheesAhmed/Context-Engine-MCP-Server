#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { contextEngine } from './services/context-engine.js';
import { configManager } from './config/index.js';
import logger, { logError, updateLoggerConfig } from './utils/logger.js';
import { 
  ContextEngineError, 
  isContextEngineError,
  createErrorFromUnknown 
} from './utils/errors.js';

// Initialize the MCP server using the new McpServer API
const server = new McpServer({
  name: 'context-engine',
  version: '2.0.0',
});

// Initialize configuration and logging first
async function initializeServer() {
  try {
    // Validate configuration
    const configValidation = configManager.validate();
    if (!configValidation.isValid) {
      logger.error('Invalid configuration', { errors: configValidation.errors });
      process.exit(1);
    }

    // Update logger configuration
    updateLoggerConfig();
    
    logger.info('Context Engine initialized');
  } catch (error) {
    const contextError = createErrorFromUnknown(error);
    logger.error('Failed to initialize server', {
      error: contextError.message,
      stack: contextError.stack
    });
    process.exit(1);
  }
}

// Initialize first
await initializeServer();

/**
 * Register Tools using the new API
 */

// Analyze Project Tool
server.registerTool(
  'analyze_project',
  {
    title: 'Analyze Project',
    description: 'Comprehensively analyze project structure, dependencies, and context with intelligent caching',
    inputSchema: {
      projectPath: z.string().describe('Absolute or relative path to the project directory to analyze'),
      forceRefresh: z.boolean().optional().default(false).describe('Force refresh of cached analysis (bypasses cache)')
    }
  },
  async ({ projectPath, forceRefresh }) => {
    try {
      logger.info('Starting project analysis', { 
        projectPath, 
        forceRefresh,
        tool: 'analyze_project' 
      });

      const context = await contextEngine.analyzeProject(projectPath, forceRefresh);

      const summary = {
        name: context.metadata.name,
        type: context.metadata.type,
        totalFiles: context.structure.totalFiles,
        languages: context.structure.languages,
        frameworks: context.metadata.frameworks,
        analyzedAt: context.timestamp
      };

      return {
        content: [
          {
            type: 'text',
            text: 
              `✅ Project Analysis Complete!\n\n` +
              `📁 Project: ${summary.name}\n` +
              `📊 Total Files: ${summary.totalFiles}\n` +
              `🔤 Languages: ${summary.languages.join(', ') || 'None detected'}\n` +
              `🚀 Frameworks: ${summary.frameworks.join(', ') || 'None detected'}\n` +
              `⚡ Functions: ${Object.keys(context.structure.functions).length}\n` +
              `🏗️ Classes: ${Object.keys(context.structure.classes).length}\n` +
              `📦 Dependencies: ${Object.keys(context.metadata.dependencies).length}\n` +
              `🕐 Analyzed: ${new Date(context.timestamp).toLocaleString()}\n\n` +
              `The project context is now available for advanced operations like multi-file editing, ` +
              `dependency analysis, intelligent search, and relationship mapping.`
          },
          {
            type: 'text',
            text: JSON.stringify({
              summary,
              structure: {
                ...context.structure,
                dependencies: Object.fromEntries(context.structure.dependencies),
                exports: Object.fromEntries(context.structure.exports)
              },
              metadata: context.metadata
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      const contextError = createErrorFromUnknown(error);
      logError(contextError, { tool: 'analyze_project', projectPath, forceRefresh });

      return {
        content: [
          {
            type: 'text',
            text: `❌ Error analyzing project: ${contextError.message}`
          }
        ],
        isError: true
      };
    }
  }
);

// Get Project Context Tool
server.registerTool(
  'get_project_context',
  {
    title: 'Get Project Context',
    description: 'Retrieve comprehensive context for a previously analyzed project from cache',
    inputSchema: {
      projectPath: z.string().describe('Path to the project directory')
    }
  },
  async ({ projectPath }) => {
    try {
      const context = await contextEngine.getProjectContext(projectPath);

      if (!context) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Project context not found for: ${projectPath}\n\n` +
                    `Please run 'analyze_project' first to build the project context.`
            }
          ]
        };
      }

      const contextSummary = {
        project: context.metadata,
        structure: {
          ...context.structure,
          dependencies: Object.fromEntries(context.structure.dependencies),
          exports: Object.fromEntries(context.structure.exports)
        },
        files: Object.fromEntries(
          Array.from(context.files.entries()).map(([path, info]) => [
            path,
            {
              language: info.language,
              size: info.size,
              lines: info.lines,
              functions: info.structure.functions.length,
              classes: info.structure.classes.length,
              dependencies: info.dependencies.length
            }
          ])
        ),
        analyzedAt: context.timestamp
      };

      return {
        content: [
          {
            type: 'text',
            text: `📋 Project Context Retrieved\n\n` +
                  `Project: ${context.metadata.name} (${context.metadata.type})\n` +
                  `Files: ${context.structure.totalFiles}\n` +
                  `Languages: ${context.structure.languages.join(', ')}\n` +
                  `Last analyzed: ${new Date(context.timestamp).toLocaleString()}`
          },
          {
            type: 'text',
            text: JSON.stringify(contextSummary, null, 2)
          }
        ]
      };
    } catch (error) {
      const contextError = createErrorFromUnknown(error);
      logError(contextError, { tool: 'get_project_context', projectPath });

      return {
        content: [
          {
            type: 'text',
            text: `❌ Error retrieving project context: ${contextError.message}`
          }
        ],
        isError: true
      };
    }
  }
);

// Search Project Tool
server.registerTool(
  'search_project',
  {
    title: 'Search Project',
    description: 'Intelligently search for code patterns, functions, or text across the entire project with structure awareness',
    inputSchema: {
      projectPath: z.string().describe('Path to the project directory (must be analyzed first)'),
      query: z.string().describe('Search query (supports regex patterns)'),
      caseSensitive: z.boolean().optional().default(false).describe('Perform case-sensitive search'),
      includeStructure: z.boolean().optional().default(true).describe('Include functions, classes, and exports in search'),
      filePatterns: z.array(z.string()).optional().describe('Optional file patterns to filter search scope'),
      maxResults: z.number().optional().default(100).describe('Maximum number of results to return')
    }
  },
  async ({ projectPath, query, caseSensitive, includeStructure, filePatterns, maxResults }) => {
    try {
      const searchOptions: {
        caseSensitive?: boolean;
        includeStructure?: boolean;
        filePatterns?: string[];
        maxResults?: number;
      } = {};

      if (caseSensitive !== undefined) searchOptions.caseSensitive = caseSensitive;
      if (includeStructure !== undefined) searchOptions.includeStructure = includeStructure;
      if (filePatterns !== undefined) searchOptions.filePatterns = filePatterns;
      if (maxResults !== undefined) searchOptions.maxResults = maxResults;

      const results = await contextEngine.searchInProject(projectPath, query, searchOptions);
      const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);

      return {
        content: [
          {
            type: 'text',
            text: 
              `🔍 Search Results for "${query}"\n\n` +
              `Found ${totalMatches} matches in ${results.length} files:\n\n` +
              results.map(result => 
                `📄 ${result.file} (${result.language}):\n` +
                result.matches.map(match => 
                  match.line 
                    ? `  Line ${match.line}: ${match.content}`
                    : `  ${match.type}: ${match.name}`
                ).join('\n')
              ).join('\n\n')
          },
          {
            type: 'text',
            text: JSON.stringify({
              query,
              totalMatches,
              fileCount: results.length,
              results
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      const contextError = createErrorFromUnknown(error);
      logError(contextError, { tool: 'search_project', projectPath, query });

      return {
        content: [
          {
            type: 'text',
            text: `❌ Error searching project: ${contextError.message}`
          }
        ],
        isError: true
      };
    }
  }
);

// Edit Multiple Files Tool
server.registerTool(
  'edit_multiple_files',
  {
    title: 'Edit Multiple Files',
    description: 'Edit multiple files simultaneously with coordinated changes, automatic backups, and rollback capability',
    inputSchema: {
      projectPath: z.string().describe('Path to the project directory'),
      changes: z.array(z.object({
        filePath: z.string().describe('Relative path to the file within the project'),
        action: z.enum(['create', 'update', 'delete']).describe('Action to perform on the file'),
        content: z.string().optional().describe('New file content (required for create/update actions)'),
        backup: z.boolean().optional().default(true).describe('Create backup before changes')
      })).min(1).max(50).describe('Array of file changes to apply atomically')
    }
  },
  async ({ projectPath, changes }) => {
    try {
      const results = await contextEngine.editMultipleFiles(projectPath, changes);
      const successCount = results.filter(r => r.status !== 'error').length;
      const errorCount = results.filter(r => r.status === 'error').length;

      return {
        content: [
          {
            type: 'text',
            text: 
              `📝 Multi-file Edit Complete!\n\n` +
              `✅ Successful: ${successCount} files\n` +
              `❌ Failed: ${errorCount} files\n\n` +
              `Results:\n` +
              results.map(r => 
                `${r.status === 'error' ? '❌' : '✅'} ${r.file}: ${r.status}` +
                (r.error ? ` (${r.error})` : '')
              ).join('\n') + 
              `\n\n⚡ Project context will be refreshed automatically.`
          },
          {
            type: 'text',
            text: JSON.stringify({
              summary: { successCount, errorCount, totalFiles: results.length },
              results
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      const contextError = createErrorFromUnknown(error);
      logError(contextError, { tool: 'edit_multiple_files', projectPath, changes });

      return {
        content: [
          {
            type: 'text',
            text: `❌ Error editing files: ${contextError.message}`
          }
        ],
        isError: true
      };
    }
  }
);

// Get File Relationships Tool
server.registerTool(
  'get_file_relationships',
  {
    title: 'Get File Relationships',
    description: 'Analyze and retrieve comprehensive file dependency relationships and import/export mappings',
    inputSchema: {
      projectPath: z.string().describe('Path to the project directory (must be analyzed first)'),
      filePath: z.string().optional().describe('Specific file to analyze relationships for (optional - analyzes all files if omitted)')
    }
  },
  async ({ projectPath, filePath }) => {
    try {
      const relationships = await contextEngine.getFileRelationships(projectPath, filePath);
      const fileCount = Object.keys(relationships).length;
      const totalDeps = Object.values(relationships).reduce((sum, rel) => sum + rel.dependencies.length, 0);
      const totalDependents = Object.values(relationships).reduce((sum, rel) => sum + rel.dependents.length, 0);

      return {
        content: [
          {
            type: 'text',
            text: 
              `🔗 File Relationships ${filePath ? `for ${filePath}` : 'Overview'}\n\n` +
              `📊 Analyzed: ${fileCount} files\n` +
              `📥 Total Dependencies: ${totalDeps}\n` +
              `📤 Total Dependents: ${totalDependents}\n\n` +
              Object.entries(relationships).map(([file, rels]) => 
                `📄 ${file}:\n` +
                `  📥 Imports: ${rels.dependencies.join(', ') || 'None'}\n` +
                `  📤 Used by: ${rels.dependents.join(', ') || 'None'}`
              ).join('\n\n')
          },
          {
            type: 'text',
            text: JSON.stringify({
              summary: { fileCount, totalDeps, totalDependents },
              relationships
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      const contextError = createErrorFromUnknown(error);
      logError(contextError, { tool: 'get_file_relationships', projectPath, filePath });

      return {
        content: [
          {
            type: 'text',
            text: `❌ Error getting file relationships: ${contextError.message}`
          }
        ],
        isError: true
      };
    }
  }
);

// Get Project Stats Tool
server.registerTool(
  'get_project_stats',
  {
    title: 'Get Project Statistics',
    description: 'Generate comprehensive project statistics, health metrics, and code quality insights',
    inputSchema: {
      projectPath: z.string().describe('Path to the project directory (must be analyzed first)')
    }
  },
  async ({ projectPath }) => {
    try {
      const stats = await contextEngine.getProjectStats(projectPath);

      return {
        content: [
          {
            type: 'text',
            text: 
              `📈 Project Statistics\n\n` +
              `📊 Overview:\n` +
              `  Files: ${stats.overview.totalFiles}\n` +
              `  Lines: ${stats.overview.totalLines.toLocaleString()}\n` +
              `  Languages: ${stats.overview.languages.join(', ')}\n` +
              `  Frameworks: ${stats.overview.frameworks.join(', ')}\n\n` +
              `🔗 Dependencies:\n` +
              `  Total: ${stats.dependencies.totalDependencies}\n` +
              `  Orphaned Files: ${stats.dependencies.orphanedFiles.length}\n\n` +
              `💻 Code Health:\n` +
              `  Avg File Size: ${stats.codeHealth.averageFileSize} bytes\n` +
              `  Largest Files: ${stats.codeHealth.largestFiles.slice(0, 3).map(f => f.file).join(', ')}\n\n` +
              `⚡ Performance:\n` +
              `  Cache Hit Rate: ${(stats.performance.cacheHitRate * 100).toFixed(1)}%\n` +
              `  Memory Usage: ${stats.performance.memoryUsage}`
          },
          {
            type: 'text',
            text: JSON.stringify(stats, null, 2)
          }
        ]
      };
    } catch (error) {
      const contextError = createErrorFromUnknown(error);
      logError(contextError, { tool: 'get_project_stats', projectPath });

      return {
        content: [
          {
            type: 'text',
            text: `❌ Error getting project stats: ${contextError.message}`
          }
        ],
        isError: true
      };
    }
  }
);

// Clear Cache Tool
server.registerTool(
  'clear_cache',
  {
    title: 'Clear Cache',
    description: 'Clear all cached project data and force fresh analysis on next request',
    inputSchema: {}
  },
  async () => {
    try {
      contextEngine.clearAllCaches();
      
      return {
        content: [
          {
            type: 'text',
            text: 
              `🗑️ Cache Cleared Successfully!\n\n` +
              `All cached project data has been removed. ` +
              `Run 'analyze_project' to rebuild project context.`
          }
        ]
      };
    } catch (error) {
      const contextError = createErrorFromUnknown(error);
      logError(contextError, { tool: 'clear_cache' });

      return {
        content: [
          {
            type: 'text',
            text: `❌ Error clearing cache: ${contextError.message}`
          }
        ],
        isError: true
      };
    }
  }
);

/**
 * Register Resources using the new API
 */

// Project Analysis Resource
server.registerResource(
  'project-analysis',
  'context://project-analysis',
  {
    title: 'Project Context Analysis',
    description: 'Complete project structure and context analysis with dependency tracking',
    mimeType: 'application/json'
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify({
        message: 'Use the analyze_project tool to analyze a specific project directory',
        usage: 'Call analyze_project with projectPath parameter',
        example: {
          tool: 'analyze_project',
          parameters: {
            projectPath: '/path/to/project',
            forceRefresh: false
          }
        }
      }, null, 2)
    }]
  })
);

// Search Results Resource
server.registerResource(
  'search-results',
  'context://search-results',
  {
    title: 'Project Search Results',
    description: 'Intelligent search across project files with code structure awareness',
    mimeType: 'application/json'
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify({
        message: 'Use the search_project tool to search across project files',
        usage: 'Call search_project with projectPath and query parameters',
        example: {
          tool: 'search_project',
          parameters: {
            projectPath: '/path/to/project',
            query: 'function name',
            caseSensitive: false,
            includeStructure: true
          }
        }
      }, null, 2)
    }]
  })
);

// File Relationships Resource
server.registerResource(
  'file-relationships',
  'context://file-relationships',
  {
    title: 'File Dependency Relationships',
    description: 'Comprehensive file dependency and relationship mapping',
    mimeType: 'application/json'
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify({
        message: 'Use the get_file_relationships tool to analyze file dependencies',
        usage: 'Call get_file_relationships with projectPath and optional filePath',
        example: {
          tool: 'get_file_relationships',
          parameters: {
            projectPath: '/path/to/project',
            filePath: 'src/components/Header.jsx' // optional
          }
        }
      }, null, 2)
    }]
  })
);

// Project Stats Resource
server.registerResource(
  'project-stats',
  'context://project-stats',
  {
    title: 'Project Statistics',
    description: 'Detailed project health metrics and code quality insights',
    mimeType: 'application/json'
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify({
        message: 'Project statistics are available after running analyze_project',
        note: 'Stats include code health metrics, dependency analysis, and performance data',
        availableAfter: 'analyze_project execution'
      }, null, 2)
    }]
  })
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);

logger.info('Context Engine MCP Server v2.0.0 started successfully');
