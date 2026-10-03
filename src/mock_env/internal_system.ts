/**
 * @file internal_system.ts
 * @description Simulated Internal Corporate ERP/Ledger System.
 * Acts as a mock API & Database service with schema validation, state tracking,
 * and transient error simulation to test agentic resilience and self-healing loops.
 */

export interface InvoiceSubmissionRecord {
  id: string;
  company: string;
  amount: number;
  dueDate: string;
  submittedAt: string;
  status: 'PENDING_APPROVAL' | 'PROCESSED';
}

export interface SubmissionResult {
  success: boolean;
  message: string;
  record?: InvoiceSubmissionRecord;
  transactionId: string;
}

class InternalSystemState {
  private records: Map<string, InvoiceSubmissionRecord> = new Map();
  private callCount: number = 0;
  private transientFailuresTriggered: number = 0;

  /**
   * Resets internal memory state (useful for test runs and clean restarts).
   */
  public reset(): void {
    this.records.clear();
    this.callCount = 0;
    this.transientFailuresTriggered = 0;
  }

  /**
   * Simulates submitting an invoice into the internal financial database.
   *
   * @param company Name of the vendor/company
   * @param amount Invoice total amount (must be positive number)
   * @param dueDate Due date in YYYY-MM-DD format
   * @param simulateTransientError Whether to simulate a network/database flake on the 1st attempt
   * @throws Error on validation failures or simulated transient network drops
   */
  public async submitInvoiceData(
    company: string,
    amount: number,
    dueDate: string,
    simulateTransientError: boolean = process.env.SIMULATE_TRANSIENT_ERRORS !== '0'
  ): Promise<SubmissionResult> {
    this.callCount++;

    // 1. Transient Error Simulation (to verify agentic recovery and retry logic)
    if (simulateTransientError && this.transientFailuresTriggered < 1) {
      this.transientFailuresTriggered++;
      throw new Error(
        `[TRANSIENT_ERROR_504] Internal Ledger Gateway Timeout: The database connection timed out while processing transaction for "${company}". Please retry the operation.`
      );
    }

    // 2. Strict Input Validation
    if (!company || typeof company !== 'string' || company.trim().length === 0) {
      throw new Error(
        `[VALIDATION_ERROR] Missing or invalid 'company' field. Expected non-empty string, received: ${JSON.stringify(company)}`
      );
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error(
        `[VALIDATION_ERROR] Invalid 'amount' field. Expected positive number, received: ${JSON.stringify(amount)}`
      );
    }

    if (!dueDate || typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
      throw new Error(
        `[VALIDATION_ERROR] Invalid 'dueDate' format. Expected 'YYYY-MM-DD', received: ${JSON.stringify(dueDate)}`
      );
    }

    // 3. Normalization and Record Creation
    const transactionId = `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const record: InvoiceSubmissionRecord = {
      id: transactionId,
      company: company.trim(),
      amount: Math.round(numAmount * 100) / 100, // Round to 2 decimals
      dueDate: dueDate.trim(),
      submittedAt: new Date().toISOString(),
      status: 'PROCESSED'
    };

    // Store in-memory
    this.records.set(transactionId, record);

    return {
      success: true,
      message: `Invoice for ${record.company} ($${record.amount.toFixed(2)}, due ${record.dueDate}) successfully recorded in internal ledger.`,
      record,
      transactionId
    };
  }

  /**
   * Helper to retrieve all recorded invoices in the internal system.
   */
  public getSubmittedInvoices(): InvoiceSubmissionRecord[] {
    return Array.from(this.records.values());
  }

  /**
   * Returns current execution stats for verification.
   */
  public getStats() {
    return {
      totalCalls: this.callCount,
      transientFailuresInjected: this.transientFailuresTriggered,
      storedRecordsCount: this.records.size
    };
  }
}

// Export singleton instance and direct helper function
export const internalSystem = new InternalSystemState();

/**
 * Top-level mock API function matching the specification.
 */
export async function submitInvoiceData(
  company: string,
  amount: number,
  dueDate: string
): Promise<SubmissionResult> {
  return internalSystem.submitInvoiceData(company, amount, dueDate);
}
