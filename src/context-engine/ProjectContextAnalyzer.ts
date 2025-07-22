import * as fs from 'fs/promises';
import * as path from 'path';
import { FileStructureAnalyzer } from './analyzers/FileStructureAnalyzer.js';
import { CodeRelationAnalyzer } from './analyzers/CodeRelationAnalyzer.js';
import { DataFlowAnalyzer } from './analyzers/DataFlowAnalyzer.js';
import { APIContractAnalyzer } from './analyzers/APIContractAnalyzer.js';
import { BusinessLogicAnalyzer } from './analyzers/BusinessLogicAnalyzer.js';
import { SemanticCompressor } from './compressors/SemanticCompressor.js';
import { DependencyGraphCompressor } from './compressors/DependencyGraphCompressor.js';
import { PatternRecognizer } from './compressors/PatternRecognizer.js';
import { ContextTemplater } from './compressors/ContextTemplater.js';
import { 
  ProjectContext, 
  CompressedContext, 
  AnalyzerOptions, 
  CompressorOptions,
  TemplateOptions,
  Component,
  Dependency,
  Pattern,
  DataFlow,
  APIContracts,
  BusinessLogic,
  LanguageAnalysisResult
} from './types.js';

export class ProjectContextAnalyzer {
  private fileStructureAnalyzer: FileStructureAnalyzer;
  private codeRelationAnalyzer: CodeRelationAnalyzer;
  private dataFlowAnalyzer: DataFlowAnalyzer;
  private apiContractAnalyzer: APIContractAnalyzer;
  private businessLogicAnalyzer: BusinessLogicAnalyzer;
  private semanticCompressor: SemanticCompressor;
  private dependencyGraphCompressor: DependencyGraphCompressor;
  private patternRecognizer: PatternRecognizer;
  private contextTemplater: ContextTemplater;

  // Multi-language analyzers mapping
  private languageAnalyzers: Map<string, any> = new Map();

  constructor() {
    this.fileStructureAnalyzer = new FileStructureAnalyzer();
    this.codeRelationAnalyzer = new CodeRelationAnalyzer();
    this.dataFlowAnalyzer = new DataFlowAnalyzer();
    this.apiContractAnalyzer = new APIContractAnalyzer();
    this.businessLogicAnalyzer = new BusinessLogicAnalyzer();
    this.semanticCompressor = new SemanticCompressor();
    this.dependencyGraphCompressor = new DependencyGraphCompressor();
    this.patternRecognizer = new PatternRecognizer();
    this.contextTemplater = new ContextTemplater();
  }

  async analyze(projectPath: string, options?: AnalyzerOptions): Promise<ProjectContext> {
    try {
      // Analyze file structure (this is the foundation)
      const fileStructure = await this.fileStructureAnalyzer.analyze(projectPath, options);
      
      // Extract project languages
      const languages = this.fileStructureAnalyzer.getProjectLanguages(fileStructure);
      const mainLanguage = this.fileStructureAnalyzer.getMainLanguage(fileStructure);

      // Detect framework and build system
      const framework = await this.detectFramework(projectPath, languages);
      const buildSystem = await this.detectBuildSystem(projectPath);

      // Analyze dependencies (language-agnostic)
      const dependencies = await this.analyzeDependencies(projectPath, languages);

      // Analyze components (multi-language)
      const components = await this.analyzeComponents(projectPath, fileStructure, languages);

      // Analyze data flow
      const dataFlow = await this.analyzeDataFlow(projectPath, components, languages);

      // Analyze patterns (multi-language)
      const patterns = await this.analyzePatterns(projectPath, fileStructure, components, languages);

      // Analyze API contracts
      const apiContracts = await this.analyzeAPIContracts(projectPath, components, languages);

      // Analyze business logic (optional)
      const businessLogic = await this.analyzeBusinessLogic(projectPath, components, languages);

      const projectContext: any = {
        fileStructure,
        dependencies,
        components,
        dataFlow,
        patterns,
        apiContracts,
        languages,
        framework,
        buildSystem
      };

      if (mainLanguage) {
        projectContext.mainLanguage = mainLanguage;
      }

      if (businessLogic) {
        projectContext.businessLogic = businessLogic;
      }

      return projectContext as ProjectContext;
    } catch (error) {
      console.error('Error analyzing project:', error);
      throw error;
    }
  }

  async compress(context: ProjectContext, options?: CompressorOptions): Promise<CompressedContext> {
    try {
      // Create overview
      const overview: any = {
        languages: context.languages,
        totalFiles: this.countFiles(context.fileStructure),
        totalComponents: context.components.length,
        complexity: this.calculateComplexity(context)
      };

      if (context.mainLanguage) {
        overview.mainLanguage = context.mainLanguage;
      }

      if (context.framework) {
        overview.framework = context.framework;
      }

      // Compress semantic network
      const semanticNetwork = await this.semanticCompressor.compress(context, options);

      // Compress dependency graph
      const dependencyGraph = await this.dependencyGraphCompressor.compress(context, options);

      // Extract patterns
      const patterns = [
        ...context.patterns.architecturalPatterns,
        ...context.patterns.designPatterns,
        ...context.patterns.antiPatterns
      ];

      // Generate template
      const template = await this.contextTemplater.createTemplate(context, options);

      return {
        overview,
        semanticNetwork,
        dependencyGraph,
        patterns,
        template
      } as CompressedContext;
    } catch (error) {
      console.error('Error compressing context:', error);
      throw error;
    }
  }

  generateTemplate(compressed: CompressedContext, options?: TemplateOptions): string {
    return this.contextTemplater.generateTemplate(compressed, options);
  }

  private async detectFramework(projectPath: string, languages: string[]): Promise<string | undefined> {
    const frameworkIndicators = [
      // JavaScript/TypeScript frameworks
      { file: 'next.config.js', framework: 'Next.js' },
      { file: 'nuxt.config.js', framework: 'Nuxt.js' },
      { file: 'angular.json', framework: 'Angular' },
      { file: 'vue.config.js', framework: 'Vue.js' },
      { file: 'svelte.config.js', framework: 'Svelte' },
      { file: 'gatsby-config.js', framework: 'Gatsby' },
      
      // Python frameworks
      { file: 'manage.py', framework: 'Django' },
      { file: 'app.py', framework: 'Flask' },
      { file: 'main.py', framework: 'FastAPI' },
      { file: 'pyramid.ini', framework: 'Pyramid' },
      
      // Rust frameworks
      { file: 'Cargo.toml', framework: 'Rust' },
      
      // Go frameworks
      { file: 'go.mod', framework: 'Go' },
      
      // Java frameworks
      { file: 'pom.xml', framework: 'Maven/Spring' },
      { file: 'build.gradle', framework: 'Gradle/Spring' },
      
      // .NET frameworks
      { file: '*.csproj', framework: '.NET' },
      { file: '*.fsproj', framework: 'F#/.NET' },
      
      // Ruby frameworks
      { file: 'Gemfile', framework: 'Ruby/Rails' },
      
      // PHP frameworks
      { file: 'composer.json', framework: 'PHP' }
    ];

    for (const indicator of frameworkIndicators) {
      try {
        if (indicator.file.includes('*')) {
          // Pattern matching for files like *.csproj
          const pattern = indicator.file.replace('*', '');
          const files = await fs.readdir(projectPath);
          if (files.some(file => file.endsWith(pattern))) {
            return indicator.framework;
          }
        } else {
          await fs.access(path.join(projectPath, indicator.file));
          return indicator.framework;
        }
      } catch {
        // File doesn't exist, continue
      }
    }

    // Check package.json for framework dependencies
    if (languages.includes('JavaScript') || languages.includes('TypeScript')) {
      try {
        const packageJsonPath = path.join(projectPath, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (deps['next']) return 'Next.js';
        if (deps['nuxt']) return 'Nuxt.js';
        if (deps['@angular/core']) return 'Angular';
        if (deps['vue']) return 'Vue.js';
        if (deps['svelte']) return 'Svelte';
        if (deps['react']) return 'React';
        if (deps['express']) return 'Express.js';
        if (deps['fastify']) return 'Fastify';
      } catch {
        // No package.json or parsing error
      }
    }

    return undefined;
  }

  private async detectBuildSystem(projectPath: string): Promise<string | undefined> {
    const buildSystems = [
      { file: 'webpack.config.js', system: 'Webpack' },
      { file: 'vite.config.js', system: 'Vite' },
      { file: 'rollup.config.js', system: 'Rollup' },
      { file: 'gulpfile.js', system: 'Gulp' },
      { file: 'Gruntfile.js', system: 'Grunt' },
      { file: 'Makefile', system: 'Make' },
      { file: 'CMakeLists.txt', system: 'CMake' },
      { file: 'build.gradle', system: 'Gradle' },
      { file: 'pom.xml', system: 'Maven' },
      { file: 'build.sbt', system: 'SBT' },
      { file: 'Cargo.toml', system: 'Cargo' },
      { file: 'go.mod', system: 'Go Modules' },
      { file: 'setup.py', system: 'Python setuptools' },
      { file: 'pyproject.toml', system: 'Python Build' },
      { file: 'composer.json', system: 'Composer' }
    ];

    for (const buildSystem of buildSystems) {
      try {
        await fs.access(path.join(projectPath, buildSystem.file));
        return buildSystem.system;
      } catch {
        // File doesn't exist, continue
      }
    }

    return undefined;
  }

  private async analyzeDependencies(projectPath: string, languages: string[]): Promise<Dependency[]> {
    const dependencies: Dependency[] = [];

    for (const language of languages) {
      switch (language) {
        case 'JavaScript':
        case 'TypeScript':
        case 'React':
          dependencies.push(...await this.analyzeNodeDependencies(projectPath));
          break;
        case 'Python':
          dependencies.push(...await this.analyzePythonDependencies(projectPath));
          break;
        case 'Rust':
          dependencies.push(...await this.analyzeRustDependencies(projectPath));
          break;
        case 'Go':
          dependencies.push(...await this.analyzeGoDependencies(projectPath));
          break;
        case 'Java':
        case 'Kotlin':
        case 'Scala':
          dependencies.push(...await this.analyzeJavaDependencies(projectPath));
          break;
        case 'C#':
        case 'F#':
          dependencies.push(...await this.analyzeDotNetDependencies(projectPath));
          break;
        case 'Ruby':
          dependencies.push(...await this.analyzeRubyDependencies(projectPath));
          break;
        case 'PHP':
          dependencies.push(...await this.analyzePHPDependencies(projectPath));
          break;
      }
    }

    return dependencies;
  }

  private async analyzeNodeDependencies(projectPath: string): Promise<Dependency[]> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      const deps: Dependency[] = [];

      // Production dependencies
      if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(packageJson.dependencies)) {
          deps.push({
            name,
            version: version as string,
            type: 'production'
          });
        }
      }

      // Development dependencies
      if (packageJson.devDependencies) {
        for (const [name, version] of Object.entries(packageJson.devDependencies)) {
          deps.push({
            name,
            version: version as string,
            type: 'development'
          });
        }
      }

      return deps;
    } catch {
      return [];
    }
  }

  private async analyzePythonDependencies(projectPath: string): Promise<Dependency[]> {
    const deps: Dependency[] = [];
    
    // Check requirements.txt
    try {
      const reqPath = path.join(projectPath, 'requirements.txt');
      const content = await fs.readFile(reqPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      
      for (const line of lines) {
        const [name, version] = line.split(/[>=<]/);
        const trimmedName = name?.trim();
        const trimmedVersion = version?.trim();
        
        if (trimmedName) {
          const dep: any = {
            name: trimmedName,
            type: 'production'
          };
          
          if (trimmedVersion) {
            dep.version = trimmedVersion;
          }
          
          deps.push(dep);
        }
      }
    } catch {
      // No requirements.txt
    }

    // Check pyproject.toml
    try {
      const pyprojectPath = path.join(projectPath, 'pyproject.toml');
      const content = await fs.readFile(pyprojectPath, 'utf-8');
      // Simple parsing - in production you'd want a proper TOML parser
      const dependencySection = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?=\[|$)/);
      if (dependencySection && dependencySection[1]) {
        const depLines = dependencySection[1].split('\n').filter(line => line.includes('='));
        for (const line of depLines) {
          const [name, version] = line.split('=').map(s => s.trim());
          if (name && !name.startsWith('#')) {
            const cleanName = name.replace(/["']/g, '');
            const cleanVersion = version?.replace(/["']/g, '');
            
            const dep: any = {
              name: cleanName,
              type: 'production'
            };
            
            if (cleanVersion) {
              dep.version = cleanVersion;
            }
            
            deps.push(dep);
          }
        }
      }
    } catch {
      // No pyproject.toml
    }

    return deps;
  }

  private async analyzeRustDependencies(projectPath: string): Promise<Dependency[]> {
    try {
      const cargoPath = path.join(projectPath, 'Cargo.toml');
      const content = await fs.readFile(cargoPath, 'utf-8');
      const deps: Dependency[] = [];
      
      // Simple TOML parsing for dependencies
      const dependencySection = content.match(/\[dependencies\]([\s\S]*?)(?=\[|$)/);
      if (dependencySection && dependencySection[1]) {
        const depLines = dependencySection[1].split('\n').filter(line => line.includes('='));
        for (const line of depLines) {
          const [name, version] = line.split('=').map(s => s.trim());
          if (name && !name.startsWith('#')) {
            const cleanName = name.replace(/["']/g, '');
            const cleanVersion = version?.replace(/["']/g, '');
            
            const dep: any = {
              name: cleanName,
              type: 'production'
            };
            
            if (cleanVersion) {
              dep.version = cleanVersion;
            }
            
            deps.push(dep);
          }
        }
      }

      return deps;
    } catch {
      return [];
    }
  }

  private async analyzeGoDependencies(projectPath: string): Promise<Dependency[]> {
    try {
      const goModPath = path.join(projectPath, 'go.mod');
      const content = await fs.readFile(goModPath, 'utf-8');
      const deps: Dependency[] = [];
      
      const lines = content.split('\n');
      let inRequire = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === 'require (') {
          inRequire = true;
          continue;
        }
        if (trimmed === ')' && inRequire) {
          inRequire = false;
          continue;
        }
        if (inRequire && trimmed) {
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2 && parts[0] && parts[1]) {
            deps.push({
              name: parts[0],
              version: parts[1],
              type: 'production'
            });
          }
        }
      }

      return deps;
    } catch {
      return [];
    }
  }

  private async analyzeJavaDependencies(projectPath: string): Promise<Dependency[]> {
    const deps: Dependency[] = [];
    
    // Check pom.xml (Maven)
    try {
      const pomPath = path.join(projectPath, 'pom.xml');
      const content = await fs.readFile(pomPath, 'utf-8');
      // Simple XML parsing - in production you'd want a proper XML parser
      const dependencyMatches = content.matchAll(/<dependency>[\s\S]*?<\/dependency>/g);
      
      for (const match of dependencyMatches) {
        const depXml = match[0];
        const groupId = depXml.match(/<groupId>(.*?)<\/groupId>/)?.[1];
        const artifactId = depXml.match(/<artifactId>(.*?)<\/artifactId>/)?.[1];
        const version = depXml.match(/<version>(.*?)<\/version>/)?.[1];
        const scope = depXml.match(/<scope>(.*?)<\/scope>/)?.[1] || 'production';
        
        if (groupId && artifactId) {
          const dep: any = {
            name: `${groupId}:${artifactId}`,
            type: scope === 'test' ? 'development' : 'production'
          };
          
          if (version) {
            dep.version = version;
          }
          
          deps.push(dep);
        }
      }
    } catch {
      // No pom.xml
    }

    // Check build.gradle (Gradle)
    try {
      const gradlePath = path.join(projectPath, 'build.gradle');
      const content = await fs.readFile(gradlePath, 'utf-8');
      
      // Simple parsing for implementation/testImplementation lines
      const depLines = content.split('\n').filter(line => 
        line.trim().match(/^(implementation|testImplementation|api|compileOnly)\s+/)
      );
      
      for (const line of depLines) {
        const match = line.match(/(implementation|testImplementation|api|compileOnly)\s+['"]([^'"]+)['"]/) ||
                     line.match(/(implementation|testImplementation|api|compileOnly)\s+([^\s]+)/);
        
        if (match) {
          const [, depType, depName] = match;
          if (depType && depName) {
            deps.push({
              name: depName,
              type: depType.includes('test') ? 'development' : 'production'
            });
          }
        }
      }
    } catch {
      // No build.gradle
    }

    return deps;
  }

  private async analyzeDotNetDependencies(projectPath: string): Promise<Dependency[]> {
    const deps: Dependency[] = [];
    
    try {
      const files = await fs.readdir(projectPath);
      const projFiles = files.filter(file => file.endsWith('.csproj') || file.endsWith('.fsproj'));
      
      for (const projFile of projFiles) {
        const content = await fs.readFile(path.join(projectPath, projFile), 'utf-8');
        const packageRefs = content.matchAll(/<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"/g);
        
        for (const match of packageRefs) {
          if (match[1] && match[2]) {
            deps.push({
              name: match[1],
              version: match[2],
              type: 'production'
            });
          }
        }
      }
    } catch {
      // No project files
    }

    return deps;
  }

  private async analyzeRubyDependencies(projectPath: string): Promise<Dependency[]> {
    try {
      const gemfilePath = path.join(projectPath, 'Gemfile');
      const content = await fs.readFile(gemfilePath, 'utf-8');
      const deps: Dependency[] = [];
      
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/gem\s+['"]([^'"]+)['"](?:,\s*['"]([^'"]+)['"])?/);
        if (match && match[1]) {
          const dep: any = {
            name: match[1],
            type: 'production'
          };
          
          if (match[2]) {
            dep.version = match[2];
          }
          
          deps.push(dep);
        }
      }

      return deps;
    } catch {
      return [];
    }
  }

  private async analyzePHPDependencies(projectPath: string): Promise<Dependency[]> {
    try {
      const composerPath = path.join(projectPath, 'composer.json');
      const composerJson = JSON.parse(await fs.readFile(composerPath, 'utf-8'));
      const deps: Dependency[] = [];

      if (composerJson.require) {
        for (const [name, version] of Object.entries(composerJson.require)) {
          deps.push({
            name,
            version: version as string,
            type: 'production'
          });
        }
      }

      if (composerJson['require-dev']) {
        for (const [name, version] of Object.entries(composerJson['require-dev'])) {
          deps.push({
            name,
            version: version as string,
            type: 'development'
          });
        }
      }

      return deps;
    } catch {
      return [];
    }
  }

  private async analyzeComponents(projectPath: string, fileStructure: any, languages: string[]): Promise<Component[]> {
    return this.codeRelationAnalyzer.analyzeComponents(projectPath, fileStructure, languages);
  }

  private async analyzeDataFlow(projectPath: string, components: Component[], languages: string[]): Promise<DataFlow> {
    return this.dataFlowAnalyzer.analyze(projectPath, components, languages);
  }

  private async analyzePatterns(projectPath: string, fileStructure: any, components: Component[], languages: string[]): Promise<{ architecturalPatterns: Pattern[]; designPatterns: Pattern[]; antiPatterns: Pattern[]; }> {
    return this.patternRecognizer.recognize(projectPath, fileStructure, components, languages);
  }

  private async analyzeAPIContracts(projectPath: string, components: Component[], languages: string[]): Promise<APIContracts> {
    return this.apiContractAnalyzer.analyze(projectPath, components, languages);
  }

  private async analyzeBusinessLogic(projectPath: string, components: Component[], languages: string[]): Promise<BusinessLogic | undefined> {
    try {
      return await this.businessLogicAnalyzer.analyze(projectPath, components, languages);
    } catch {
      return undefined;
    }
  }

  private countFiles(structure: any): number {
    if (!structure) return 0;
    let count = structure.type === 'file' ? 1 : 0;
    if (structure.children) {
      for (const child of structure.children) {
        count += this.countFiles(child);
      }
    }
    return count;
  }

  private calculateComplexity(context: ProjectContext): number {
    // Simple complexity calculation based on multiple factors
    let complexity = 0;
    
    complexity += context.components.length * 2; // Components add complexity
    complexity += context.dependencies.length; // Dependencies add complexity
    complexity += context.patterns.architecturalPatterns.length * 5; // Architectural patterns add more complexity
    complexity += context.patterns.designPatterns.length * 3; // Design patterns add complexity
    complexity += context.patterns.antiPatterns.length * 10; // Anti-patterns add high complexity
    complexity += context.apiContracts.endpoints.length * 3; // API endpoints add complexity
    complexity += context.dataFlow.nodes.length * 2; // Data flow nodes add complexity
    
    return Math.min(complexity, 1000); // Cap at 1000
  }
}
