/**
 * @file definitions.ts
 * @description Standard JSON Schema tool definitions for LLM tool-calling.
 * Compatible with Anthropic Claude SDK and OpenAI function calling.
 */

import { ToolDefinition } from './types.js';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'list_files',
    description: 'List all files within a specified local directory path (e.g., "mock_data" or "./mock_data"). Returns filenames, extensions, and file sizes.',
    parameters: {
      type: 'object',
      properties: {
        directory_path: {
          type: 'string',
          description: 'The directory path to list files from (e.g. "mock_data").'
        }
      },
      required: ['directory_path']
    }
  },
  {
    name: 'read_file',
    description: 'Read the full UTF-8 text or JSON contents of a file given its path (e.g., "mock_data/invoice_company_x_2025_03.json").',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The relative or absolute file path to read.'
        }
      },
      required: ['file_path']
    }
  },
  {
    name: 'submit_to_internal_system',
    description: 'Submit verified invoice details (company, amount, due_date) into the internal financial accounting system / ERP ledger.',
    parameters: {
      type: 'object',
      properties: {
        company: {
          type: 'string',
          description: 'The exact company or vendor name (e.g., "Company X").'
        },
        amount: {
          type: 'number',
          description: 'The total invoice amount in USD as a positive decimal number (e.g., 7820.50).'
        },
        due_date: {
          type: 'string',
          description: 'The invoice payment due date strictly formatted as "YYYY-MM-DD" (e.g., "2025-04-22").'
        }
      },
      required: ['company', 'amount', 'due_date']
    }
  }
];

/**
 * Formats tools for Anthropic Claude SDK (input_schema format).
 */
export function getAnthropicTools() {
  return TOOL_DEFINITIONS.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object' as const,
      properties: tool.parameters.properties,
      required: tool.parameters.required || []
    }
  }));
}

/**
 * Formats tools for OpenAI SDK (function definitions format).
 */
export function getOpenAITools() {
  return TOOL_DEFINITIONS.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters.properties,
        required: tool.parameters.required || []
      }
    }
  }));
}
