import { ProjectContext, DependencyGraph, CompressorOptions } from '../types.js';

export class DependencyGraphCompressor {
  async compress(context: ProjectContext, options?: CompressorOptions): Promise<DependencyGraph> {
    const nodes = await this.extractNodes(context, options);
    const edges = await this.extractEdges(context, nodes, options);

    return {
      nodes,
      edges
    };
  }

  private async extractNodes(context: ProjectContext, options?: CompressorOptions) {
    const nodes = [];
    const maxNodes = options?.maxEntities || 100;

    // Extract nodes from dependencies
    const processedDeps = new Set<string>();
    
    for (const dep of context.dependencies.slice(0, maxNodes)) {
      if (!processedDeps.has(dep.name)) {
        const nodeType: 'external' | 'internal' | 'system' = dep.type === 'external' ? 'external' : 'internal';
        const language = this.inferLanguageFromDependency(dep.name);
        
        const node: any = {
          id: dep.name,
          label: dep.name,
          type: nodeType
        };

        if (language) {
          node.language = language;
        }

        nodes.push(node);
        processedDeps.add(dep.name);
      }
    }

    // Extract nodes from components
    for (const component of context.components.slice(0, maxNodes - nodes.length)) {
      if (!processedDeps.has(component.name)) {
        const node: any = {
          id: component.name,
          label: component.name,
          type: 'internal' as const,
          metadata: {
            type: component.type,
            path: component.path
          }
        };

        if (component.language) {
          node.language = component.language;
        }

        nodes.push(node);
        processedDeps.add(component.name);
      }
    }

    return nodes.slice(0, maxNodes);
  }

  private async extractEdges(context: ProjectContext, nodes: any[], options?: CompressorOptions) {
    const edges = [];
    const nodeIds = new Set(nodes.map(n => n.id));

    // Extract edges from component dependencies
    for (const component of context.components) {
      if (nodeIds.has(component.name)) {
        // Add edges for component imports
        if (component.imports) {
          for (const importName of component.imports) {
            if (nodeIds.has(importName)) {
              edges.push({
                from: component.name,
                to: importName,
                type: 'import' as const,
                weight: 1
              });
            }
          }
        }

        // Add edges for component dependencies
        if (component.dependencies) {
          for (const depName of component.dependencies) {
            if (nodeIds.has(depName)) {
              edges.push({
                from: component.name,
                to: depName,
                type: 'use' as const,
                weight: 1
              });
            }
          }
        }
      }
    }

    // Extract edges from project dependencies
    for (const dep of context.dependencies) {
      if (nodeIds.has(dep.name)) {
        // Look for components that might use this dependency
        for (const component of context.components) {
          if (nodeIds.has(component.name) && this.componentUsesDependency(component, dep)) {
            edges.push({
              from: component.name,
              to: dep.name,
              type: 'require' as const,
              weight: this.calculateDependencyWeight(dep)
            });
          }
        }
      }
    }

    // Add data flow edges
    for (const connection of context.dataFlow.connections) {
      if (nodeIds.has(connection.from) && nodeIds.has(connection.to)) {
        const edgeType: 'import' | 'use' | 'require' | 'call' | 'inject' | 'inherit' = 
          connection.type === 'data' ? 'use' : 'call';
        
        edges.push({
          from: connection.from,
          to: connection.to,
          type: edgeType,
          weight: 1
        });
      }
    }

    return edges;
  }

  private inferLanguageFromDependency(depName: string): string | undefined {
    // Common dependency patterns to infer language
    const languagePatterns = {
      // JavaScript/TypeScript
      'react': 'JavaScript',
      'vue': 'JavaScript', 
      'express': 'JavaScript',
      'axios': 'JavaScript',
      'lodash': 'JavaScript',
      '@types/': 'TypeScript',
      
      // Python
      'django': 'Python',
      'flask': 'Python',
      'numpy': 'Python',
      'pandas': 'Python',
      'requests': 'Python',
      
      // Java
      'spring': 'Java',
      'junit': 'Java',
      'jackson': 'Java',
      
      // .NET
      'Microsoft.': 'C#',
      'Newtonsoft.': 'C#',
      
      // Rust
      'serde': 'Rust',
      'tokio': 'Rust',
      'clap': 'Rust',
      
      // Go
      'github.com/': 'Go',
      'golang.org/': 'Go'
    };

    for (const [pattern, language] of Object.entries(languagePatterns)) {
      if (depName.includes(pattern)) {
        return language;
      }
    }

    return undefined;
  }

  private componentUsesDependency(component: any, dependency: any): boolean {
    // Simple heuristic: if component has imports/dependencies that match
    if (component.imports?.includes(dependency.name)) return true;
    if (component.dependencies?.includes(dependency.name)) return true;
    
    // Check if component path suggests usage
    const componentLang = component.language?.toLowerCase();
    const depName = dependency.name.toLowerCase();
    
    // Language-specific patterns
    if (componentLang === 'javascript' || componentLang === 'typescript') {
      return ['react', 'vue', 'express', 'axios', 'lodash'].some(lib => depName.includes(lib));
    }
    
    if (componentLang === 'python') {
      return ['django', 'flask', 'requests', 'numpy'].some(lib => depName.includes(lib));
    }
    
    return false;
  }

  private calculateDependencyWeight(dependency: any): number {
    // Production dependencies are more important
    if (dependency.type === 'production') return 1.0;
    if (dependency.type === 'development') return 0.5;
    if (dependency.type === 'external') return 0.8;
    return 0.3;
  }
}
