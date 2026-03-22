# Wage Management System

## Overview
The application includes a wage management system for employee payroll processing and management.

## Actually Implemented Components

### Frontend Pages
- **Wages Dashboard** (`client/pages/WagesDashboard.js`)
  - Centralized wage management interface
  - Tabbed interface for different operations
  - Quick access to wage functions

### Backend Components
- **Wages Controller** (`server/controllers/mongo/wages.controller.js`)
  - Wage calculation and processing logic
  - Overtime calculations
  - Deduction processing
  - Wage payment recording

- **Wages Routes** (`server/routes/wages.routes.js`)
  - `/api/wages` - CRUD operations for wages
  - `/api/wages/calculate` - Wage calculation endpoint
  - `/api/wages/payment` - Payment processing

### Database Models
- **Wage Model** (`server/models/Wage.model.js`)
  - Wage records with calculation parameters
  - Payment history and status

- **UserWage Model** (`server/models/UserWage.model.js`)
  - Many-to-many relationship between users and wages
  - Wage assignment tracking

- **UserMasterRoll Model** (`server/models/UserMasterRoll.model.js`)
  - Employee assignments to master rolls
  - Role and permission management

## Features
- **Automated Calculations**: Automatic wage computation based on hours, rates, and deductions
- **Overtime Management**: Configurable overtime rates and calculations
- **Employee Assignments**: Flexible assignment of wages to employees
- **Payment Tracking**: Record and track wage payments
- **Wage History**: Complete audit trail of wage changes

## API Endpoints
```
GET    /api/wages              - List all wages
POST   /api/wages              - Create new wage record
PUT    /api/wages/:id          - Update wage record
DELETE /api/wages/:id          - Delete wage record
POST   /api/wages/:id/calculate - Calculate wage amount
POST   /api/wages/:id/pay      - Process wage payment
```

## Usage Workflow
1. Access Wages Dashboard from main menu
2. Create wage records using Create mode tab
3. Assign wages to employees
4. Calculate wages automatically or manually
5. Process payments and track payment history
6. Manage existing wages through Manage mode tab

## Integration Points
- **Master Roll System**: Integration with employee master rolls for automatic assignments
- **User Management**: User-employee relationship management
- **Reporting**: Wage reports and analytics integration

## Security Considerations
- Role-based access to wage management
- Audit logging for all wage changes
- Secure payment processing endpoints
