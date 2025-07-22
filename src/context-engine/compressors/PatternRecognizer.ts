import { ProjectContext, Pattern, FileStructure, Component } from '../types.js';

export class PatternRecognizer {
  async recognize(projectPath: string, fileStructure: FileStructure, components: Component[], languages: string[]): Promise<{
    architecturalPatterns: Pattern[];
    designPatterns: Pattern[];
    antiPatterns: Pattern[];
  }> {
    const architecturalPatterns = await this.recognizeArchitecturalPatterns(fileStructure, components, languages);
    const designPatterns = await this.recognizeDesignPatterns(components, languages);
    const antiPatterns = await this.recognizeAntiPatterns(components, languages);

    return {
      architecturalPatterns,
      designPatterns,
      antiPatterns
    };
  }

  private async recognizeArchitecturalPatterns(fileStructure: FileStructure, components: Component[], languages: string[]): Promise<Pattern[]> {
    const patterns: Pattern[] = [];

    // MVC Pattern Detection
    if (this.detectMVC(fileStructure, components)) {
      patterns.push({
        name: 'Model-View-Controller (MVC)',
        type: 'architectural',
        instances: [
          {
            location: 'Project structure',
            confidence: 0.8,
            metadata: { description: 'MVC pattern detected based on directory structure and component types' }
          }
        ],
        confidence: 0.8
      });
    }

    // Microservices Pattern Detection
    if (this.detectMicroservices(fileStructure, components)) {
      patterns.push({
        name: 'Microservices Architecture',
        type: 'architectural',
        instances: [
          {
            location: 'Service modules',
            confidence: 0.7,
            metadata: { description: 'Multiple service components suggest microservices architecture' }
          }
        ],
        confidence: 0.7
      });
    }

    // Layered Architecture Detection
    if (this.detectLayeredArchitecture(fileStructure)) {
      patterns.push({
        name: 'Layered Architecture',
        type: 'architectural',
        instances: [
          {
            location: 'Directory structure',
            confidence: 0.75,
            metadata: { description: 'Layered architecture detected from directory organization' }
          }
        ],
        confidence: 0.75
      });
    }

    // Component-Based Architecture (React, Vue, etc.)
    if (this.detectComponentBasedArchitecture(components, languages)) {
      patterns.push({
        name: 'Component-Based Architecture',
        type: 'architectural',
        instances: [
          {
            location: 'UI Components',
            confidence: 0.9,
            metadata: { description: 'Component-based UI framework detected' }
          }
        ],
        confidence: 0.9
      });
    }

    return patterns;
  }

  private async recognizeDesignPatterns(components: Component[], languages: string[]): Promise<Pattern[]> {
    const patterns: Pattern[] = [];

    // Singleton Pattern
    const singletons = this.detectSingleton(components);
    if (singletons.length > 0) {
      patterns.push({
        name: 'Singleton Pattern',
        type: 'design',
        instances: singletons.map(comp => ({
          location: comp.path,
          confidence: 0.7,
          metadata: { component: comp.name }
        })),
        confidence: 0.7
      });
    }

    // Factory Pattern
    const factories = this.detectFactory(components);
    if (factories.length > 0) {
      patterns.push({
        name: 'Factory Pattern',
        type: 'design',
        instances: factories.map(comp => ({
          location: comp.path,
          confidence: 0.6,
          metadata: { component: comp.name }
        })),
        confidence: 0.6
      });
    }

    // Observer Pattern
    const observers = this.detectObserver(components);
    if (observers.length > 0) {
      patterns.push({
        name: 'Observer Pattern',
        type: 'design',
        instances: observers.map(comp => ({
          location: comp.path,
          confidence: 0.65,
          metadata: { component: comp.name }
        })),
        confidence: 0.65
      });
    }

    // Repository Pattern
    const repositories = this.detectRepository(components);
    if (repositories.length > 0) {
      patterns.push({
        name: 'Repository Pattern',
        type: 'design',
        instances: repositories.map(comp => ({
          location: comp.path,
          confidence: 0.8,
          metadata: { component: comp.name }
        })),
        confidence: 0.8
      });
    }

    return patterns;
  }

  private async recognizeAntiPatterns(components: Component[], languages: string[]): Promise<Pattern[]> {
    const patterns: Pattern[] = [];

    // God Object / God Class
    const godObjects = this.detectGodObject(components);
    if (godObjects.length > 0) {
      patterns.push({
        name: 'God Object',
        type: 'antipattern',
        instances: godObjects.map(comp => ({
          location: comp.path,
          confidence: 0.8,
          metadata: { 
            component: comp.name,
            reason: 'Component has too many responsibilities',
            methodCount: comp.methods?.length || 0
          }
        })),
        confidence: 0.8
      });
    }

    // Spaghetti Code
    const spaghettiComponents = this.detectSpaghettiCode(components);
    if (spaghettiComponents.length > 0) {
      patterns.push({
        name: 'Spaghetti Code',
        type: 'antipattern',
        instances: spaghettiComponents.map(comp => ({
          location: comp.path,
          confidence: 0.7,
          metadata: { 
            component: comp.name,
            reason: 'Complex interdependencies detected'
          }
        })),
        confidence: 0.7
      });
    }

    return patterns;
  }

  // Architectural Pattern Detection Methods

  private detectMVC(fileStructure: FileStructure, components: Component[]): boolean {
    const hasModels = components.some(c => 
      c.name.toLowerCase().includes('model') || 
      c.type === 'class' && c.path.includes('/models/')
    );
    
    const hasViews = components.some(c => 
      c.name.toLowerCase().includes('view') || 
      c.type === 'react-component' ||
      c.path.includes('/views/') ||
      c.path.includes('/components/')
    );
    
    const hasControllers = components.some(c => 
      c.name.toLowerCase().includes('controller') ||
      c.path.includes('/controllers/')
    );

    return hasModels && hasViews && hasControllers;
  }

  private detectMicroservices(fileStructure: FileStructure, components: Component[]): boolean {
    const serviceComponents = components.filter(c => 
      c.type === 'service' || 
      c.name.toLowerCase().includes('service')
    );
    
    return serviceComponents.length >= 3; // Multiple services suggest microservices
  }

  private detectLayeredArchitecture(fileStructure: FileStructure): boolean {
    const layerIndicators = [
      'controller', 'service', 'repository', 'model', 'entity',
      'presentation', 'business', 'data', 'infrastructure'
    ];
    
    return this.hasDirectoryStructure(fileStructure, layerIndicators, 2);
  }

  private detectComponentBasedArchitecture(components: Component[], languages: string[]): boolean {
    const uiComponents = components.filter(c => 
      c.type === 'react-component' ||
      (languages.includes('React') || languages.includes('Vue') || languages.includes('Angular'))
    );
    
    return uiComponents.length >= 3;
  }

  // Design Pattern Detection Methods

  private detectSingleton(components: Component[]): Component[] {
    return components.filter(comp => {
      const name = comp.name.toLowerCase();
      return name.includes('singleton') || 
             name.includes('instance') ||
             (comp.type === 'class' && name.includes('manager'));
    });
  }

  private detectFactory(components: Component[]): Component[] {
    return components.filter(comp => {
      const name = comp.name.toLowerCase();
      return name.includes('factory') || 
             name.includes('builder') ||
             name.includes('creator');
    });
  }

  private detectObserver(components: Component[]): Component[] {
    return components.filter(comp => {
      const name = comp.name.toLowerCase();
      return name.includes('observer') || 
             name.includes('listener') ||
             name.includes('subscriber') ||
             name.includes('event');
    });
  }

  private detectRepository(components: Component[]): Component[] {
    return components.filter(comp => {
      const name = comp.name.toLowerCase();
      const path = comp.path.toLowerCase();
      return name.includes('repository') || 
             name.includes('dao') ||
             path.includes('/repositories/') ||
             path.includes('/data/');
    });
  }

  // Anti-Pattern Detection Methods

  private detectGodObject(components: Component[]): Component[] {
    return components.filter(comp => {
      // Heuristic: too many methods or dependencies
      const methodCount = comp.methods?.length || 0;
      const depCount = comp.dependencies?.length || 0;
      
      return methodCount > 20 || depCount > 10;
    });
  }

  private detectSpaghettiCode(components: Component[]): Component[] {
    // Detect components with complex interdependencies
    const dependencyMap = new Map<string, string[]>();
    
    for (const comp of components) {
      if (comp.dependencies) {
        dependencyMap.set(comp.name, comp.dependencies);
      }
    }

    return components.filter(comp => {
      const deps = dependencyMap.get(comp.name) || [];
      // Check for circular dependencies or too many connections
      return deps.length > 8 || this.hasCircularDependency(comp.name, dependencyMap);
    });
  }

  // Helper Methods

  private hasDirectoryStructure(structure: FileStructure, indicators: string[], minMatches: number): boolean {
    const foundIndicators = new Set<string>();
    
    const searchStructure = (node: FileStructure) => {
      if (node.type === 'directory') {
        const dirName = node.name.toLowerCase();
        for (const indicator of indicators) {
          if (dirName.includes(indicator)) {
            foundIndicators.add(indicator);
          }
        }
      }
      
      if (node.children) {
        for (const child of node.children) {
          searchStructure(child);
        }
      }
    };
    
    searchStructure(structure);
    return foundIndicators.size >= minMatches;
  }

  private hasCircularDependency(startNode: string, dependencyMap: Map<string, string[]>, visited = new Set<string>(), path = new Set<string>()): boolean {
    if (path.has(startNode)) {
      return true; // Circular dependency found
    }
    
    if (visited.has(startNode)) {
      return false;
    }
    
    visited.add(startNode);
    path.add(startNode);
    
    const dependencies = dependencyMap.get(startNode) || [];
    
    for (const dep of dependencies) {
      if (this.hasCircularDependency(dep, dependencyMap, visited, path)) {
        return true;
      }
    }
    
    path.delete(startNode);
    return false;
  }
}
