/**
 * @file types.ts
 * @description Type definitions for LLM Tool Calling and Agent Execution.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolExecutionResult {
  toolName: string;
  args: Record<string, any>;
  success: boolean;
  output: string;
  error?: string;
  timestamp: string;
}

export interface AgentStep {
  stepNumber: number;
  thought?: string;
  action?: {
    toolName: string;
    args: Record<string, any>;
  };
  observation?: ToolExecutionResult;
  reflection?: string;
}

export interface AgentRunResult {
  success: boolean;
  finalAnswer: string;
  totalSteps: number;
  trajectory: AgentStep[];
  error?: string;
}
