#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { ProjectContextAnalyzer } from './context-engine/index.js';

const AnalyzeProjectArgsSchema = z.object({
  projectPath: z.string().describe('The path to the project directory to analyze'),
  options: z.object({
    includePatterns: z.array(z.string()).optional().describe('File patterns to include (glob patterns)'),
    excludePatterns: z.array(z.string()).optional().describe('File patterns to exclude (glob patterns)'),
    maxDepth: z.number().optional().describe('Maximum directory depth to traverse'),
    analyzeTests: z.boolean().optional().describe('Whether to analyze test files'),
    analyzeConfig: z.boolean().optional().describe('Whether to analyze configuration files'),
  }).optional()
});

const GetContextTemplateArgsSchema = z.object({
  projectPath: z.string().describe('The path to the project directory to analyze'),
  templateOptions: z.object({
    targetSize: z.number().optional().describe('Target size for the compressed context in characters'),
    includeCode: z.boolean().optional().describe('Whether to include code snippets in the template'),
    focusAreas: z.array(z.string()).optional().describe('Specific areas to focus on (e.g., "api", "business-logic", "data-flow")')
  }).optional()
});

const AnalyzeFileArgsSchema = z.object({
  filePath: z.string().describe('The path to the file to analyze'),
  analysisType: z.enum(['dependencies', 'components', 'dataflow', 'all']).optional().describe('Type of analysis to perform')
});

const GetProjectSummaryArgsSchema = z.object({
  projectPath: z.string().describe('The path to the project directory')
});

class ContextEngineServer {
  private server: Server;
  private analyzer: ProjectContextAnalyzer;

  constructor() {
    this.analyzer = new ProjectContextAnalyzer();
    this.server = new Server(
      {
        name: 'context-engine-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'analyze_project',
          description: 'Analyze a project directory and extract comprehensive context including file structure, dependencies, components, data flow, and patterns',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'The path to the project directory to analyze',
              },
              options: {
                type: 'object',
                properties: {
                  includePatterns: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'File patterns to include (glob patterns)',
                  },
                  excludePatterns: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'File patterns to exclude (glob patterns)',
                  },
                  maxDepth: {
                    type: 'number',
                    description: 'Maximum directory depth to traverse',
                  },
                  analyzeTests: {
                    type: 'boolean',
                    description: 'Whether to analyze test files',
                  },
                  analyzeConfig: {
                    type: 'boolean',
                    description: 'Whether to analyze configuration files',
                  },
                },
              },
            },
            required: ['projectPath'],
          },
        },
        {
          name: 'get_context_template',
          description: 'Generate a compressed context template for the project, suitable for LLM consumption',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'The path to the project directory to analyze',
              },
              templateOptions: {
                type: 'object',
                properties: {
                  targetSize: {
                    type: 'number',
                    description: 'Target size for the compressed context in characters',
                  },
                  includeCode: {
                    type: 'boolean',
                    description: 'Whether to include code snippets in the template',
                  },
                  focusAreas: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Specific areas to focus on (e.g., "api", "business-logic", "data-flow")',
                  },
                },
              },
            },
            required: ['projectPath'],
          },
        },
        {
          name: 'analyze_file',
          description: 'Analyze a specific file for its components, dependencies, and role in the project',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'The path to the file to analyze',
              },
              analysisType: {
                type: 'string',
                enum: ['dependencies', 'components', 'dataflow', 'all'],
                description: 'Type of analysis to perform',
              },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'get_project_summary',
          description: 'Get a high-level summary of the project including tech stack, patterns, and key metrics',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'The path to the project directory',
              },
            },
            required: ['projectPath'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'analyze_project':
            return await this.handleAnalyzeProject(args);
          case 'get_context_template':
            return await this.handleGetContextTemplate(args);
          case 'analyze_file':
            return await this.handleAnalyzeFile(args);
          case 'get_project_summary':
            return await this.handleGetProjectSummary(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid arguments: ${error.errors.map(e => `${e.path}: ${e.message}`).join(', ')}`
          );
        }
        throw error;
      }
    });
  }

  private async handleAnalyzeProject(args: any): Promise<any> {
    const validatedArgs = AnalyzeProjectArgsSchema.parse(args);
    const { projectPath, options } = validatedArgs;

    try {
      // Check if directory exists
      await fs.access(projectPath);
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        throw new Error('Path is not a directory');
      }

      const analyzerOptions = options ? {
        maxDepth: options.maxDepth || 10,
        includeTests: options.analyzeTests ?? true,
        includeNodeModules: false,
        analyzeConfig: options.analyzeConfig ?? true
      } : undefined;

      const context = await this.analyzer.analyze(projectPath, analyzerOptions);
      
      const compressorOptions = {
        maxEntities: 100,
        minConfidence: 0.7,
        includeMetadata: true,
        targetSize: 50000,
        preserveImportant: true
      };

      const compressed = await this.analyzer.compress(context, compressorOptions);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(compressed, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error analyzing project: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async handleGetContextTemplate(args: any): Promise<any> {
    const validatedArgs = GetContextTemplateArgsSchema.parse(args);
    const { projectPath, templateOptions } = validatedArgs;

    try {
      const context = await this.analyzer.analyze(projectPath);
      
      const compressorOptions: any = {};
      const templateOpts: any = {};
      
      if (templateOptions) {
        if (templateOptions.targetSize !== undefined) {
          compressorOptions.targetSize = templateOptions.targetSize;
          templateOpts.targetSize = templateOptions.targetSize;
        }
        if (templateOptions.includeCode !== undefined) {
          templateOpts.includeCode = templateOptions.includeCode;
        }
        if (templateOptions.focusAreas !== undefined) {
          compressorOptions.focusAreas = templateOptions.focusAreas;
          templateOpts.focusAreas = templateOptions.focusAreas;
        }
      }
      
      const compressed = await this.analyzer.compress(context, Object.keys(compressorOptions).length > 0 ? compressorOptions : undefined);
      const template = this.analyzer.generateTemplate(compressed, Object.keys(templateOpts).length > 0 ? templateOpts : undefined);

      return {
        content: [
          {
            type: 'text',
            text: template,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error generating template: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async handleAnalyzeFile(args: any): Promise<any> {
    const validatedArgs = AnalyzeFileArgsSchema.parse(args);
    const { filePath, analysisType = 'all' } = validatedArgs;

    try {
      // Check if file exists
      await fs.access(filePath);
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new Error('Path is not a file');
      }

      // Use the real analyzer instead of simple regex methods
      const projectDir = path.dirname(filePath);
      const fullContext = await this.analyzer.analyze(projectDir, { maxDepth: 1 });
      
      const results: any = {};
      
      // Find the specific file in the analysis results
      const targetFile = path.resolve(filePath);
      const fileComponent = fullContext.components.find(c => path.resolve(c.path) === targetFile);
      
      if (analysisType === 'all' || analysisType === 'components') {
        // Get all components from this specific file
        results.components = fullContext.components.filter(c => path.resolve(c.path) === targetFile);
      }

      if (analysisType === 'all' || analysisType === 'dependencies') {
        // Get dependencies for this specific file
        results.dependencies = {
          imports: fullContext.dependencies.filter(d => d.source && path.resolve(d.source) === targetFile),
          exports: fullContext.dependencies.filter(d => d.target && path.resolve(d.target) === targetFile)
        };
      }

      if (analysisType === 'all' || analysisType === 'dataflow') {
        // Get API endpoints from this specific file
        const apiEndpoints = fullContext.apiContracts.endpoints.filter(e => 
          e.file && path.resolve(e.file) === targetFile
        );
        
        results.apiEndpoints = apiEndpoints;
        
        // Get data flow information
        results.dataflow = {
          nodes: fullContext.dataFlow.nodes.filter(n => 
            fullContext.components.some(c => c.name === n.name && path.resolve(c.path) === targetFile)
          ),
          connections: fullContext.dataFlow.connections.filter(c =>
            fullContext.components.some(comp => 
              (comp.name === c.from || comp.name === c.to) && path.resolve(comp.path) === targetFile
            )
          )
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error analyzing file: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async handleGetProjectSummary(args: any): Promise<any> {
    const validatedArgs = GetProjectSummaryArgsSchema.parse(args);
    const { projectPath } = validatedArgs;

    try {
      // Quick analysis with limited depth
      const options = { maxDepth: 3, analyzeTests: false };
      const context = await this.analyzer.analyze(projectPath, options);

      const summary = {
        overview: {
          totalFiles: this.countFiles(context.fileStructure),
          totalDirectories: this.countDirectories(context.fileStructure),
          mainLanguages: this.detectLanguages(context.fileStructure),
        },
        architecture: {
          patterns: context.patterns.architecturalPatterns.map((p) => p.type),
          designPatterns: context.patterns.designPatterns.map((p) => p.type),
          antiPatterns: context.patterns.antiPatterns.map((p) => p.type),
        },
        dependencies: {
          external: context.dependencies.filter((d) => d.type === 'external').length,
          internal: context.dependencies.filter((d) => d.type === 'internal').length,
          components: context.components.length,
        },
        apiEndpoints: context.apiContracts.endpoints.length,
        dataFlow: {
          nodes: context.dataFlow.nodes.length,
          connections: context.dataFlow.connections.length,
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting project summary: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  // Helper methods for single file analysis
  private extractComponentsFromFile(content: string, fileName: string): any[] {
    const components: any[] = [];
    const ext = path.extname(fileName).toLowerCase();

    if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
      let match;

      // Extract classes
      const classRegex = /(?:export\s+)?(?:default\s+)?class\s+(\w+)/g;
      while ((match = classRegex.exec(content)) !== null) {
        if (match[1]) {
          components.push({
            type: 'class',
            name: match[1],
            exported: content.substring(match.index - 20, match.index).includes('export'),
          });
        }
      }

      // Extract functions
      const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
      while ((match = functionRegex.exec(content)) !== null) {
        if (match[1]) {
          components.push({
            type: 'function',
            name: match[1],
            exported: content.substring(match.index - 20, match.index).includes('export'),
            async: content.substring(match.index - 20, match.index).includes('async'),
          });
        }
      }

      // Extract arrow functions
      const arrowFuncRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
      while ((match = arrowFuncRegex.exec(content)) !== null) {
        if (match[1]) {
          components.push({
            type: 'function',
            name: match[1],
            exported: content.substring(match.index - 20, match.index).includes('export'),
            arrow: true,
          });
        }
      }

      // Extract React components
      if (['.jsx', '.tsx'].includes(ext)) {
        const componentRegex = /(?:export\s+)?(?:default\s+)?(?:const|function)\s+(\w+)\s*[=:]\s*(?:\([^)]*\)|\w+)\s*(?:=>|{)[^}]*(?:return\s+)?(?:<|React\.createElement|jsx)/g;
        while ((match = componentRegex.exec(content)) !== null) {
          const componentName = match[1];
          const firstChar = componentName?.[0];
          if (componentName && componentName.length > 0 && firstChar && firstChar === firstChar.toUpperCase()) {
            components.push({
              type: 'react-component',
              name: componentName,
              exported: content.substring(match.index - 20, match.index).includes('export'),
            });
          }
        }
      }
    }

    return components;
  }

  private extractDependenciesFromFile(content: string, fileName: string): any {
    const dependencies = {
      imports: [] as any[],
      exports: [] as any[],
    };

    const ext = path.extname(fileName).toLowerCase();

    if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
      // Extract imports
      const importRegex = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        if (match[1]) {
          dependencies.imports.push({
            from: match[1],
            type: match[1].startsWith('.') ? 'local' : 'external',
          });
        }
      }

      // Extract require statements
      const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
      while ((match = requireRegex.exec(content)) !== null) {
        if (match[1]) {
          dependencies.imports.push({
            from: match[1],
            type: match[1].startsWith('.') ? 'local' : 'external',
            style: 'commonjs',
          });
        }
      }

      // Extract exports
      const exportRegex = /export\s+(?:default\s+)?(\w+|{[^}]+})/g;
      while ((match = exportRegex.exec(content)) !== null) {
        if (match[1]) {
          dependencies.exports.push({
            name: match[1],
            default: match[0].includes('default'),
          });
        }
      }
    }

    return dependencies;
  }

  private extractDataFlowFromFile(content: string, fileName: string): any {
    const dataFlow = {
      apiCalls: [] as any[],
      databaseOps: [] as any[],
      stateManagement: [] as any[],
    };

    // API calls
    const apiPatterns = [
      /fetch\s*\(['"]([^'"]+)['"]\)/g,
      /axios\.(get|post|put|delete|patch)\s*\(['"]([^'"]+)['"]\)/g,
      /\$\.ajax\s*\({[^}]*url:\s*['"]([^'"]+)['"]\)/g,
    ];

    for (const pattern of apiPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        dataFlow.apiCalls.push({
          url: match[1] || match[2],
          method: match[1] || 'unknown',
        });
      }
    }

    // Database operations
    const dbPatterns = [
      /\.(?:find|findOne|findById|create|update|delete|save|insert|select|from|where)\s*\(/g,
      /(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\s+/gi,
    ];

    for (const pattern of dbPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        dataFlow.databaseOps.push({
          operation: match[0].trim(),
          position: match.index,
        });
      }
    }

    // State management
    const statePatterns = [
      /useState\s*\(/g,
      /useReducer\s*\(/g,
      /dispatch\s*\(/g,
      /getState\s*\(/g,
      /setState\s*\(/g,
    ];

    for (const pattern of statePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        dataFlow.stateManagement.push({
          type: match[0].replace(/\s*\(/, ''),
          position: match.index,
        });
      }
    }

    return dataFlow;
  }

  private countFiles(node: any): number {
    if (!node) return 0;
    let count = node.type === 'file' ? 1 : 0;
    if (node.children) {
      for (const child of node.children) {
        count += this.countFiles(child);
      }
    }
    return count;
  }

  private countDirectories(node: any): number {
    if (!node) return 0;
    let count = node.type === 'directory' ? 1 : 0;
    if (node.children) {
      for (const child of node.children) {
        count += this.countDirectories(child);
      }
    }
    return count;
  }

  private detectLanguages(node: any): string[] {
    const languages = new Set<string>();
    
    const detectFromNode = (n: any) => {
      if (n.type === 'file' && n.name) {
        const ext = path.extname(n.name).toLowerCase();
        switch (ext) {
          case '.js':
          case '.jsx':
            languages.add('JavaScript');
            break;
          case '.ts':
          case '.tsx':
            languages.add('TypeScript');
            break;
          case '.py':
            languages.add('Python');
            break;
          case '.java':
            languages.add('Java');
            break;
          case '.cs':
            languages.add('C#');
            break;
          case '.go':
            languages.add('Go');
            break;
          case '.rs':
            languages.add('Rust');
            break;
          case '.php':
            languages.add('PHP');
            break;
          case '.rb':
            languages.add('Ruby');
            break;
          case '.cpp':
          case '.cc':
          case '.cxx':
            languages.add('C++');
            break;
          case '.c':
            languages.add('C');
            break;
          case '.swift':
            languages.add('Swift');
            break;
          case '.kt':
            languages.add('Kotlin');
            break;
        }
      }
      if (n.children) {
        for (const child of n.children) {
          detectFromNode(child);
        }
      }
    };

    detectFromNode(node);
    return Array.from(languages);
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Context Engine MCP server running on stdio');
  }
}

// Main entry point
const server = new ContextEngineServer();
server.run().catch(console.error);
