/**
 * @file handlers.ts
 * @description Native TypeScript tool implementations with defensive file access,
 * validation, and error serialization for the Agent ReAct loop.
 */

import fs from 'fs/promises';
import path from 'path';
import { submitInvoiceData } from '../mock_env/internal_system.js';
import { ToolExecutionResult } from './types.js';

/**
 * Lists all files within a local directory.
 */
export async function handleListFiles(args: { directory_path: string }): Promise<string> {
  const dirPath = args.directory_path || 'mock_data';
  const resolvedPath = path.resolve(process.cwd(), dirPath);

  try {
    const stats = await fs.stat(resolvedPath);
    if (!stats.isDirectory()) {
      throw new Error(`Path "${dirPath}" is not a directory.`);
    }

    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
    const fileList = await Promise.all(
      entries.map(async (entry) => {
        const fullEntryPath = path.join(resolvedPath, entry.name);
        let size = 0;
        try {
          const entryStat = await fs.stat(fullEntryPath);
          size = entryStat.size;
        } catch {
          // ignore stat errors on individual files
        }

        return {
          name: entry.name,
          relativePath: path.relative(process.cwd(), fullEntryPath).replace(/\\/g, '/'),
          type: entry.isDirectory() ? 'directory' : 'file',
          sizeBytes: size
        };
      })
    );

    return JSON.stringify(
      {
        directory: dirPath,
        totalEntries: fileList.length,
        files: fileList
      },
      null,
      2
    );
  } catch (err: any) {
    throw new Error(`Failed to list directory "${dirPath}": ${err.message}`);
  }
}

/**
 * Reads the content of a local file safely.
 */
export async function handleReadFile(args: { file_path: string }): Promise<string> {
  const filePath = args.file_path;
  if (!filePath) {
    throw new Error(`"file_path" argument is required.`);
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);

  try {
    const stats = await fs.stat(resolvedPath);
    if (stats.isDirectory()) {
      throw new Error(`Path "${filePath}" is a directory, not a file. Use list_files instead.`);
    }

    const content = await fs.readFile(resolvedPath, 'utf-8');
    return content;
  } catch (err: any) {
    throw new Error(`Failed to read file "${filePath}": ${err.message}`);
  }
}

/**
 * Submits invoice data to the mock internal corporate system.
 */
export async function handleSubmitToInternalSystem(args: {
  company: string;
  amount: number;
  due_date: string;
}): Promise<string> {
  const { company, amount, due_date } = args;

  // Delegate directly to the mock internal system
  const result = await submitInvoiceData(company, amount, due_date);
  return JSON.stringify(result, null, 2);
}

/**
 * Master dispatcher that executes a tool call by name.
 * Encapsulates execution inside try/catch to ensure standard error formatting.
 */
export async function executeTool(
  toolName: string,
  rawArgs: Record<string, any> | string
): Promise<ToolExecutionResult> {
  const timestamp = new Date().toISOString();
  let args: Record<string, any> = {};

  try {
    if (typeof rawArgs === 'string') {
      args = JSON.parse(rawArgs);
    } else {
      args = rawArgs || {};
    }
  } catch (e: any) {
    return {
      toolName,
      args: {},
      success: false,
      output: '',
      error: `Malformed JSON arguments passed to tool "${toolName}": ${e.message}`,
      timestamp
    };
  }

  try {
    let output = '';
    switch (toolName) {
      case 'list_files':
        output = await handleListFiles(args as { directory_path: string });
        break;

      case 'read_file':
        output = await handleReadFile(args as { file_path: string });
        break;

      case 'submit_to_internal_system':
        output = await handleSubmitToInternalSystem(
          args as { company: string; amount: number; due_date: string }
        );
        break;

      default:
        throw new Error(
          `Unknown tool: "${toolName}". Available tools: list_files, read_file, submit_to_internal_system.`
        );
    }

    return {
      toolName,
      args,
      success: true,
      output,
      timestamp
    };
  } catch (error: any) {
    return {
      toolName,
      args,
      success: false,
      output: '',
      error: error.message || String(error),
      timestamp
    };
  }
}
