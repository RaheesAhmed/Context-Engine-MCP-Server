import { DataFlow, Component } from '../types.js';
import { readFile } from 'fs/promises';

export class DataFlowAnalyzer {
  async analyze(projectPath: string, components: Component[], languages: string[]): Promise<DataFlow> {
    return {
      nodes: await this.extractDataFlowNodes(components, languages),
      connections: await this.extractDataFlowConnections(components, languages)
    };
  }

  private async extractDataFlowNodes(components: Component[], languages: string[]) {
    const nodes = [];
    
    for (const component of components) {
      if (component.language && languages.includes(component.language)) {
        // Analyze actual file content to determine node characteristics
        const nodeDetails = await this.analyzeComponentForDataFlow(component);
        
        nodes.push({
          id: component.name,
          name: component.name,
          type: nodeDetails.type,
          language: component.language,
          connections: nodeDetails.connections,
          dataTypes: nodeDetails.dataTypes,
          operations: nodeDetails.operations
        });
      }
    }

    return nodes;
  }

  private async extractDataFlowConnections(components: Component[], languages: string[]) {
    const connections = [];
    
    // Analyze actual code to find real connections
    for (const component of components) {
      if (component.language && languages.includes(component.language)) {
        try {
          const fileConnections = await this.analyzeFileForConnections(component, components);
          connections.push(...fileConnections);
        } catch (error) {
          console.warn(`Could not analyze data flows in ${component.path}: ${error}`);
        }
      }
    }

    return connections;
  }

  private async analyzeComponentForDataFlow(component: Component) {
    try {
      const content = await readFile(component.path, 'utf-8');
      
      return {
        type: this.determineNodeTypeFromContent(content, component),
        connections: [],
        dataTypes: this.extractDataTypes(content, component.language || 'unknown'),
        operations: this.extractDataOperations(content, component.language || 'unknown')
      };
    } catch (error) {
      return {
        type: 'process' as const,
        connections: [],
        dataTypes: [],
        operations: []
      };
    }
  }

  private async analyzeFileForConnections(component: Component, allComponents: Component[]) {
    const connections = [];
    
    try {
      const content = await readFile(component.path, 'utf-8');
      
      // Extract function calls, imports, and dependencies
      const dependencies = this.extractDependencies(content, component.language || 'unknown');
      const functionCalls = this.extractFunctionCalls(content, component.language || 'unknown');
      const dataTransfers = this.extractDataTransfers(content, component.language || 'unknown');
      
      // Map dependencies to actual components
      for (const dep of dependencies) {
        const targetComponent = allComponents.find(comp => 
          comp.name === dep || 
          comp.path.includes(dep) || 
          comp.path.endsWith(`${dep}.${this.getFileExtension(component.language || 'unknown')}`)
        );
        
        if (targetComponent) {
          connections.push({
            from: component.name,
            to: targetComponent.name,
            type: 'dependency' as const
          });
        }
      }
      
      // Map function calls to components
      for (const call of functionCalls) {
        const targetComponent = allComponents.find(comp => 
          comp.name === call.target ||
          content.includes(`import { ${call.target} }`) ||
          content.includes(`from '${call.target}'`)
        );
        
        if (targetComponent) {
          connections.push({
            from: component.name,
            to: targetComponent.name,
            type: 'control' as const
          });
        }
      }
      
      // Map data transfers
      for (const transfer of dataTransfers) {
        connections.push({
          from: component.name,
          to: transfer.target,
          type: 'data' as const
        });
      }
      
    } catch (error) {
      console.warn(`Could not read file ${component.path}: ${error}`);
    }
    
    return connections;
  }

  private determineNodeTypeFromContent(content: string, component: Component): 'input' | 'process' | 'output' | 'storage' | 'api' | 'database' | 'service' {
    // Database indicators
    if (this.hasPattern(content, [
      /SELECT\s+.*FROM/i, /INSERT\s+INTO/i, /UPDATE\s+.*SET/i, /DELETE\s+FROM/i,
      /mongoose\./i, /sequelize/i, /prisma\./i, /pool\.query/i,
      /db\./i, /database\./i, /collection\./i, /repository\./i
    ])) {
      return 'database';
    }
    
    // API indicators
    if (this.hasPattern(content, [
      /app\.(get|post|put|delete|patch)/i, /router\.(get|post|put|delete|patch)/i,
      /express\(\)/i, /fastify\(\)/i, /koa\(\)/i,
      /http\.createServer/i, /fetch\(/i, /axios\./i,
      /@(Get|Post|Put|Delete|Patch|Controller)/i
    ])) {
      return 'api';
    }
    
    // Input indicators
    if (this.hasPattern(content, [
      /input\s*=/i, /form/i, /stdin/i, /readline/i,
      /addEventListener.*input/i, /onChange/i, /onSubmit/i,
      /body-parser/i, /multer/i, /formidable/i
    ])) {
      return 'input';
    }
    
    // Output indicators  
    if (this.hasPattern(content, [
      /console\.(log|info|warn|error)/i, /print\(/i, /echo/i,
      /response\.(send|json|render)/i, /res\.(send|json|render)/i,
      /stdout/i, /stderr/i, /logger\./i
    ])) {
      return 'output';
    }
    
    // Storage indicators
    if (this.hasPattern(content, [
      /fs\.(readFile|writeFile|createReadStream|createWriteStream)/i,
      /localStorage/i, /sessionStorage/i, /redis\./i, /memcached/i,
      /cache\./i, /store\./i, /bucket\./i, /s3\./i
    ])) {
      return 'storage';
    }
    
    // Service indicators
    if (this.hasPattern(content, [
      /class.*Service/i, /function.*Service/i, /service\s*=/i,
      /microservice/i, /grpc/i, /kafka\./i, /rabbitmq/i
    ]) || component.name.toLowerCase().includes('service')) {
      return 'service';
    }
    
    return 'process';
  }

  private extractDataTypes(content: string, language: string): string[] {
    const dataTypes = new Set<string>();
    
    switch (language) {
      case 'TypeScript':
        // Extract TypeScript interfaces and types
        const tsTypeMatches = content.matchAll(/(?:interface|type)\s+(\w+)/g);
        for (const match of tsTypeMatches) {
          if (match[1]) dataTypes.add(match[1]);
        }
        
        // Extract variable types
        const tsVarMatches = content.matchAll(/:\s*(\w+)[\[\]]*[,\)\;]/g);
        for (const match of tsVarMatches) {
          if (match[1] && !['string', 'number', 'boolean', 'void', 'any'].includes(match[1])) {
            dataTypes.add(match[1]);
          }
        }
        break;
        
      case 'Python':
        // Extract Python type hints
        const pyTypeMatches = content.matchAll(/:\s*(\w+)\s*[=,\)]/g);
        for (const match of pyTypeMatches) {
          if (match[1]) dataTypes.add(match[1]);
        }
        
        // Extract class definitions
        const pyClassMatches = content.matchAll(/class\s+(\w+)/g);
        for (const match of pyClassMatches) {
          if (match[1]) dataTypes.add(match[1]);
        }
        break;
        
      case 'Java':
        // Extract Java class types
        const javaTypeMatches = content.matchAll(/(?:class|interface|enum)\s+(\w+)/g);
        for (const match of javaTypeMatches) {
          if (match[1]) dataTypes.add(match[1]);
        }
        break;
        
      case 'Go':
        // Extract Go struct types
        const goTypeMatches = content.matchAll(/type\s+(\w+)\s+(?:struct|interface)/g);
        for (const match of goTypeMatches) {
          if (match[1]) dataTypes.add(match[1]);
        }
        break;
        
      case 'Rust':
        // Extract Rust struct and enum types
        const rustTypeMatches = content.matchAll(/(?:struct|enum|trait)\s+(\w+)/g);
        for (const match of rustTypeMatches) {
          if (match[1]) dataTypes.add(match[1]);
        }
        break;
    }
    
    return Array.from(dataTypes);
  }

  private extractDataOperations(content: string, language: string): string[] {
    const operations = new Set<string>();
    
    // Database operations
    if (this.hasPattern(content, [/SELECT/i])) operations.add('SELECT');
    if (this.hasPattern(content, [/INSERT/i])) operations.add('INSERT');
    if (this.hasPattern(content, [/UPDATE/i])) operations.add('UPDATE');
    if (this.hasPattern(content, [/DELETE/i])) operations.add('DELETE');
    
    // File operations
    if (this.hasPattern(content, [/readFile|read/i])) operations.add('READ');
    if (this.hasPattern(content, [/writeFile|write/i])) operations.add('WRITE');
    
    // Network operations
    if (this.hasPattern(content, [/fetch|get|post|put|delete/i])) operations.add('HTTP_REQUEST');
    if (this.hasPattern(content, [/listen|serve/i])) operations.add('HTTP_SERVE');
    
    // Data transformation
    if (this.hasPattern(content, [/map\(/i])) operations.add('TRANSFORM');
    if (this.hasPattern(content, [/filter\(/i])) operations.add('FILTER');
    if (this.hasPattern(content, [/reduce\(/i])) operations.add('AGGREGATE');
    if (this.hasPattern(content, [/sort\(/i])) operations.add('SORT');
    
    // Validation
    if (this.hasPattern(content, [/validate|validator/i])) operations.add('VALIDATE');
    
    // Parsing
    if (this.hasPattern(content, [/JSON\.parse|json\(\)/i])) operations.add('PARSE_JSON');
    if (this.hasPattern(content, [/JSON\.stringify/i])) operations.add('SERIALIZE_JSON');
    
    return Array.from(operations);
  }

  private extractDependencies(content: string, language: string): string[] {
    const dependencies = new Set<string>();
    
    switch (language) {
      case 'TypeScript':
      case 'JavaScript':
        // Extract ES6 imports
        const importMatches = content.matchAll(/import\s+.*from\s+['"]([^'"]+)['"]/g);
        for (const match of importMatches) {
          if (match[1] && !match[1].startsWith('.')) {
            dependencies.add(match[1]);
          }
        }
        
        // Extract require statements
        const requireMatches = content.matchAll(/require\(['"]([^'"]+)['"]\)/g);
        for (const match of requireMatches) {
          if (match[1] && !match[1].startsWith('.')) {
            dependencies.add(match[1]);
          }
        }
        break;
        
      case 'Python':
        // Extract Python imports
        const pyImportMatches = content.matchAll(/(?:from\s+(\w+)|import\s+(\w+))/g);
        for (const match of pyImportMatches) {
          const module = match[1] || match[2];
          if (module) dependencies.add(module);
        }
        break;
        
      case 'Java':
        // Extract Java imports
        const javaImportMatches = content.matchAll(/import\s+([a-zA-Z0-9_.]+)/g);
        for (const match of javaImportMatches) {
          if (match[1]) dependencies.add(match[1]);
        }
        break;
        
      case 'Go':
        // Extract Go imports
        const goImportMatches = content.matchAll(/import\s+(?:"([^"]+)"|'([^']+)')/g);
        for (const match of goImportMatches) {
          const module = match[1] || match[2];
          if (module) dependencies.add(module);
        }
        break;
    }
    
    return Array.from(dependencies);
  }

  private extractFunctionCalls(content: string, language: string): Array<{target: string, dataType: string, operation: string}> {
    const calls = [];
    
    // Extract function calls with patterns like: functionName(args)
    const callMatches = content.matchAll(/(\w+)\s*\([^)]*\)/g);
    for (const match of callMatches) {
      if (match[1] && !['if', 'while', 'for', 'switch', 'catch'].includes(match[1])) {
        calls.push({
          target: match[1],
          dataType: 'unknown',
          operation: 'CALL'
        });
      }
    }
    
    // Extract method calls with patterns like: object.method(args)
    const methodMatches = content.matchAll(/(\w+)\.(\w+)\s*\([^)]*\)/g);
    for (const match of methodMatches) {
      if (match[2] && match[1]) {
        calls.push({
          target: match[2],
          dataType: match[1],
          operation: 'METHOD_CALL'
        });
      }
    }
    
    return calls;
  }

  private extractDataTransfers(content: string, language: string): Array<{target: string, type: string, dataType: string, operation: string}> {
    const transfers = [];
    
    // HTTP requests
    const httpMatches = content.matchAll(/(?:fetch|axios|http)\s*\(\s*['"]([^'"]+)['"]/g);
    for (const match of httpMatches) {
      if (match[1]) {
        transfers.push({
          target: match[1],
          type: 'http_request',
          dataType: 'http',
          operation: 'REQUEST'
        });
      }
    }
    
    // Database queries
    const dbMatches = content.matchAll(/(?:query|execute)\s*\(\s*['"]([^'"]+)['"]/g);
    for (const match of dbMatches) {
      if (match[1]) {
        transfers.push({
          target: 'database',
          type: 'database_query',
          dataType: 'sql',
          operation: 'QUERY'
        });
      }
    }
    
    // File I/O
    const fileMatches = content.matchAll(/(?:readFile|writeFile|open)\s*\(\s*['"]([^'"]+)['"]/g);
    for (const match of fileMatches) {
      if (match[1]) {
        transfers.push({
          target: match[1],
          type: 'file_io',
          dataType: 'file',
          operation: 'FILE_ACCESS'
        });
      }
    }
    
    return transfers;
  }

  private hasPattern(content: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(content));
  }

  private getFileExtension(language: string): string {
    const extensions: { [key: string]: string } = {
      'JavaScript': 'js',
      'TypeScript': 'ts', 
      'Python': 'py',
      'Java': 'java',
      'Go': 'go',
      'Rust': 'rs',
      'C#': 'cs',
      'PHP': 'php',
      'Ruby': 'rb'
    };
    return extensions[language] || 'txt';
  }
}
