/**
 * @file agent.ts
 * @description Core ReAct (Reason + Act) Agent Loop implementation from scratch.
 * Orchestrates multi-step reasoning, native tool execution, try/catch error feedback,
 * and result verification.
 */

import pc from 'picocolors';
import { LLMClient } from '../llm/provider.js';
import { executeTool } from '../tools/handlers.js';
import { AGENT_SYSTEM_PROMPT } from './system_prompt.js';
import { AgentRunResult, AgentStep } from '../tools/types.js';

export class AutonomousTaskAgent {
  private llm: LLMClient;
  private maxSteps: number;

  constructor(maxSteps?: number) {
    this.llm = new LLMClient();
    this.maxSteps = maxSteps || Number(process.env.MAX_AGENT_STEPS) || 15;
  }

  /**
   * Executes the full ReAct loop for a given natural language user prompt.
   */
  public async run(userPrompt: string): Promise<AgentRunResult> {
    console.log(pc.bold(pc.bgCyan(pc.black(' 🚀 STARTING AUTONOMOUS TASK WORKER AGENT '))) + '\n');
    console.log(pc.cyan(`⚡ Provider: ${pc.bold(this.llm.provider.toUpperCase())} | Model: ${pc.bold(this.llm.model)}`));
    console.log(pc.yellow(`🎯 Goal: "${userPrompt}"\n`));
    console.log(pc.gray('─'.repeat(80)));

    const trajectory: AgentStep[] = [];
    const conversationHistory: any[] = [];

    // Initialize conversation with the user prompt
    if (this.llm.provider === 'anthropic') {
      conversationHistory.push({
        role: 'user',
        content: userPrompt
      });
    } else {
      conversationHistory.push({
        role: 'user',
        content: userPrompt
      });
    }

    let stepCount = 0;
    let finalAnswer = '';
    let isCompleted = false;

    while (stepCount < this.maxSteps && !isCompleted) {
      stepCount++;
      const currentStep: AgentStep = { stepNumber: stepCount };

      console.log(pc.bold(pc.blue(`\n[STEP ${stepCount}/${this.maxSteps}]`)) + pc.gray(' Evaluating state & next action...'));

      try {
        // Step A: Call LLM with current conversation history
        const llmResponse = await this.llm.callLLM(AGENT_SYSTEM_PROMPT, conversationHistory);

        // Step B & C: Process LLM output
        if (llmResponse.type === 'tool_call' && llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
          // LLM returned thought and/or tool call(s)
          if (llmResponse.text) {
            currentStep.thought = llmResponse.text;
            console.log(pc.magenta('🤔 THOUGHT:'));
            console.log(pc.italic(llmResponse.text));
          }

          // In Anthropic format, save assistant response block with tool_use
          if (this.llm.provider === 'anthropic') {
            conversationHistory.push({
              role: 'assistant',
              content: (llmResponse.raw as any).content
            });
          } else {
            // OpenAI format
            conversationHistory.push(llmResponse.raw);
          }

          // Execute each requested tool call
          const anthropicToolResults: any[] = [];

          for (const tc of llmResponse.toolCalls) {
            console.log(pc.yellow(`\n⚙️ ACTION (Tool Call): `) + pc.bold(tc.name));
            console.log(pc.gray(`   Arguments: ${JSON.stringify(tc.args, null, 2)}`));

            currentStep.action = {
              toolName: tc.name,
              args: tc.args
            };

            // Step D: Wrap tool execution in try/catch for defensive feedback
            const toolResult = await executeTool(tc.name, tc.args);
            currentStep.observation = toolResult;

            if (toolResult.success) {
              console.log(pc.green(`\n👁️ OBSERVATION (Success):`));
              const truncatedOutput =
                toolResult.output.length > 500
                  ? toolResult.output.slice(0, 500) + '...\n[truncated]'
                  : toolResult.output;
              console.log(pc.dim(truncatedOutput));

              if (this.llm.provider === 'anthropic') {
                anthropicToolResults.push({
                  type: 'tool_result',
                  tool_use_id: tc.id,
                  content: toolResult.output,
                  is_error: false
                });
              } else {
                conversationHistory.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: toolResult.output
                });
              }
            } else {
              // ERROR RECOVERY PATH: Send exact error back to LLM to trigger self-healing
              console.log(pc.red(pc.bold(`\n⚠️ OBSERVATION (Tool Execution Error):`)));
              console.log(pc.red(`   Error: ${toolResult.error}`));
              console.log(pc.yellow(`   ↳ Feeding error back into Agent ReAct context for autonomous recovery...`));

              const errorPayload = JSON.stringify({
                status: 'error',
                tool: tc.name,
                message: toolResult.error,
                suggestion: 'Analyze the error above and either retry (if transient) or correct the parameters.'
              });

              if (this.llm.provider === 'anthropic') {
                anthropicToolResults.push({
                  type: 'tool_result',
                  tool_use_id: tc.id,
                  content: errorPayload,
                  is_error: true
                });
              } else {
                conversationHistory.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: errorPayload
                });
              }
            }
          }

          if (this.llm.provider === 'anthropic' && anthropicToolResults.length > 0) {
            conversationHistory.push({
              role: 'user',
              content: anthropicToolResults
            });
          }

          trajectory.push(currentStep);
        } else {
          // LLM returned final text response (No further tools requested)
          finalAnswer = llmResponse.text || '';
          currentStep.thought = finalAnswer;
          trajectory.push(currentStep);

          console.log(pc.green(pc.bold('\n✨ FINAL AGENT RESPONSE / TASK COMPLETION:')));
          console.log(pc.white(finalAnswer));
          isCompleted = true;
          break;
        }
      } catch (err: any) {
        console.log(pc.red(`[CRITICAL_LOOP_ERROR] ${err.message}`));
        return {
          success: false,
          finalAnswer: '',
          totalSteps: stepCount,
          trajectory,
          error: err.message
        };
      }
    }

    if (!isCompleted && stepCount >= this.maxSteps) {
      console.log(pc.red(`\n⛔ Execution stopped: reached max step limit (${this.maxSteps}).`));
    }

    console.log(pc.gray('\n' + '─'.repeat(80)));
    console.log(
      pc.bold(
        isCompleted
          ? pc.green(`✅ TASK FINISHED SUCCESSFULLY IN ${stepCount} RE-ACT STEPS`)
          : pc.red(`❌ TASK INCOMPLETE AFTER ${stepCount} STEPS`)
      )
    );

    return {
      success: isCompleted,
      finalAnswer,
      totalSteps: stepCount,
      trajectory
    };
  }
}
