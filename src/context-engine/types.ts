export interface LanguageInfo {
  language: string;
  fileCount: number;
  percentage: number;
}

export interface FileStructure {
  path: string;
  name: string;
  type: 'file' | 'directory';
  children?: FileStructure[];
  size?: number;
  extension?: string;
  language?: string;
  languageInfo?: LanguageInfo[];
  entryPoint?: boolean;
  configFile?: boolean;
  testFile?: boolean;
  buildFile?: boolean;
  documentationFile?: boolean;
}

export interface Dependency {
  name: string;
  version?: string;
  type: 'production' | 'development' | 'peer' | 'external' | 'internal';
  description?: string;
  source?: string;
  target?: string;
}

export interface Component {
  name: string;
  type: 'class' | 'function' | 'react-component' | 'service' | 'module' | 'struct' | 'enum' | 'interface' | 'trait' | 'impl';
  path: string;
  language?: string;
  startLine?: number;
  endLine?: number;
  props?: any[];
  methods?: string[];
  fields?: string[];
  dependencies?: string[];
  exports?: string[];
  imports?: string[];
  visibility?: 'public' | 'private' | 'protected' | 'internal';
  async?: boolean;
  generic?: boolean;
  annotations?: string[];
}

export interface DataFlowNode {
  id: string;
  name: string;
  type: 'input' | 'process' | 'output' | 'storage' | 'api' | 'database' | 'service';
  language?: string;
  connections: string[];
  metadata?: any;
}

export interface DataFlow {
  nodes: DataFlowNode[];
  connections: DataFlowConnection[];
}

export interface DataFlowConnection {
  from: string;
  to: string;
  type: 'data' | 'control' | 'dependency';
  label?: string;
}

export interface Pattern {
  name: string;
  type: 'architectural' | 'design' | 'antipattern' | 'language-specific';
  language?: string;
  instances: PatternInstance[];
  confidence?: number;
}

export interface PatternInstance {
  location: string;
  confidence: number;
  metadata?: any;
}

export interface APIEndpoint {
  method: string;
  path: string;
  handler?: string;
  file?: string;
  parameters?: APIParameter[];
  responses?: APIResponse[];
}

export interface APIParameter {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface APIResponse {
  status: number;
  description?: string;
  schema?: any;
}

export interface APIContracts {
  endpoints: APIEndpoint[];
  schemas: any[];
  middleware: string[];
}

export interface BusinessLogic {
  domain: string;
  entities: string[];
  services: string[];
  rules: BusinessRule[];
}

export interface BusinessRule {
  name: string;
  description: string;
  location: string;
  complexity?: number;
}

export interface ProjectContext {
  fileStructure: FileStructure;
  dependencies: Dependency[];
  components: Component[];
  dataFlow: DataFlow;
  patterns: {
    architecturalPatterns: Pattern[];
    designPatterns: Pattern[];
    antiPatterns: Pattern[];
  };
  apiContracts: APIContracts;
  businessLogic?: BusinessLogic;
  languages: string[];
  mainLanguage?: string;
  framework?: string;
  buildSystem?: string;
}

export interface SemanticEntity {
  name: string;
  type: string;
  purpose: string;
  language?: string;
  relationships: string[];
  importance?: number;
}

export interface SemanticRelationship {
  from: string;
  to: string;
  type: 'depends_on' | 'implements' | 'extends' | 'uses' | 'calls' | 'imports';
  strength?: number;
}

export interface SemanticNetwork {
  entities: SemanticEntity[];
  relationships: SemanticRelationship[];
}

export interface DependencyGraphNode {
  id: string;
  label: string;
  type: 'internal' | 'external' | 'system';
  language?: string;
  metadata?: any;
}

export interface DependencyGraphEdge {
  from: string;
  to: string;
  type: 'import' | 'require' | 'inject' | 'use' | 'call' | 'inherit';
  weight?: number;
}

export interface DependencyGraph {
  nodes: DependencyGraphNode[];
  edges: DependencyGraphEdge[];
}

export interface ComponentMap {
  [key: string]: {
    pattern: string;
    language?: string;
    integrates: string[];
    lifecycle?: string;
    io_flow?: string;
    features?: string[];
    purpose?: string;
    capabilities?: string[];
    dependencies?: string[];
  };
}

export interface UserFlow {
  name: string;
  description?: string;
  steps: FlowStep[];
  language?: string;
}

export interface FlowStep {
  step: string;
  component?: string;
  action?: string;
  data?: any;
}

export interface CriticalPath {
  name: string;
  description?: string;
  flow: string;
  components: string[];
  risk?: 'low' | 'medium' | 'high';
}

export interface CompressedContext {
  overview: {
    languages: string[];
    mainLanguage?: string;
    framework?: string;
    totalFiles: number;
    totalComponents: number;
    complexity?: number;
  };
  semanticNetwork: SemanticNetwork;
  dependencyGraph: DependencyGraph;
  patterns: Pattern[];
  template: {
    componentMap: ComponentMap;
    userFlows: UserFlow[];
    criticalPaths: CriticalPath[];
    keyInsights: string[];
  };
}

export interface AnalyzerOptions {
  maxDepth?: number;
  includeTests?: boolean;
  includeNodeModules?: boolean;
  fileExtensions?: string[];
  languages?: string[];
  analyzeConfig?: boolean;
  focusAreas?: string[];
}

export interface CompressorOptions {
  maxEntities?: number;
  minConfidence?: number;
  includeMetadata?: boolean;
  targetSize?: number;
  preserveImportant?: boolean;
}

export interface TemplateOptions {
  targetSize?: number;
  includeCode?: boolean;
  focusAreas?: string[];
  format?: 'json' | 'markdown' | 'yaml';
}

// Language-specific analyzers
export interface LanguageAnalyzer {
  language: string;
  fileExtensions: string[];
  analyze(content: string, filePath: string): Promise<LanguageAnalysisResult>;
}

export interface LanguageAnalysisResult {
  components: Component[];
  dependencies: Dependency[];
  exports: string[];
  imports: string[];
  patterns: Pattern[];
  complexity?: number;
}

// Multi-language support
export interface MultiLanguageContext {
  [language: string]: {
    files: FileStructure[];
    components: Component[];
    patterns: Pattern[];
    dependencies: Dependency[];
    framework?: string;
    buildSystem?: string;
  };
}
