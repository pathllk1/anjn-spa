export const content = `
<h3 class="text-lg font-bold text-gray-900 mb-4">Keyboard Shortcuts & Tips</h3>
<div class="space-y-4 text-gray-700">
  <h4 class="font-semibold text-gray-900 mt-4">Global Shortcuts:</h4>
  <table class="w-full text-sm border-collapse">
    <thead>
      <tr class="border-b border-gray-300">
        <th class="text-left py-2 font-semibold">Shortcut</th>
        <th class="text-left py-2 font-semibold">Action</th>
      </tr>
    </thead>
    <tbody>
      <tr class="border-b border-gray-200">
        <td class="py-2"><kbd class="bg-gray-100 px-2 py-1 rounded">?</kbd></td>
        <td>Open Help Modal</td>
      </tr>
      <tr class="border-b border-gray-200">
        <td class="py-2"><kbd class="bg-gray-100 px-2 py-1 rounded">Esc</kbd></td>
        <td>Close Help Modal</td>
      </tr>
    </tbody>
  </table>

  <h4 class="font-semibold text-gray-900 mt-4">Tips for Using Help:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>Press <strong>?</strong> from any page to access help</li>
    <li>Press <strong>Esc</strong> to close help modal</li>
    <li>Click outside modal to close</li>
    <li>Select help topics from left panel to read detailed guides</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Data Entry Best Practices:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>Always fill statutory IDs (Aadhar, PAN, UAN)</li>
    <li>Use IFSC lookup for bank details</li>
    <li>Verify phone numbers before saving</li>
    <li>Use consistent project and site names</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Wage Processing Best Practices:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>Run data quality checks before payroll</li>
    <li>Use batch processing for large employee counts</li>
    <li>Export bank reports for payment processing</li>
    <li>Keep wage sessions saved for recovery</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Compliance & Security:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>Maintain 100% data quality</li>
    <li>Export statutory reports monthly</li>
    <li>Keep audit trail for all transactions</li>
    <li>Archive reports for compliance</li>
    <li>Never share employee data exports</li>
    <li>Use secure payment modes for bank transfers</li>
    <li>Keep appointment letters confidential</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Performance Tips:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>Use filters to reduce data load</li>
    <li>Process wages in batches (max 5 per request)</li>
    <li>Export large datasets in chunks</li>
    <li>Clear old sessions periodically</li>
  </ul>
</div>
`;
