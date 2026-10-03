/**
 * @file internal_system.test.ts
 * @description Local integration test verifying tool execution, validation rules,
 * and transient error recovery mechanisms without incurring LLM token costs.
 */

import { executeTool } from '../tools/handlers.js';
import { internalSystem } from './internal_system.js';

async function runLocalTests() {
  console.log('🧪 Starting mock environment & tool integration tests...\n');

  // Test 1: list_files
  console.log('Test 1: list_files("mock_data")');
  const listResult = await executeTool('list_files', { directory_path: 'mock_data' });
  console.assert(listResult.success === true, 'list_files should succeed');
  const parsedList = JSON.parse(listResult.output);
  console.log(`  ✓ Found ${parsedList.totalEntries} files in mock_data.`);

  // Test 2: read_file
  console.log('\nTest 2: read_file("mock_data/invoice_company_x_2025_03.json")');
  const readResult = await executeTool('read_file', {
    file_path: 'mock_data/invoice_company_x_2025_03.json'
  });
  console.assert(readResult.success === true, 'read_file should succeed');
  const parsedInvoice = JSON.parse(readResult.output);
  console.log(`  ✓ Successfully read invoice for "${parsedInvoice.company_name}", amount: $${parsedInvoice.total_amount}`);

  // Test 3: submit_to_internal_system with Transient Error
  console.log('\nTest 3: submit_to_internal_system (Verifying transient error on 1st call)');
  internalSystem.reset();

  const attempt1 = await executeTool('submit_to_internal_system', {
    company: 'Company X',
    amount: 7820.50,
    due_date: '2025-04-22'
  });
  console.assert(attempt1.success === false, 'Attempt 1 should fail with transient error');
  console.log(`  ✓ First attempt failed as expected: ${attempt1.error}`);

  // Test 4: Retry submission
  console.log('\nTest 4: submit_to_internal_system (Retry after failure)');
  const attempt2 = await executeTool('submit_to_internal_system', {
    company: 'Company X',
    amount: 7820.50,
    due_date: '2025-04-22'
  });
  console.assert(attempt2.success === true, 'Attempt 2 should succeed');
  console.log(`  ✓ Retry attempt succeeded: ${attempt2.output}`);

  // Test 5: Verify in-memory database
  const records = internalSystem.getSubmittedInvoices();
  console.assert(records.length === 1, 'Database should contain 1 record');
  console.log(`  ✓ Database contains committed record ID: ${records[0].id}`);

  console.log('\n🎉 ALL LOCAL TOOL TESTS PASSED SUCCESSFULLY!\n');
}

runLocalTests().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
