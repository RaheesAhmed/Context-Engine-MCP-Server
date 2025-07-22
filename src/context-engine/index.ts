// Main exports for the Context Engine
export { ProjectContextAnalyzer } from './ProjectContextAnalyzer.js';

// Export types for external use
export type {
  ProjectContext,
  CompressedContext,
  FileStructure,
  Component,
  Dependency,
  Pattern,
  DataFlow,
  APIContracts,
  BusinessLogic,
  AnalyzerOptions,
  CompressorOptions,
  TemplateOptions,
  SemanticNetwork,
  DependencyGraph,
  LanguageInfo
} from './types.js';

// Export analyzers if needed externally
export { FileStructureAnalyzer } from './analyzers/FileStructureAnalyzer.js';
export { CodeRelationAnalyzer } from './analyzers/CodeRelationAnalyzer.js';
export { DataFlowAnalyzer } from './analyzers/DataFlowAnalyzer.js';
export { APIContractAnalyzer } from './analyzers/APIContractAnalyzer.js';
export { BusinessLogicAnalyzer } from './analyzers/BusinessLogicAnalyzer.js';

// Export compressors if needed externally
export { SemanticCompressor } from './compressors/SemanticCompressor.js';
export { DependencyGraphCompressor } from './compressors/DependencyGraphCompressor.js';
export { PatternRecognizer } from './compressors/PatternRecognizer.js';
export { ContextTemplater } from './compressors/ContextTemplater.js';
