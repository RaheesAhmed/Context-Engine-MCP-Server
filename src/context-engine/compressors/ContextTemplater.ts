import { ProjectContext, CompressedContext, CompressorOptions, TemplateOptions } from '../types.js';

export class ContextTemplater {
  async createTemplate(context: ProjectContext, options?: CompressorOptions) {
    const componentMap = await this.buildComponentMap(context);
    const userFlows = await this.identifyUserFlows(context);
    const criticalPaths = await this.identifyCriticalPaths(context);
    const keyInsights = await this.extractKeyInsights(context);

    return {
      componentMap,
      userFlows,
      criticalPaths,
      keyInsights
    };
  }

  generateTemplate(compressed: CompressedContext, options?: TemplateOptions): string {
    const format = options?.format || 'markdown';
    const targetSize = options?.targetSize || 50000;
    const includeCode = options?.includeCode ?? false;

    switch (format) {
      case 'json':
        return this.generateJSONTemplate(compressed, options);
      case 'yaml':
        return this.generateYAMLTemplate(compressed, options);
      case 'markdown':
      default:
        return this.generateMarkdownTemplate(compressed, options);
    }
  }

  private async buildComponentMap(context: ProjectContext) {
    const componentMap: any = {};

    for (const component of context.components) {
      const integrations = this.findIntegrations(component, context);
      const lifecycle = this.determineLifecycle(component);
      const ioFlow = this.analyzeIOFlow(component, context);
      const features = this.extractFeatures(component);
      const capabilities = this.determineCapabilities(component);

      componentMap[component.name] = {
        pattern: this.classifyComponentPattern(component),
        language: component.language,
        integrates: integrations,
        lifecycle,
        io_flow: ioFlow,
        features,
        purpose: this.inferComponentPurpose(component),
        capabilities,
        dependencies: component.dependencies || []
      };
    }

    return componentMap;
  }

  private async identifyUserFlows(context: ProjectContext) {
    const flows = [];

    // Identify API-driven flows
    const apiFlows = this.identifyAPIFlows(context);
    flows.push(...apiFlows);

    // Identify UI-driven flows
    const uiFlows = this.identifyUIFlows(context);
    flows.push(...uiFlows);

    // Identify data processing flows
    const dataFlows = this.identifyDataProcessingFlows(context);
    flows.push(...dataFlows);

    return flows;
  }

  private async identifyCriticalPaths(context: ProjectContext) {
    const criticalPaths = [];

    // Main application flow
    const entryPoints = context.components.filter(c => 
      c.name.toLowerCase().includes('main') || 
      c.name.toLowerCase().includes('index') ||
      c.name.toLowerCase().includes('app')
    );

    if (entryPoints.length > 0) {
      criticalPaths.push({
        name: 'Application Bootstrap',
        description: 'Main application initialization and startup flow',
        flow: 'Entry Point → Core Services → UI/API Ready',
        components: entryPoints.map(c => c.name),
        risk: 'high' as const
      });
    }

    // API critical paths
    const apiComponents = context.components.filter(c =>
      c.name.toLowerCase().includes('api') ||
      c.name.toLowerCase().includes('controller') ||
      c.name.toLowerCase().includes('router')
    );

    if (apiComponents.length > 0) {
      criticalPaths.push({
        name: 'API Request Flow',
        description: 'Critical path for API request processing',
        flow: 'Request → Authentication → Controller → Service → Response',
        components: apiComponents.map(c => c.name),
        risk: 'medium' as const
      });
    }

    // Data persistence paths
    const dataComponents = context.components.filter(c =>
      c.name.toLowerCase().includes('repository') ||
      c.name.toLowerCase().includes('dao') ||
      c.name.toLowerCase().includes('model')
    );

    if (dataComponents.length > 0) {
      criticalPaths.push({
        name: 'Data Persistence',
        description: 'Critical path for data storage and retrieval',
        flow: 'Service → Repository → Database → Response',
        components: dataComponents.map(c => c.name),
        risk: 'high' as const
      });
    }

    return criticalPaths;
  }

  private async extractKeyInsights(context: ProjectContext): Promise<string[]> {
    const insights = [];

    // Language distribution insight
    const langCounts = context.languages.length;
    if (langCounts > 3) {
      insights.push(`Multi-language project with ${langCounts} languages: ${context.languages.join(', ')}`);
    } else {
      insights.push(`${context.mainLanguage || context.languages[0]} project${context.framework ? ` using ${context.framework}` : ''}`);
    }

    // Architecture insight
    const archPatterns = context.patterns.architecturalPatterns;
    if (archPatterns.length > 0) {
      insights.push(`Follows ${archPatterns.map(p => p.name).join(', ')} architectural pattern(s)`);
    }

    // Component distribution insight
    const componentTypes = new Map<string, number>();
    context.components.forEach(c => {
      componentTypes.set(c.type, (componentTypes.get(c.type) || 0) + 1);
    });

    const dominantType = Array.from(componentTypes.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    if (dominantType) {
      insights.push(`Primary component type: ${dominantType[0]} (${dominantType[1]} instances)`);
    }

    // API insight
    if (context.apiContracts.endpoints.length > 0) {
      insights.push(`Exposes ${context.apiContracts.endpoints.length} API endpoints`);
    }

    // Complexity insight
    const totalComplexity = context.patterns.antiPatterns.length * 3 + 
                           context.components.length + 
                           context.dependencies.length;
    
    insights.push(`Project complexity: ${this.getComplexityLevel(totalComplexity)}`);

    // Dependencies insight
    const externalDeps = context.dependencies.filter(d => d.type === 'external').length;
    const internalDeps = context.dependencies.filter(d => d.type === 'internal').length;
    
    insights.push(`${externalDeps} external dependencies, ${internalDeps} internal modules`);

    return insights;
  }

  private generateMarkdownTemplate(compressed: CompressedContext, options?: TemplateOptions): string {
    let template = `# Project Context Analysis

## Overview
- **Languages**: ${compressed.overview.languages.join(', ')}
- **Main Language**: ${compressed.overview.mainLanguage || 'Mixed'}
- **Framework**: ${compressed.overview.framework || 'Various/Custom'}
- **Total Files**: ${compressed.overview.totalFiles}
- **Components**: ${compressed.overview.totalComponents}
- **Complexity**: ${this.getComplexityLevel(compressed.overview.complexity || 0)}

## Key Insights
${compressed.template.keyInsights.map(insight => `- ${insight}`).join('\n')}

## Architecture Patterns
${compressed.patterns.filter(p => p.type === 'architectural').map(pattern => 
  `- **${pattern.name}**: ${pattern.instances[0]?.metadata?.description || 'Detected in project'}`
).join('\n') || '- No specific architectural patterns detected'}

## Component Map
`;

    // Add component map section
    const componentEntries = Object.entries(compressed.template.componentMap).slice(0, 20); // Limit for brevity
    for (const [name, details] of componentEntries) {
      template += `
### ${name}
- **Type**: ${details.pattern}${details.language ? ` (${details.language})` : ''}
- **Purpose**: ${details.purpose}
- **Integrations**: ${details.integrates.join(', ') || 'None'}
- **Features**: ${details.features?.join(', ') || 'Basic'}
`;
    }

    // Add user flows section
    template += `
## User Flows
`;
    for (const flow of compressed.template.userFlows.slice(0, 5)) {
      template += `
### ${flow.name}
${flow.description ? `*${flow.description}*` : ''}
${flow.steps.map(step => `1. ${step.step}`).join('\n')}
`;
    }

    // Add critical paths section
    template += `
## Critical Paths
`;
    for (const path of compressed.template.criticalPaths) {
      template += `
### ${path.name} (${path.risk?.toUpperCase() || 'UNKNOWN'} RISK)
${path.description}

**Flow**: ${path.flow}
**Components**: ${path.components.join(' → ')}
`;
    }

    // Add semantic network summary
    const topEntities = compressed.semanticNetwork.entities.slice(0, 10);
    template += `
## Key Components & Relationships
${topEntities.map(entity => 
  `- **${entity.name}**: ${entity.purpose}${entity.language ? ` (${entity.language})` : ''}`
).join('\n')}

**Total Relationships**: ${compressed.semanticNetwork.relationships.length}
`;

    return template;
  }

  private generateJSONTemplate(compressed: CompressedContext, options?: TemplateOptions): string {
    return JSON.stringify(compressed, null, 2);
  }

  private generateYAMLTemplate(compressed: CompressedContext, options?: TemplateOptions): string {
    // Simple YAML generation - in a real implementation you'd use a proper YAML library
    return `# Project Context Analysis
overview:
  languages: [${compressed.overview.languages.map(l => `"${l}"`).join(', ')}]
  mainLanguage: "${compressed.overview.mainLanguage || ''}"
  framework: "${compressed.overview.framework || ''}"
  totalFiles: ${compressed.overview.totalFiles}
  totalComponents: ${compressed.overview.totalComponents}
  complexity: "${this.getComplexityLevel(compressed.overview.complexity || 0)}"

keyInsights:
${compressed.template.keyInsights.map(insight => `  - "${insight}"`).join('\n')}

patterns:
${compressed.patterns.slice(0, 5).map(pattern => `  - name: "${pattern.name}"
    type: "${pattern.type}"
    confidence: ${pattern.confidence || 0.7}`).join('\n')}
`;
  }

  // Helper methods for component analysis

  private findIntegrations(component: any, context: ProjectContext): string[] {
    const integrations = [];
    
    // Find components that this component depends on
    if (component.dependencies) {
      for (const dep of component.dependencies) {
        const depComponent = context.components.find(c => c.name === dep);
        if (depComponent) {
          integrations.push(depComponent.name);
        }
      }
    }

    // Find components that depend on this component
    for (const other of context.components) {
      if (other.dependencies?.includes(component.name)) {
        integrations.push(other.name);
      }
    }

    return [...new Set(integrations)]; // Remove duplicates
  }

  private determineLifecycle(component: any): string {
    const name = component.name.toLowerCase();
    
    if (name.includes('init') || name.includes('setup') || name.includes('bootstrap')) {
      return 'initialization';
    }
    if (name.includes('cleanup') || name.includes('destroy') || name.includes('teardown')) {
      return 'cleanup';
    }
    if (component.type === 'service') {
      return 'persistent';
    }
    if (component.type === 'react-component') {
      return 'mount-unmount';
    }
    
    return 'standard';
  }

  private analyzeIOFlow(component: any, context: ProjectContext): string {
    const name = component.name.toLowerCase();
    
    if (name.includes('input') || name.includes('form')) {
      return 'user-input → validation → processing';
    }
    if (name.includes('api') || name.includes('controller')) {
      return 'request → processing → response';
    }
    if (name.includes('service')) {
      return 'input → business-logic → output';
    }
    if (name.includes('repository') || name.includes('dao')) {
      return 'query → database → result';
    }
    
    return 'input → processing → output';
  }

  private extractFeatures(component: any): string[] {
    const features = [];
    const name = component.name.toLowerCase();
    
    if (name.includes('auth')) features.push('authentication');
    if (name.includes('valid')) features.push('validation');
    if (name.includes('cache')) features.push('caching');
    if (name.includes('log')) features.push('logging');
    if (name.includes('test')) features.push('testing');
    if (name.includes('config')) features.push('configuration');
    if (name.includes('middleware')) features.push('middleware');
    if (name.includes('util') || name.includes('helper')) features.push('utility');
    
    return features.length > 0 ? features : ['core-functionality'];
  }

  private classifyComponentPattern(component: any): string {
    if (component.type === 'service') return 'Service';
    if (component.type === 'react-component') return 'UI Component';
    if (component.name.toLowerCase().includes('controller')) return 'Controller';
    if (component.name.toLowerCase().includes('repository')) return 'Repository';
    if (component.name.toLowerCase().includes('model')) return 'Model';
    if (component.name.toLowerCase().includes('middleware')) return 'Middleware';
    if (component.name.toLowerCase().includes('util')) return 'Utility';
    
    return component.type || 'Component';
  }

  private inferComponentPurpose(component: any): string {
    const name = component.name.toLowerCase();
    
    if (name.includes('user')) return 'User management and operations';
    if (name.includes('auth')) return 'Authentication and authorization';
    if (name.includes('api')) return 'API endpoint handling';
    if (name.includes('data') || name.includes('model')) return 'Data modeling and persistence';
    if (name.includes('service')) return 'Business logic processing';
    if (name.includes('util') || name.includes('helper')) return 'Utility and helper functions';
    if (name.includes('config')) return 'Configuration management';
    if (name.includes('test')) return 'Testing and validation';
    
    return `${component.type} functionality`;
  }

  private determineCapabilities(component: any): string[] {
    const capabilities = [];
    const name = component.name.toLowerCase();
    
    if (component.methods && component.methods.length > 0) {
      capabilities.push(`${component.methods.length} methods`);
    }
    if (name.includes('crud') || (name.includes('create') && name.includes('read'))) {
      capabilities.push('CRUD operations');
    }
    if (name.includes('async') || component.async) {
      capabilities.push('asynchronous processing');
    }
    if (component.dependencies && component.dependencies.length > 3) {
      capabilities.push('complex integrations');
    }
    
    return capabilities.length > 0 ? capabilities : ['basic operations'];
  }

  private identifyAPIFlows(context: ProjectContext) {
    const flows = [];
    
    if (context.apiContracts.endpoints.length > 0) {
      flows.push({
        name: 'API Request Processing',
        description: 'Standard API request/response flow',
        steps: [
          { step: 'Receive HTTP request', component: 'API Gateway' },
          { step: 'Route to controller', component: 'Router' },
          { step: 'Process business logic', component: 'Service' },
          { step: 'Return response', component: 'Controller' }
        ],
        language: context.mainLanguage
      });
    }
    
    return flows;
  }

  private identifyUIFlows(context: ProjectContext) {
    const flows = [];
    
    const uiComponents = context.components.filter(c => c.type === 'react-component');
    if (uiComponents.length > 0) {
      flows.push({
        name: 'User Interface Interaction',
        description: 'User interaction with UI components',
        steps: [
          { step: 'User interaction', component: 'UI Component' },
          { step: 'State update', component: 'State Manager' },
          { step: 'Re-render', component: 'UI Component' },
          { step: 'Display result', component: 'View' }
        ],
        language: context.mainLanguage
      });
    }
    
    return flows;
  }

  private identifyDataProcessingFlows(context: ProjectContext) {
    const flows = [];
    
    const dataComponents = context.components.filter(c => 
      c.name.toLowerCase().includes('process') ||
      c.name.toLowerCase().includes('transform') ||
      c.name.toLowerCase().includes('pipeline')
    );
    
    if (dataComponents.length > 0) {
      flows.push({
        name: 'Data Processing Pipeline',
        description: 'Data transformation and processing flow',
        steps: [
          { step: 'Input data validation', component: 'Validator' },
          { step: 'Data transformation', component: 'Processor' },
          { step: 'Business logic application', component: 'Service' },
          { step: 'Output generation', component: 'Generator' }
        ],
        language: context.mainLanguage
      });
    }
    
    return flows;
  }

  private getComplexityLevel(complexity: number): string {
    if (complexity < 50) return 'Low';
    if (complexity < 150) return 'Medium';
    if (complexity < 300) return 'High';
    return 'Very High';
  }
}
