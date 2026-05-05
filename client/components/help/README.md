# Help Modal System

## Structure

The help modal system is organized into modular, manageable files:

```
client/components/help/
├── HelpModal.js              # Main modal class and initialization
├── content/
│   ├── masterRoll.js         # Master Roll documentation
│   ├── wages.js              # Wages management documentation
│   ├── advances.js           # Advances management documentation
│   ├── dataQuality.js        # Data quality checks documentation
│   ├── authentication.js      # Authentication & authorization documentation
│   └── shortcuts.js          # Keyboard shortcuts and tips
└── README.md                 # This file
```

## Features

### Master Roll (masterRoll.js)
- Employee fields (Personal, Statutory, Employment, Financial, Dates)
- CRUD operations (Create, Read, Update, Delete)
- Bulk operations (Import, Create, Update, Delete, Export)
- Search & filtering capabilities
- Statistics (Total, Active, Exited, Projects, Sites)
- Special features (IFSC Lookup, Activity Log, Appointment Letters, I-Cards, Data Quality Reports)
- Export formats (Excel, CSV, JSON, PDF, DOCX)

### Wages (wages.js)
- 9 wage components (Gross, Wage Days, Per Day Wage, EPF, ESIC, Other Deduction, Other Benefit, Advance Deduction, Net Salary)
- 3 wage statuses (DRAFT, POSTED, LOCKED)
- 3 modes (CREATE, MANAGE, REPORT)
- 6 payment modes (CASH, CHEQUE, NEFT, RTGS, IMPS, UPI)
- Batch processing (max 5 per request)
- Session management
- Ledger integration
- Advance deduction validation

### Advances (advances.js)
- 2 advance types (ADVANCE, REPAYMENT)
- 3 advance statuses (PENDING, POSTED, COMPLETED)
- Recording advances (Balance, History, Create, Delete)
- 3 payment modes (CASH, BANK_TRANSFER, WAGE_DEDUCTION)
- Validations and ledger integration
- Bulk operations

### Data Quality (dataQuality.js)
- 7 validation rules (Phone, PAN, Aadhar, UAN, ESIC, Account, IFSC)
- Missing data detection
- Invalid data detection
- Quality report export (4 worksheets)
- Color-coded reporting

### Shortcuts (shortcuts.js)
- Keyboard shortcuts (? to open, Esc to close)
- Tips for using help
- Data entry best practices
- Wage processing best practices
- Compliance & security guidelines
- Performance tips

### Authentication & Authorization (authentication.js)
- 4 user roles (super_admin, admin, manager, user)
- Dual-token authentication (Access + Refresh tokens)
- Auto-token refresh mechanism
- Security features (Password hashing, Rate limiting, Account lockout, IP tracking, Device management)
- Login/logout process
- Session management
- Token refresh flow
- Account lockout protection
- Firm-level access control
- API authentication
- Login audit trail
- Device management
- Best practices and troubleshooting

## Usage

The help modal is initialized globally in `client/app.js`:

```javascript
import { initGlobalHelpModal } from './components/help/HelpModal.js';

// Initialize on app startup
initGlobalHelpModal();
```

Users can access help by:
- Pressing `?` from any page
- Pressing `Esc` to close
- Clicking outside the modal to close

## Adding New Help Topics

To add a new help topic:

1. Create a new file in `client/components/help/content/` (e.g., `newTopic.js`)
2. Export content as HTML string:
   ```javascript
   export const content = `<h3>Topic Title</h3><div>...</div>`;
   ```
3. Import in `HelpModal.js` and add to `helpFiles` object
4. The topic will automatically appear in the left panel

## Modular Design Benefits

- **Maintainability**: Each topic is in its own file
- **Scalability**: Easy to add new topics
- **Performance**: Content loaded on demand
- **Organization**: Clear folder structure
- **Reusability**: Content can be exported separately if needed
