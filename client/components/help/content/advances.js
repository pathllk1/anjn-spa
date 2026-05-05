export const content = `
<h3 class="text-lg font-bold text-gray-900 mb-4">Employee Advances Management</h3>
<div class="space-y-4 text-gray-700">
  <p>Track employee advances (loans) and repayments. Advances can be disbursed in cash or via bank transfer, and repaid through wage deductions or direct payments.</p>
  
  <h4 class="font-semibold text-gray-900 mt-4">Advance Types:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>ADVANCE:</strong> Money given to employee (increases outstanding balance)</li>
    <li><strong>REPAYMENT:</strong> Money received from employee (decreases outstanding balance)</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Advance Statuses:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>PENDING:</strong> Initial state</li>
    <li><strong>POSTED:</strong> Posted to ledger</li>
    <li><strong>COMPLETED:</strong> Fully repaid</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Recording Advances:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>Get Employee Balance:</strong> View outstanding balance for employee</li>
    <li><strong>Get Advance History:</strong> View all transactions (disbursements and repayments)</li>
    <li><strong>Record Advance:</strong> Create new advance or repayment</li>
    <li><strong>Delete Advance:</strong> Remove advance record (except wage deductions)</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Payment Modes:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>CASH:</strong> Direct cash payment</li>
    <li><strong>BANK_TRANSFER:</strong> Via bank account</li>
    <li><strong>WAGE_DEDUCTION:</strong> Automatic deduction from wages</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Validations:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>Repayment cannot exceed outstanding balance</li>
    <li>Wage deduction repayments cannot be deleted (edit wage instead)</li>
    <li>All advances posted to ledger automatically</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Ledger Integration:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>Advances account tracks total outstanding</li>
    <li>Repayments reduce the liability</li>
    <li>Full audit trail maintained</li>
    <li>Ledger entries deleted if advance is deleted</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Bulk Operations:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>Get All Employee Balances: Fetch balances for all employees in firm</li>
    <li>Aggregate by employee: Total advances and repayments</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Wage Deduction Integration:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>In Wages Dashboard, enter Advance Deduction amount</li>
    <li>System validates against outstanding advance balance</li>
    <li>Repayment automatically recorded in Advances module</li>
    <li>Linked to wage record for audit trail</li>
  </ul>
</div>
`;
