export const content = `
<h3 class="text-lg font-bold text-gray-900 mb-4">Master Roll Management</h3>
<div class="space-y-4 text-gray-700">
  <p>The Master Roll is the central repository for all employee information. Each employee record contains personal details, employment information, bank account details, and statutory identifiers.</p>
  
  <h4 class="font-semibold text-gray-900 mt-4">Employee Fields:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>Personal:</strong> Employee Name, Father/Husband Name, DOB, Phone (10 digits), Address</li>
    <li><strong>Statutory:</strong> Aadhar (12 digits), PAN (AAAAA0000A), UAN (12 digits), ESIC (10 digits), S. Kalyan</li>
    <li><strong>Employment:</strong> Category (Unskilled/Skilled/Semi-Skilled), Project, Site, Designation</li>
    <li><strong>Financial:</strong> Per Day Wage, Bank Name, Account Number (9-18 digits), IFSC (11 chars), Branch</li>
    <li><strong>Dates:</strong> Date of Joining, Date of Exit, Status (Active/Inactive/Left)</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">CRUD Operations:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>Create:</strong> Add single employee with all required fields</li>
    <li><strong>Read:</strong> View all employees, search by name/aadhar/phone/project/site</li>
    <li><strong>Update:</strong> Edit any employee field (partial updates supported)</li>
    <li><strong>Delete:</strong> Remove employee record</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Bulk Operations:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>Bulk Import:</strong> Upload Excel file with multiple employees</li>
    <li><strong>Bulk Create:</strong> Create multiple employees from array</li>
    <li><strong>Bulk Update:</strong> Update multiple employees with different data</li>
    <li><strong>Bulk Delete:</strong> Delete multiple employees by ID</li>
    <li><strong>Export:</strong> Export to Excel/CSV/JSON (all or selected employees)</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Search & Filtering:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>Search by: Employee name, Aadhar, Phone, Project, Site</li>
    <li>Filters: Date range, Status, Category, Project, Site</li>
    <li>Pagination: Limit and offset support</li>
    <li>Sorting: By name, date, status</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Statistics:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>Total Employees: Count of all records</li>
    <li>Active Employees: Count with status = Active</li>
    <li>Exited Employees: Count with date_of_exit set</li>
    <li>Total Projects: Unique project count</li>
    <li>Total Sites: Unique site count</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Special Features:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>IFSC Lookup:</strong> Auto-fill bank details from IFSC code (Razorpay API)</li>
    <li><strong>Activity Log:</strong> Track who created/updated each employee and when</li>
    <li><strong>Appointment Letters:</strong> Generate formal employment letters (DOCX format)</li>
    <li><strong>I-Cards:</strong> Generate ID cards in Excel or PDF format</li>
    <li><strong>I-Card Features:</strong> QR code, photo placeholder, employee details, signature boxes, footer</li>
    <li><strong>Data Quality Report:</strong> Excel export with Missing Data and Invalid Data tabs</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Export Formats:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>Excel:</strong> Formatted with headers, alternating colors, status color-coding, borders, frozen header</li>
    <li><strong>CSV:</strong> Comma-separated values with proper escaping</li>
    <li><strong>JSON:</strong> Raw JSON data</li>
    <li><strong>PDF:</strong> For I-Cards (6 cards per A4 page, 2x3 layout)</li>
    <li><strong>DOCX:</strong> For Appointment Letters</li>
  </ul>
</div>
`;
