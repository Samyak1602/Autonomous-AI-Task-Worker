/**
 * @file provider.ts
 * @description Provider-agnostic LLM interface supporting Anthropic Claude and OpenAI.
 * Normalizes tool calling conventions, system prompt injection, and message schemas.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { getAnthropicTools, getOpenAITools } from '../tools/definitions.js';

export type ProviderType = 'anthropic' | 'openai';

export interface NormalizedToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface LLMStepResponse {
  type: 'text' | 'tool_call';
  text?: string;
  toolCalls?: NormalizedToolCall[];
  raw?: any;
}

export interface UniversalMessage {
  role: 'user' | 'assistant' | 'tool';
  content?: string | any[];
  tool_call_id?: string; // OpenAI
  tool_use_id?: string; // Anthropic
  name?: string;
  tool_calls?: any[];
}

export class LLMClient {
  public provider: ProviderType;
  private anthropicClient?: Anthropic;
  private openaiClient?: OpenAI;
  public model: string;

  constructor() {
    const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here');
    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here');

    const preferredProvider = (process.env.LLM_PROVIDER || '').toLowerCase();

    if (preferredProvider === 'openai' && hasOpenAI) {
      this.provider = 'openai';
      this.model = process.env.OPENAI_MODEL || 'gpt-4o';
      this.openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } else if (hasAnthropic) {
      this.provider = 'anthropic';
      this.model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
      this.anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    } else if (hasOpenAI) {
      this.provider = 'openai';
      this.model = process.env.OPENAI_MODEL || 'gpt-4o';
      this.openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } else {
      // Default to Anthropic configuration placeholder
      this.provider = 'anthropic';
      this.model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
      this.anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key'
      });
    }
  }

  /**
   * Executes a single turn of the LLM conversation with native tool definitions.
   */
  public async callLLM(
    systemPrompt: string,
    history: any[]
  ): Promise<LLMStepResponse> {
    if (this.provider === 'anthropic') {
      return this.callAnthropic(systemPrompt, history);
    } else {
      return this.callOpenAI(systemPrompt, history);
    }
  }

  private async callAnthropic(
    systemPrompt: string,
    history: Anthropic.MessageParam[]
  ): Promise<LLMStepResponse> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client is not initialized. Please set ANTHROPIC_API_KEY in .env');
    }

    const tools = getAnthropicTools();

    const response = await this.anthropicClient.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: history,
      tools: tools as any
    });

    const toolUseBlocks = response.content.filter((c) => c.type === 'tool_use');
    const textBlocks = response.content.filter((c) => c.type === 'text');

    const combinedText = textBlocks.map((b: any) => b.text).join('\n').trim();

    if (toolUseBlocks.length > 0) {
      const toolCalls: NormalizedToolCall[] = toolUseBlocks.map((block: any) => ({
        id: block.id,
        name: block.name,
        args: block.input
      }));

      return {
        type: 'tool_call',
        text: combinedText || undefined,
        toolCalls,
        raw: response
      };
    }

    return {
      type: 'text',
      text: combinedText,
      raw: response
    };
  }

  private async callOpenAI(
    systemPrompt: string,
    history: OpenAI.ChatCompletionMessageParam[]
  ): Promise<LLMStepResponse> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client is not initialized. Please set OPENAI_API_KEY in .env');
    }

    const tools = getOpenAITools();

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history
    ];

    const response = await this.openaiClient.chat.completions.create({
      model: this.model,
      messages,
      tools: tools as any,
      tool_choice: 'auto'
    });

    const choice = response.choices[0];
    const message = choice.message;

    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCalls: NormalizedToolCall[] = message.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments || '{}')
      }));

      return {
        type: 'tool_call',
        text: message.content || undefined,
        toolCalls,
        raw: message
      };
    }

    return {
      type: 'text',
      text: message.content || '',
      raw: message
    };
  }
}
