export const content = `
<h3 class="text-lg font-bold text-gray-900 mb-4">Data Quality Checks</h3>
<div class="space-y-4 text-gray-700">
  <p>Ensure employee data integrity with automated validation checks. The system identifies missing and invalid data, helping you maintain compliance and data accuracy.</p>
  
  <h4 class="font-semibold text-gray-900 mt-4">Validation Rules:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>Phone:</strong> Exactly 10 digits (detects fake patterns like 1111111111)</li>
    <li><strong>PAN:</strong> Format AAAAA0000A (5 letters, 4 digits, 1 letter)</li>
    <li><strong>Aadhar:</strong> Exactly 12 digits</li>
    <li><strong>UAN:</strong> Exactly 12 digits</li>
    <li><strong>ESIC:</strong> Exactly 10 digits</li>
    <li><strong>Account Number:</strong> 9-18 digits</li>
    <li><strong>IFSC:</strong> Exactly 11 characters (AAAA0AAAAAA format)</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Running Quality Checks:</h4>
  <ol class="list-decimal list-inside space-y-2 ml-2">
    <li>Go to Master Roll Dashboard</li>
    <li>Click <strong>Data Quality</strong> button</li>
    <li>System scans all employee records</li>
    <li>View two tabs: Missing Data and Invalid Data</li>
    <li>See summary statistics and affected employee count</li>
  </ol>

  <h4 class="font-semibold text-gray-900 mt-4">Missing Data Check:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>Identifies employees missing: Phone, PAN, Aadhar, UAN, Project, Site</li>
    <li>Shows which fields are missing for each employee</li>
    <li>Counts total missing fields per employee</li>
    <li>Click employee name to edit and fill missing data</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Invalid Data Check:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>Validates format of all statutory IDs</li>
    <li>Detects fake/pattern phone numbers</li>
    <li>Shows invalid value and expected format</li>
    <li>Identifies which field has the issue</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Quality Report Export:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>Excel file with 4 worksheets:</li>
    <li>1. Quality Summary: Overall statistics</li>
    <li>2. Missing Data: Employees with missing fields</li>
    <li>3. Format Issues: Employees with invalid data</li>
    <li>4. Detailed breakdown by project/site</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Report Features:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>Color-coded tabs (Orange for missing, Red for invalid)</li>
    <li>Summary statistics with color-coded counts</li>
    <li>Employee name, project, site for each issue</li>
    <li>Detailed field names and values</li>
    <li>Professional formatting with borders</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Best Practices:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>Run data quality checks before payroll processing</li>
    <li>Ensure all statutory IDs (Aadhar, PAN, UAN) are captured</li>
    <li>Verify bank account details for accuracy</li>
    <li>Maintain 100% data quality for compliance</li>
  </ul>
</div>
`;
