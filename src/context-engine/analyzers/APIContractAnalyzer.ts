import { APIContracts, Component } from '../types.js';

export class APIContractAnalyzer {
  async analyze(projectPath: string, components: Component[], languages: string[]): Promise<APIContracts> {
    const endpoints = await this.extractAPIEndpoints(components, languages);
    const schemas = await this.extractSchemas(components, languages);
    const middleware = await this.extractMiddleware(components, languages);

    return {
      endpoints,
      schemas,
      middleware
    };
  }

  private async extractAPIEndpoints(components: Component[], languages: string[]) {
    const endpoints = [];

    // Check ALL JavaScript/TypeScript/Python files for API endpoints
    for (const component of components) {
      if (component.language && ['JavaScript', 'TypeScript', 'Python'].includes(component.language)) {
        const componentEndpoints = await this.extractEndpointsFromComponent(component);
        endpoints.push(...componentEndpoints);
      }
    }

    return endpoints;
  }

  private async extractSchemas(components: Component[], languages: string[]) {
    const schemas = [];

    for (const component of components) {
      if (this.isSchemaComponent(component)) {
        schemas.push({
          name: component.name,
          path: component.path,
          language: component.language
        });
      }
    }

    return schemas;
  }

  private async extractMiddleware(components: Component[], languages: string[]) {
    const middleware = [];

    for (const component of components) {
      if (this.isMiddlewareComponent(component)) {
        middleware.push(component.name);
      }
    }

    return middleware;
  }

  private isAPIComponent(component: Component): boolean {
    const name = component.name.toLowerCase();
    const path = component.path.toLowerCase();
    
    return (
      name.includes('controller') ||
      name.includes('route') ||
      name.includes('handler') ||
      name.includes('endpoint') ||
      name.includes('api') ||
      path.includes('/api/') ||
      path.includes('/routes/') ||
      path.includes('/controllers/')
    );
  }

  private isSchemaComponent(component: Component): boolean {
    const name = component.name.toLowerCase();
    const path = component.path.toLowerCase();
    
    return (
      name.includes('schema') ||
      name.includes('model') ||
      name.includes('dto') ||
      name.includes('entity') ||
      path.includes('/models/') ||
      path.includes('/schemas/') ||
      path.includes('/dto/')
    );
  }

  private isMiddlewareComponent(component: Component): boolean {
    const name = component.name.toLowerCase();
    const path = component.path.toLowerCase();
    
    return (
      name.includes('middleware') ||
      name.includes('guard') ||
      name.includes('interceptor') ||
      name.includes('filter') ||
      path.includes('/middleware/') ||
      path.includes('/guards/')
    );
  }

  private async extractEndpointsFromComponent(component: Component) {
    const endpoints = [];
    
    try {
      // Read the actual file content to parse real API routes
      const fs = await import('fs/promises');
      const content = await fs.readFile(component.path, 'utf-8');
      
      // Parse Express.js routes
      const expressRoutes = this.parseExpressRoutes(content, component);
      endpoints.push(...expressRoutes);
      
      // Parse FastAPI routes
      const fastApiRoutes = this.parseFastAPIRoutes(content, component);
      endpoints.push(...fastApiRoutes);
      
      // Parse Spring Boot routes
      const springRoutes = this.parseSpringBootRoutes(content, component);
      endpoints.push(...springRoutes);
      
      // Parse ASP.NET routes
      const aspnetRoutes = this.parseAspNetRoutes(content, component);
      endpoints.push(...aspnetRoutes);
      
      // Parse Django routes
      const djangoRoutes = this.parseDjangoRoutes(content, component);
      endpoints.push(...djangoRoutes);
      
      // Parse Flask routes
      const flaskRoutes = this.parseFlaskRoutes(content, component);
      endpoints.push(...flaskRoutes);
      
    } catch (error) {
      // If file reading fails, return empty array
      console.warn(`Could not read file ${component.path}: ${error}`);
    }

    return endpoints;
  }

  private parseExpressRoutes(content: string, component: Component) {
    const endpoints = [];
    
    // Match Express router patterns: router.get('/path', handler)
    const expressPatterns = [
      /(?:router|app)\.(\w+)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /\s*(\w+)\s*:\s*['"`]([^'"`]+)['"`]/g // Route object patterns
    ];
    
    for (const pattern of expressPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const method = match[1];
        const path = match[2];
        
        if (method && path && ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'].includes(method.toUpperCase())) {
          endpoints.push({
            method: method.toUpperCase(),
            path,
            handler: component.name,
            file: component.path
          });
        }
      }
    }
    
    return endpoints;
  }
  
  private parseFastAPIRoutes(content: string, component: Component) {
    const endpoints = [];
    
    // Match FastAPI decorator patterns: @app.get("/path")
    const fastApiPattern = /@app\.(\w+)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    
    let match;
    while ((match = fastApiPattern.exec(content)) !== null) {
      const method = match[1];
      const path = match[2];
      
      if (method && path) {
        endpoints.push({
          method: method.toUpperCase(),
          path,
          handler: component.name,
          file: component.path
        });
      }
    }
    
    return endpoints;
  }
  
  private parseSpringBootRoutes(content: string, component: Component) {
    const endpoints = [];
    
    // Match Spring Boot annotations: @GetMapping("/path")
    const springPatterns = [
      /@(\w+)Mapping\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /@RequestMapping\s*\([^)]*value\s*=\s*['"`]([^'"`]+)['"`][^)]*method\s*=\s*RequestMethod\.(\w+)/g
    ];
    
    for (const pattern of springPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        let method, path;
        
        if (pattern === springPatterns[0]) {
          // @GetMapping, @PostMapping, etc.
          method = match[1]?.replace('Mapping', '').toUpperCase();
          path = match[2];
        } else {
          // @RequestMapping
          method = match[2]?.toUpperCase();
          path = match[1];
        }
        
        if (method && path) {
          endpoints.push({
            method,
            path,
            handler: component.name,
            file: component.path
          });
        }
      }
    }
    
    return endpoints;
  }
  
  private parseAspNetRoutes(content: string, component: Component) {
    const endpoints = [];
    
    // Match ASP.NET Core route attributes: [HttpGet("path")]
    const aspnetPattern = /\[Http(\w+)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    
    let match;
    while ((match = aspnetPattern.exec(content)) !== null) {
      const method = match[1];
      const path = match[2];
      
      if (method && path) {
        endpoints.push({
          method: method.toUpperCase(),
          path,
          handler: component.name,
          file: component.path
        });
      }
    }
    
    return endpoints;
  }
  
  private parseDjangoRoutes(content: string, component: Component) {
    const endpoints = [];
    
    // Match Django URL patterns: path('route/', view)
    const djangoPattern = /path\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+)/g;
    
    let match;
    while ((match = djangoPattern.exec(content)) !== null) {
      const path = match[1];
      const handler = match[2];
      
      if (path && handler) {
        endpoints.push({
          method: 'GET', // Django doesn't specify method in URL patterns
          path,
          handler,
          file: component.path
        });
      }
    }
    
    return endpoints;
  }
  
  private parseFlaskRoutes(content: string, component: Component) {
    const endpoints = [];
    
    // Match Flask route decorators: @app.route('/path', methods=['GET'])
    const flaskPattern = /@app\.route\s*\(\s*['"`]([^'"`]+)['"`](?:[^)]*methods\s*=\s*\[([^\]]+)\])?/g;
    
    let match;
    while ((match = flaskPattern.exec(content)) !== null) {
      const path = match[1];
      const methodsStr = match[2];
      
      if (path) {
        if (methodsStr) {
          // Parse methods array
          const methods = methodsStr.match(/['"`](\w+)['"`]/g);
          if (methods) {
            for (const method of methods) {
              const cleanMethod = method.replace(/['"`]/g, '');
              endpoints.push({
                method: cleanMethod.toUpperCase(),
                path,
                handler: component.name,
                file: component.path
              });
            }
          }
        } else {
          // Default to GET if no methods specified
          endpoints.push({
            method: 'GET',
            path,
            handler: component.name,
            file: component.path
          });
        }
      }
    }
    
    return endpoints;
  }
}
