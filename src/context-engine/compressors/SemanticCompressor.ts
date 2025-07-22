import { ProjectContext, SemanticNetwork, CompressorOptions } from '../types.js';

export class SemanticCompressor {
  async compress(context: ProjectContext, options?: CompressorOptions): Promise<SemanticNetwork> {
    const entities = await this.extractSemanticEntities(context, options);
    const relationships = await this.extractSemanticRelationships(context, entities, options);

    return {
      entities,
      relationships
    };
  }

  private async extractSemanticEntities(context: ProjectContext, options?: CompressorOptions) {
    const entities = [];
    const maxEntities = options?.maxEntities || 50;
    
    // Extract entities from components
    for (const component of context.components.slice(0, maxEntities)) {
      const entity = {
        name: component.name,
        type: component.type,
        purpose: this.inferPurpose(component),
        relationships: [],
        importance: this.calculateImportance(component, context)
      };

      // Only add language if it exists
      if (component.language) {
        (entity as any).language = component.language;
      }

      entities.push(entity);
    }

    // Extract entities from key files
    this.extractEntitiesFromFileStructure(context.fileStructure, entities, maxEntities - entities.length);

    // Sort by importance and limit
    return entities
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, maxEntities);
  }

  private async extractSemanticRelationships(context: ProjectContext, entities: any[], options?: CompressorOptions) {
    const relationships = [];

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];
        
        const relationshipType = this.determineRelationshipType(entity1, entity2, context);
        if (relationshipType) {
          const strength = this.calculateRelationshipStrength(entity1, entity2, context);
          
          relationships.push({
            from: entity1.name,
            to: entity2.name,
            type: relationshipType,
            strength
          });
        }
      }
    }

    return relationships.filter(r => r.strength > 0.3); // Only strong relationships
  }

  private extractEntitiesFromFileStructure(structure: any, entities: any[], maxCount: number) {
    if (entities.length >= maxCount) return;

    if (structure.type === 'file' && structure.configFile) {
      entities.push({
        name: structure.name,
        type: 'configuration',
        purpose: 'Configuration file',
        language: structure.language,
        relationships: [],
        importance: 3
      });
    }

    if (structure.children) {
      for (const child of structure.children) {
        this.extractEntitiesFromFileStructure(child, entities, maxCount);
        if (entities.length >= maxCount) break;
      }
    }
  }

  private inferPurpose(component: any): string {
    const name = component.name.toLowerCase();
    const type = component.type;

    if (type === 'service') return 'Business logic service';
    if (type === 'react-component') return 'UI component';
    if (name.includes('controller')) return 'API endpoint handler';
    if (name.includes('model') || name.includes('entity')) return 'Data model';
    if (name.includes('util') || name.includes('helper')) return 'Utility function';
    if (name.includes('middleware')) return 'Request middleware';
    if (name.includes('test') || name.includes('spec')) return 'Test file';
    
    return `${type} implementation`;
  }

  private calculateImportance(component: any, context: ProjectContext): number {
    let importance = 1;

    // Type-based importance
    if (component.type === 'service') importance += 3;
    if (component.type === 'react-component') importance += 2;
    if (component.type === 'class') importance += 2;

    // Name-based importance
    const name = component.name.toLowerCase();
    if (name.includes('main') || name.includes('index') || name.includes('app')) importance += 3;
    if (name.includes('controller') || name.includes('api')) importance += 2;
    if (name.includes('service') || name.includes('manager')) importance += 2;

    // Dependencies increase importance
    if (component.dependencies && component.dependencies.length > 3) importance += 1;
    if (component.methods && component.methods.length > 5) importance += 1;

    return importance;
  }

  private determineRelationshipType(entity1: any, entity2: any, context: ProjectContext): 'depends_on' | 'implements' | 'extends' | 'uses' | 'calls' | 'imports' | null {
    // Check for direct dependencies
    const comp1 = context.components.find(c => c.name === entity1.name);
    const comp2 = context.components.find(c => c.name === entity2.name);

    if (comp1?.dependencies?.includes(entity2.name)) return 'depends_on';
    if (comp2?.dependencies?.includes(entity1.name)) return 'depends_on';

    // Check for imports based on component imports/exports
    if (comp1?.imports?.includes(entity2.name) || comp2?.imports?.includes(entity1.name)) {
      return 'imports';
    }

    // Infer relationships from types and names
    if (entity1.type === 'service' && entity2.type === 'class') return 'uses';
    if (entity1.type === 'react-component' && entity2.type === 'service') return 'calls';
    if (entity1.type === 'controller' && entity2.type === 'service') return 'uses';
    if (entity1.type === 'class' && entity2.type === 'interface') return 'implements';
    if (entity1.type === 'class' && entity2.type === 'class') return 'extends';

    // Same directory suggests usage relationship
    if (comp1 && comp2) {
      const path1 = comp1.path.split('/').slice(0, -1).join('/');
      const path2 = comp2.path.split('/').slice(0, -1).join('/');
      
      if (path1 === path2) return 'uses';
    }

    return null;
  }

  private calculateRelationshipStrength(entity1: any, entity2: any, context: ProjectContext): number {
    let strength = 0.1;

    // Direct dependency = strong relationship
    const comp1 = context.components.find(c => c.name === entity1.name);
    const comp2 = context.components.find(c => c.name === entity2.name);

    if (comp1?.dependencies?.includes(entity2.name) || comp2?.dependencies?.includes(entity1.name)) {
      strength += 0.5;
    }

    // Same directory increases strength
    if (comp1 && comp2) {
      const path1Parts = comp1.path.split('/');
      const path2Parts = comp2.path.split('/');
      
      const commonPathDepth = this.calculateCommonPathDepth(path1Parts, path2Parts);
      strength += commonPathDepth * 0.1;
    }

    // Similar names increase strength
    const name1 = entity1.name.toLowerCase();
    const name2 = entity2.name.toLowerCase();
    
    if (name1.includes(name2) || name2.includes(name1)) {
      strength += 0.3;
    }

    // Type compatibility increases strength
    const typeCompatibility = this.calculateTypeCompatibility(entity1.type, entity2.type);
    strength += typeCompatibility;

    return Math.min(strength, 1.0);
  }

  private calculateCommonPathDepth(path1Parts: string[], path2Parts: string[]): number {
    let depth = 0;
    const maxDepth = Math.min(path1Parts.length, path2Parts.length) - 1; // Exclude filename
    
    for (let i = 0; i < maxDepth; i++) {
      if (path1Parts[i] === path2Parts[i]) {
        depth++;
      } else {
        break;
      }
    }
    
    return depth;
  }

  private calculateTypeCompatibility(type1: string, type2: string): number {
    const compatibilityMatrix: { [key: string]: { [key: string]: number } } = {
      'service': { 'class': 0.3, 'function': 0.2, 'interface': 0.4 },
      'class': { 'service': 0.3, 'interface': 0.5, 'enum': 0.2 },
      'react-component': { 'service': 0.4, 'function': 0.3 },
      'controller': { 'service': 0.5, 'class': 0.3 },
      'function': { 'class': 0.2, 'service': 0.2 }
    };

    return compatibilityMatrix[type1]?.[type2] || 0.1;
  }
}
