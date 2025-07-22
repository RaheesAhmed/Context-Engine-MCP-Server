import { BusinessLogic, Component } from '../types.js';
import { readFile } from 'fs/promises';

export class BusinessLogicAnalyzer {
  async analyze(projectPath: string, components: Component[], languages: string[]): Promise<BusinessLogic> {
    const domain = await this.extractDomain(projectPath, components);
    const entities = await this.extractEntities(components, languages);
    const services = await this.extractServices(components, languages);
    const rules = await this.extractBusinessRules(components, languages);

    return {
      domain,
      entities,
      services,
      rules
    };
  }

  private async extractDomain(projectPath: string, components: Component[]): Promise<string> {
    // Analyze actual code to determine domain
    const domainTerms = new Map<string, number>();
    
    for (const component of components) {
      try {
        const content = await readFile(component.path, 'utf-8');
        const terms = this.extractDomainTerms(content, component.language || 'unknown');
        
        for (const term of terms) {
          domainTerms.set(term, (domainTerms.get(term) || 0) + 1);
        }
      } catch (error) {
        // Continue if file can't be read
      }
    }
    
    // Find most common domain term
    let dominantDomain = 'unknown';
    let maxCount = 0;
    
    for (const [term, count] of domainTerms.entries()) {
      if (count > maxCount) {
        maxCount = count;
        dominantDomain = term;
      }
    }

    return dominantDomain;
  }

  private extractDomainTerms(content: string, language: string): string[] {
    const terms = new Set<string>();
    
    // Extract business domain terms from code
    const businessPatterns = [
      // E-commerce
      /\b(?:user|customer|order|payment|product|inventory|cart|checkout|shipping|billing)\b/gi,
      // Finance
      /\b(?:account|transaction|balance|credit|debit|loan|investment|portfolio|risk)\b/gi,
      // Healthcare
      /\b(?:patient|doctor|appointment|treatment|medication|diagnosis|prescription|medical)\b/gi,
      // Content Management
      /\b(?:article|post|comment|tag|category|author|content|publish|draft)\b/gi,
      // Education
      /\b(?:student|teacher|course|lesson|grade|assignment|exam|enrollment|curriculum)\b/gi,
      // HR/Employee Management
      /\b(?:employee|department|salary|payroll|attendance|performance|leave|hiring)\b/gi,
      // Real Estate
      /\b(?:property|listing|agent|buyer|seller|lease|rent|mortgage|appraisal)\b/gi,
      // Social Media
      /\b(?:feed|timeline|like|share|comment|follower|friend|message|notification)\b/gi
    ];
    
    for (const pattern of businessPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[0]) {
          terms.add(match[0].toLowerCase());
        }
      }
    }
    
    return Array.from(terms);
  }

  private async extractEntities(components: Component[], languages: string[]): Promise<string[]> {
    const entities = new Set<string>();

    for (const component of components) {
      if (this.isEntityComponent(component)) {
        try {
          const content = await readFile(component.path, 'utf-8');
          const fileEntities = await this.parseEntitiesFromContent(content, component.language || 'unknown');
          fileEntities.forEach(entity => entities.add(entity));
        } catch (error) {
          // Fallback to component name if file can't be read
          entities.add(component.name);
        }
      }
    }

    return Array.from(entities);
  }

  private async parseEntitiesFromContent(content: string, language: string): Promise<string[]> {
    const entities = new Set<string>();
    
    switch (language) {
      case 'TypeScript':
      case 'JavaScript':
        // Parse TypeScript/JavaScript entities
        const tsEntities = this.parseTypeScriptEntities(content);
        tsEntities.forEach(entity => entities.add(entity));
        break;
        
      case 'Python':
        const pyEntities = this.parsePythonEntities(content);
        pyEntities.forEach(entity => entities.add(entity));
        break;
        
      case 'Java':
        const javaEntities = this.parseJavaEntities(content);
        javaEntities.forEach(entity => entities.add(entity));
        break;
        
      case 'C#':
        const csEntities = this.parseCSharpEntities(content);
        csEntities.forEach(entity => entities.add(entity));
        break;
        
      case 'Go':
        const goEntities = this.parseGoEntities(content);
        goEntities.forEach(entity => entities.add(entity));
        break;
        
      case 'Rust':
        const rustEntities = this.parseRustEntities(content);
        rustEntities.forEach(entity => entities.add(entity));
        break;
    }
    
    return Array.from(entities);
  }

  private parseTypeScriptEntities(content: string): string[] {
    const entities = [];
    
    // Parse interfaces that look like domain entities
    const interfaceMatches = content.matchAll(/interface\s+(\w+)\s*\{[^}]*(?:id|name|email|date|status|type)[^}]*\}/gs);
    for (const match of interfaceMatches) {
      if (match[1]) entities.push(match[1]);
    }
    
    // Parse classes with entity-like properties
    const classMatches = content.matchAll(/class\s+(\w+)\s*\{[^}]*(?:id|name|email|createdAt|updatedAt)[^}]*\}/gs);
    for (const match of classMatches) {
      if (match[1]) entities.push(match[1]);
    }
    
    // Parse type definitions that might represent entities
    const typeMatches = content.matchAll(/type\s+(\w+)\s*=\s*\{[^}]*(?:id|name|email|status)[^}]*\}/gs);
    for (const match of typeMatches) {
      if (match[1]) entities.push(match[1]);
    }
    
    return entities;
  }

  private parsePythonEntities(content: string): string[] {
    const entities = [];
    
    // Parse Python classes that look like entities
    const classMatches = content.matchAll(/class\s+(\w+)(?:\([^)]*\))?:\s*(?:[^]*?(?:id|name|email|created_at|updated_at)[^]*?)?/gs);
    for (const match of classMatches) {
      if (match[1] && this.isEntityName(match[1])) {
        entities.push(match[1]);
      }
    }
    
    // Parse dataclasses
    const dataclassMatches = content.matchAll(/@dataclass\s*(?:\([^)]*\))?\s*class\s+(\w+)/g);
    for (const match of dataclassMatches) {
      if (match[1]) entities.push(match[1]);
    }
    
    // Parse Pydantic models
    const pydanticMatches = content.matchAll(/class\s+(\w+)\(BaseModel\):/g);
    for (const match of pydanticMatches) {
      if (match[1]) entities.push(match[1]);
    }
    
    return entities;
  }

  private parseJavaEntities(content: string): string[] {
    const entities = [];
    
    // Parse Java classes with entity annotations
    const entityMatches = content.matchAll(/@Entity\s*(?:\([^)]*\))?\s*(?:public\s+)?class\s+(\w+)/g);
    for (const match of entityMatches) {
      if (match[1]) entities.push(match[1]);
    }
    
    // Parse JPA entities
    const jpaMatches = content.matchAll(/@Table\s*(?:\([^)]*\))?\s*(?:public\s+)?class\s+(\w+)/g);
    for (const match of jpaMatches) {
      if (match[1]) entities.push(match[1]);
    }
    
    // Parse classes with entity-like structure
    const classMatches = content.matchAll(/(?:public\s+)?class\s+(\w+)\s*\{[^}]*@Id[^}]*\}/gs);
    for (const match of classMatches) {
      if (match[1]) entities.push(match[1]);
    }
    
    return entities;
  }

  private parseCSharpEntities(content: string): string[] {
    const entities = [];
    
    // Parse C# classes with entity attributes
    const entityMatches = content.matchAll(/\[Entity\]\s*(?:public\s+)?class\s+(\w+)/g);
    for (const match of entityMatches) {
      if (match[1]) entities.push(match[1]);
    }
    
    // Parse classes with Key attribute
    const keyMatches = content.matchAll(/(?:public\s+)?class\s+(\w+)\s*\{[^}]*\[Key\][^}]*\}/gs);
    for (const match of keyMatches) {
      if (match[1]) entities.push(match[1]);
    }
    
    // Parse DbContext entities
    const dbContextMatches = content.matchAll(/public\s+DbSet<(\w+)>/g);
    for (const match of dbContextMatches) {
      if (match[1]) entities.push(match[1]);
    }
    
    return entities;
  }

  private parseGoEntities(content: string): string[] {
    const entities = [];
    
    // Parse Go structs that look like entities
    const structMatches = content.matchAll(/type\s+(\w+)\s+struct\s*\{[^}]*(?:ID|Id|Name|Email|CreatedAt|UpdatedAt)[^}]*\}/gs);
    for (const match of structMatches) {
      if (match[1]) entities.push(match[1]);
    }
    
    return entities;
  }

  private parseRustEntities(content: string): string[] {
    const entities = [];
    
    // Parse Rust structs with serde annotations (often used for entities)
    const serdeMatches = content.matchAll(/#\[derive\([^)]*(?:Serialize|Deserialize)[^)]*\)\]\s*(?:pub\s+)?struct\s+(\w+)/g);
    for (const match of serdeMatches) {
      if (match[1]) entities.push(match[1]);
    }
    
    // Parse structs that look like entities
    const structMatches = content.matchAll(/(?:pub\s+)?struct\s+(\w+)\s*\{[^}]*(?:id|name|email|created_at|updated_at)[^}]*\}/gs);
    for (const match of structMatches) {
      if (match[1]) entities.push(match[1]);
    }
    
    return entities;
  }

  private async extractServices(components: Component[], languages: string[]): Promise<string[]> {
    const services = new Set<string>();

    for (const component of components) {
      if (this.isServiceComponent(component)) {
        try {
          const content = await readFile(component.path, 'utf-8');
          const serviceInfo = await this.parseServiceFromContent(content, component);
          if (serviceInfo) {
            services.add(serviceInfo);
          }
        } catch (error) {
          // Fallback to component name
          services.add(component.name);
        }
      }
    }

    return Array.from(services);
  }

  private async parseServiceFromContent(content: string, component: Component): Promise<string | null> {
    // Look for actual service patterns in code
    const servicePatterns = [
      /class\s+(\w*Service\w*)/g,
      /interface\s+(\w*Service\w*)/g,
      /function\s+(\w*Service\w*)/g,
      /@Service\s*(?:\([^)]*\))?\s*(?:export\s+)?(?:class|function)\s+(\w+)/g,
      /@Injectable\s*(?:\([^)]*\))?\s*(?:export\s+)?class\s+(\w+)/g
    ];
    
    for (const pattern of servicePatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          return match[1];
        }
      }
    }
    
    return component.name;
  }

  private async extractBusinessRules(components: Component[], languages: string[]): Promise<Array<{
    name: string;
    description: string;
    location: string;
    complexity?: number;
  }>> {
    const rules = [];

    for (const component of components) {
      if (this.hasBusinessLogic(component)) {
        try {
          const content = await readFile(component.path, 'utf-8');
          const componentRules = await this.extractRulesFromContent(content, component);
          rules.push(...componentRules);
        } catch (error) {
          // Fallback to heuristic rules
          const fallbackRules = this.extractRulesFromComponent(component);
          rules.push(...fallbackRules);
        }
      }
    }

    return rules;
  }

  private async extractRulesFromContent(content: string, component: Component) {
    const rules = [];
    
    // Extract validation rules
    const validationRules = this.extractValidationRules(content, component);
    rules.push(...validationRules);
    
    // Extract business logic patterns
    const businessPatterns = this.extractBusinessPatterns(content, component);
    rules.push(...businessPatterns);
    
    // Extract workflow rules
    const workflowRules = this.extractWorkflowRules(content, component);
    rules.push(...workflowRules);
    
    // Extract authorization rules
    const authRules = this.extractAuthorizationRules(content, component);
    rules.push(...authRules);
    
    return rules;
  }

  private extractValidationRules(content: string, component: Component) {
    const rules = [];
    
    // Common validation patterns
    const validationPatterns = [
      { pattern: /if\s*\([^)]*\.length\s*[<>]=?\s*\d+[^)]*\)/g, type: 'length_validation' },
      { pattern: /if\s*\([^)]*email[^)]*@[^)]*\)/g, type: 'email_validation' },
      { pattern: /if\s*\([^)]*password[^)]*length[^)]*\)/g, type: 'password_validation' },
      { pattern: /if\s*\([^)]*age[^)]*[<>]=?\s*\d+[^)]*\)/g, type: 'age_validation' },
      { pattern: /if\s*\([^)]*price[^)]*[<>]=?\s*\d+[^)]*\)/g, type: 'price_validation' },
      { pattern: /throw\s+new\s+\w*ValidationError/g, type: 'validation_error' },
      { pattern: /validate\w*\s*\(/g, type: 'validation_function' }
    ];
    
    for (const { pattern, type } of validationPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        rules.push({
          name: `${component.name}_${type}`,
          description: `${type.replace('_', ' ')} rule in ${component.name}`,
          location: component.path,
          complexity: this.calculateRuleComplexity(match[0])
        });
      }
    }
    
    return rules;
  }

  private extractBusinessPatterns(content: string, component: Component) {
    const rules = [];
    
    // Business logic patterns
    const businessPatterns = [
      { pattern: /calculate\w*\s*\(/g, type: 'calculation' },
      { pattern: /process\w*\s*\(/g, type: 'processing' },
      { pattern: /if\s*\([^)]*status\s*[=!]=\s*['"`]\w+['"`][^)]*\)/g, type: 'status_check' },
      { pattern: /if\s*\([^)]*role\s*[=!]=\s*['"`]\w+['"`][^)]*\)/g, type: 'role_check' },
      { pattern: /if\s*\([^)]*permission[^)]*\)/g, type: 'permission_check' },
      { pattern: /switch\s*\([^)]*type[^)]*\)/g, type: 'type_switch' },
      { pattern: /discount\s*[=+\-*/]/g, type: 'discount_calculation' },
      { pattern: /tax\s*[=+\-*/]/g, type: 'tax_calculation' }
    ];
    
    for (const { pattern, type } of businessPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        rules.push({
          name: `${component.name}_${type}`,
          description: `${type.replace('_', ' ')} logic in ${component.name}`,
          location: component.path,
          complexity: this.calculateRuleComplexity(match[0])
        });
      }
    }
    
    return rules;
  }

  private extractWorkflowRules(content: string, component: Component) {
    const rules = [];
    
    // Workflow patterns
    const workflowPatterns = [
      { pattern: /state\s*[=!]=\s*['"`]\w+['"`]/g, type: 'state_transition' },
      { pattern: /status\s*=\s*['"`]\w+['"`]/g, type: 'status_update' },
      { pattern: /approve\w*\s*\(/g, type: 'approval_workflow' },
      { pattern: /reject\w*\s*\(/g, type: 'rejection_workflow' },
      { pattern: /submit\w*\s*\(/g, type: 'submission_workflow' },
      { pattern: /complete\w*\s*\(/g, type: 'completion_workflow' }
    ];
    
    for (const { pattern, type } of workflowPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        rules.push({
          name: `${component.name}_${type}`,
          description: `${type.replace('_', ' ')} rule in ${component.name}`,
          location: component.path,
          complexity: this.calculateRuleComplexity(match[0])
        });
      }
    }
    
    return rules;
  }

  private extractAuthorizationRules(content: string, component: Component) {
    const rules = [];
    
    // Authorization patterns
    const authPatterns = [
      { pattern: /@authorize\w*\s*\(/gi, type: 'authorization_decorator' },
      { pattern: /checkPermission\w*\s*\(/g, type: 'permission_check' },
      { pattern: /hasRole\w*\s*\(/g, type: 'role_check' },
      { pattern: /isOwner\w*\s*\(/g, type: 'ownership_check' },
      { pattern: /canAccess\w*\s*\(/g, type: 'access_check' }
    ];
    
    for (const { pattern, type } of authPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        rules.push({
          name: `${component.name}_${type}`,
          description: `${type.replace('_', ' ')} rule in ${component.name}`,
          location: component.path,
          complexity: this.calculateRuleComplexity(match[0])
        });
      }
    }
    
    return rules;
  }

  private calculateRuleComplexity(ruleContent: string): number {
    let complexity = 1;
    
    // Count conditions
    const conditions = (ruleContent.match(/&&|\|\|/g) || []).length;
    complexity += conditions;
    
    // Count nested structures
    const nesting = (ruleContent.match(/\{|\(/g) || []).length;
    complexity += nesting * 0.5;
    
    // Count operators
    const operators = (ruleContent.match(/[+\-*/=<>!]/g) || []).length;
    complexity += operators * 0.2;
    
    return Math.min(Math.ceil(complexity), 10);
  }

  private isEntityComponent(component: Component): boolean {
    const name = component.name.toLowerCase();
    const path = component.path.toLowerCase();
    
    return (
      component.type === 'class' ||
      component.type === 'interface' ||
      component.type === 'struct' ||
      name.includes('entity') ||
      name.includes('model') ||
      name.includes('dto') ||
      path.includes('/models/') ||
      path.includes('/entities/') ||
      path.includes('/domain/')
    );
  }

  private isServiceComponent(component: Component): boolean {
    const name = component.name.toLowerCase();
    const path = component.path.toLowerCase();
    
    return (
      component.type === 'service' ||
      name.includes('service') ||
      name.includes('manager') ||
      name.includes('handler') ||
      name.includes('processor') ||
      name.includes('controller') ||
      path.includes('/services/') ||
      path.includes('/business/') ||
      path.includes('/logic/')
    );
  }

  private hasBusinessLogic(component: Component): boolean {
    const name = component.name.toLowerCase();
    const path = component.path.toLowerCase();
    
    return (
      this.isServiceComponent(component) ||
      name.includes('validator') ||
      name.includes('calculator') ||
      name.includes('processor') ||
      name.includes('engine') ||
      name.includes('workflow') ||
      name.includes('rule') ||
      path.includes('/business/') ||
      path.includes('/logic/') ||
      path.includes('/rules/')
    );
  }

  private extractRulesFromComponent(component: Component) {
    const rules = [];
    
    // Fallback heuristic rules when file content can't be analyzed
    const ruleTypes = ['validation', 'calculation', 'workflow', 'authorization'];
    
    for (const ruleType of ruleTypes) {
      if (component.name.toLowerCase().includes(ruleType)) {
        rules.push({
          name: `${component.name}_${ruleType}_rule`,
          description: `${ruleType} rule in ${component.name}`,
          location: component.path,
          complexity: this.calculateComplexity(component)
        });
      }
    }

    // If no specific rules found, create a generic one for service components
    if (rules.length === 0 && this.isServiceComponent(component)) {
      rules.push({
        name: `${component.name}_business_rule`,
        description: `Business logic in ${component.name}`,
        location: component.path,
        complexity: this.calculateComplexity(component)
      });
    }

    return rules;
  }

  private calculateComplexity(component: Component): number {
    // Simple complexity calculation based on component characteristics
    let complexity = 1;
    
    if (component.methods && component.methods.length > 5) {
      complexity += 2;
    }
    
    if (component.dependencies && component.dependencies.length > 3) {
      complexity += 1;
    }
    
    if (component.name.toLowerCase().includes('manager') || 
        component.name.toLowerCase().includes('processor')) {
      complexity += 2;
    }

    return Math.min(complexity, 10); // Cap at 10
  }

  private isEntityName(name: string): boolean {
    // Check if the name looks like a domain entity
    const entityIndicators = [
      /user/i, /customer/i, /order/i, /product/i, /account/i,
      /payment/i, /invoice/i, /item/i, /category/i, /tag/i,
      /post/i, /article/i, /comment/i, /review/i, /rating/i,
      /employee/i, /department/i, /project/i, /task/i
    ];
    
    return entityIndicators.some(pattern => pattern.test(name));
  }
}
