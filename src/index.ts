/**
 * @file index.ts
 * @description Entry point for the Autonomous AI Task Worker prototype.
 * Sets up environment, initializes the test scenario, and runs the ReAct agent.
 */

import dotenv from 'dotenv';
import pc from 'picocolors';
import { AutonomousTaskAgent } from './agent/agent.js';
import { internalSystem } from './mock_env/internal_system.js';

// Load environment variables from .env
dotenv.config();

async function main() {
  console.log(pc.cyan(`
╔════════════════════════════════════════════════════════════════════════════╗
║                AUTONOMOUS AI TASK WORKER - REACT PROTOTYPE                 ║
╚════════════════════════════════════════════════════════════════════════════╝
  `));

  // Verify API Key existence
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here');
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here');

  if (!hasAnthropic && !hasOpenAI) {
    console.log(pc.yellow('⚠️  NO VALID API KEY DETECTED IN ENVIRONMENT!'));
    console.log(pc.white(`
To run this prototype with live LLM tool calling:
1. Copy ${pc.bold('.env.example')} to ${pc.bold('.env')}
2. Set your ${pc.bold('ANTHROPIC_API_KEY')} (or ${pc.bold('OPENAI_API_KEY')})
3. Run ${pc.bold('npm run dev')} again.
    `));
    process.exit(1);
  }

  // Reset internal system state to ensure deterministic testing
  internalSystem.reset();

  // Exact scenario test prompt
  const testScenarioPrompt =
    'Find the latest invoice from Company X, extract the amount and due date, enter it into our internal system, and tell me once it is done.';

  const agent = new AutonomousTaskAgent();
  const startTime = Date.now();

  try {
    const result = await agent.run(testScenarioPrompt);
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + pc.bold(pc.bgMagenta(pc.black(' 📊 POST-RUN VERIFICATION & AUDIT '))) + '\n');
    console.log(pc.cyan(`⏱️  Total Execution Time : ${durationSec}s`));
    console.log(pc.cyan(`🔄 Total ReAct Cycles   : ${result.totalSteps}`));

    // Inspect the internal database/ledger to verify state modification
    const dbRecords = internalSystem.getSubmittedInvoices();
    const stats = internalSystem.getStats();

    console.log(pc.cyan(`💾 Internal System State:`));
    console.log(`   - Injected Transient Failures : ${pc.bold(stats.transientFailuresInjected)}`);
    console.log(`   - Total API Call Attempts     : ${pc.bold(stats.totalCalls)}`);
    console.log(`   - Committed Database Records  : ${pc.bold(dbRecords.length)}`);

    if (dbRecords.length > 0) {
      console.log(pc.green(`\n📑 Ledger Record Verified:`));
      console.log(pc.dim(JSON.stringify(dbRecords[0], null, 2)));
    } else {
      console.log(pc.red(`\n⚠️ No invoice record found in the internal system database.`));
    }
  } catch (error: any) {
    console.error(pc.red(`Fatal Execution Error: ${error.message}`));
    process.exit(1);
  }
}

main();
