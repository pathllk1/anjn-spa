export const content = `
<h3 class="text-lg font-bold text-gray-900 mb-4">Wage Management & Payroll</h3>
<div class="space-y-4 text-gray-700">
  <p>The Wages Dashboard handles monthly salary calculations, wage processing, and payroll generation. It supports three modes: Create (new wages), Manage (edit existing), and Report (analysis).</p>
  
  <h4 class="font-semibold text-gray-900 mt-4">Wage Components:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>Gross Salary:</strong> Total monthly salary</li>
    <li><strong>Wage Days:</strong> Days worked (1-31)</li>
    <li><strong>Per Day Wage:</strong> Calculated as Gross / Wage Days</li>
    <li><strong>EPF Deduction:</strong> Employee Provident Fund</li>
    <li><strong>ESIC Deduction:</strong> Employee State Insurance</li>
    <li><strong>Other Deduction:</strong> Additional deductions</li>
    <li><strong>Other Benefit:</strong> Additional allowances/bonuses</li>
    <li><strong>Advance Deduction:</strong> Repayment of employee advances</li>
    <li><strong>Net Salary:</strong> Gross - EPF - ESIC - Other Deduction - Advance + Other Benefit</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Wage Statuses:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>DRAFT:</strong> Initial state, not posted to ledger</li>
    <li><strong>POSTED:</strong> Posted to accounting ledger</li>
    <li><strong>LOCKED:</strong> Cannot be edited (final state)</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">CREATE Mode (New Wages):</h4>
  <ol class="list-decimal list-inside space-y-2 ml-2">
    <li>Select month (YYYY-MM format)</li>
    <li>System loads all active, eligible employees</li>
    <li>Enter wage details for each employee (Gross Salary, Wage Days)</li>
    <li>Deductions auto-calculate based on percentages</li>
    <li>Set common payment details (date, cheque no, payment mode, bank account)</li>
    <li>Select employees to process (checkboxes)</li>
    <li>Submit wages in batches (max 5 per request)</li>
    <li>Progress modal shows real-time status</li>
    <li>Wages auto-post to ledger</li>
  </ol>

  <h4 class="font-semibold text-gray-900 mt-4">MANAGE Mode (Edit Existing):</h4>
  <ol class="list-decimal list-inside space-y-2 ml-2">
    <li>Select month to view existing wages</li>
    <li>Edit individual wage records inline</li>
    <li>Bulk edit multiple records at once</li>
    <li>Change payment status</li>
    <li>Delete wages (if not locked)</li>
    <li>Changes saved immediately</li>
  </ol>

  <h4 class="font-semibold text-gray-900 mt-4">REPORT Mode (Analysis & Export):</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>View all wages for selected month</li>
    <li>Filter by payment mode (Cash, Cheque, NEFT, RTGS, IMPS, UPI)</li>
    <li>Filter by cheque number</li>
    <li>Export Bank Report (CSV for bank processing)</li>
    <li>Export EPF/ESIC Report (statutory compliance)</li>
    <li>Export Wage Slips (individual payslips)</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Payment Modes:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>CASH:</strong> Direct cash payment</li>
    <li><strong>CHEQUE:</strong> Payment via cheque (requires cheque number and bank account)</li>
    <li><strong>NEFT:</strong> National Electronic Funds Transfer (requires bank account)</li>
    <li><strong>RTGS:</strong> Real Time Gross Settlement (requires bank account)</li>
    <li><strong>IMPS:</strong> Immediate Payment Service (requires bank account)</li>
    <li><strong>UPI:</strong> Unified Payments Interface (requires bank account)</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Validations:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>Wage Days: Must be 1-31</li>
    <li>Gross Salary: Must be > 0</li>
    <li>Advance Deduction: Cannot exceed outstanding balance</li>
    <li>Payment Fields: Cheque requires cheque number, bank transfers require bank account</li>
    <li>Employee Eligibility: Must be active and within employment dates</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Batch Processing:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>Maximum 5 wages per request (Vercel timeout safety)</li>
    <li>Client splits large batches automatically</li>
    <li>Each wage validated before posting</li>
    <li>Failed records reported with error messages</li>
    <li>Partial success supported (some succeed, some fail)</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Session Management:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>Wage data auto-saved to browser storage</li>
    <li>Work preserved if you navigate away</li>
    <li>Resume where you left off</li>
    <li>Clear session to start fresh</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Ledger Integration:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>All wages posted to accounting ledger</li>
    <li>Voucher group created for each wage</li>
    <li>Ledger entries deleted if wage is deleted</li>
    <li>Ledger entries recalculated if wage is updated</li>
  </ul>
</div>
`;
