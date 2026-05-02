# GSTR1 Implementation Plan

## Overview
GSTR1 (Goods and Services Tax Return - Outward Supplies) is filed by GST-registered suppliers to report all outward supplies (sales) made during a tax period.

## GSTR1 Structure & Tables

### 1. **B2B Supplies (Table 4A)**
- Supplies to registered businesses
- Fields: Invoice No, Date, GSTIN of recipient, Invoice value, Taxable value, CGST, SGST, IGST, Cess

### 2. **B2C Supplies (Table 4B)**
- Supplies to unregistered consumers
- Aggregated by state and HSN
- Fields: State, HSN, Taxable value, CGST, SGST, IGST, Cess

### 3. **Exports (Table 6)**
- Supplies outside India
- Fields: Invoice No, Date, Country, Invoice value, Taxable value, Cess

### 4. **Amendments (Table 9)**
- Amendments to previously filed returns
- Credit notes, debit notes, corrections

### 5. **Exempted Supplies (Table 5)**
- Supplies with nil or exempted GST rate
- Fields: Invoice No, Date, Invoice value

### 6. **HSN Summary (Table 5A)**
- Aggregated by HSN code
- Fields: HSN, Description, Qty, UOM, Taxable value, CGST, SGST, IGST

## Data Requirements from Current System

### From Bill Model:
- `bno` - Invoice number
- `bdate` - Invoice date
- `gstin` - Customer GSTIN
- `state_code` - Customer state code
- `ntot` - Net taxable value
- `cgst`, `sgst`, `igst` - Tax amounts
- `firm_gstin` - Supplier GSTIN (for multi-GST)
- `status` - Bill status (ACTIVE/CANCELLED)
- `ref_bill_id` - For credit/debit notes

### From StockReg Model:
- `item` - Item description
- `hsn` - HSN code
- `qty` - Quantity
- `uom` - Unit of measure
- `total` - Line value

### From Party Model:
- `gstin` - Customer GSTIN
- `state_code` - Customer state
- `gstLocations[]` - Multi-location support

## Implementation Phases

### Phase 1: Data Collection & Validation
- Create GSTR1 data aggregation engine
- Validate bill data against GSTR1 requirements
- Handle multi-GST scenarios

### Phase 2: Report Generation
- B2B supplies report
- B2C supplies report
- HSN summary
- Amendments tracking

### Phase 3: Export Formats
- JSON export (for API integration)
- Excel export (multi-sheet format)
- CSV export (for manual filing)

### Phase 4: UI Integration
- New GSTR1 page in inventory dashboard
- Report filters (date range, GSTIN, state)
- Export options

## File Structure

```
server/
  controllers/
    mongo/
      gst/
        gstr1Controller.js          # Main GSTR1 logic
        gstr1DataAggregator.js      # Data collection
        gstr1Validator.js           # Validation rules
        gstr1ExportUtils.js         # Export formats
  routes/
    mongo/
      gst/
        gstr1.routes.js             # GSTR1 API routes

client/
  pages/
    gst/
      gstr1.js                      # GSTR1 page
  components/
    gst/
      gstr1Modal.js                 # Report modal
      gstr1ExportModal.js           # Export options
```

## API Endpoints

```
GET  /api/gst/gstr1/summary          # Get GSTR1 summary
GET  /api/gst/gstr1/b2b              # B2B supplies
GET  /api/gst/gstr1/b2c              # B2C supplies
GET  /api/gst/gstr1/hsn-summary      # HSN aggregation
GET  /api/gst/gstr1/amendments       # Credit/debit notes
GET  /api/gst/gstr1/export/json      # JSON export
GET  /api/gst/gstr1/export/excel     # Excel export
GET  /api/gst/gstr1/export/csv       # CSV export
POST /api/gst/gstr1/validate         # Validate data
```

## Key Features

1. **Multi-GSTIN Support**: Handle firms with multiple GST registrations
2. **Amendment Tracking**: Track credit notes and debit notes
3. **Validation**: Ensure data compliance with GST rules
4. **Export Options**: JSON, Excel, CSV formats
5. **Date Range Filtering**: Monthly/quarterly/annual reports
6. **State-wise Aggregation**: B2C aggregation by state
7. **HSN Aggregation**: Summary by HSN code
8. **Audit Trail**: Track all GSTR1 filings

## Compliance Rules

1. Only ACTIVE bills included (exclude CANCELLED)
2. Exclude reverse charge supplies (if applicable)
3. Separate B2B (registered) from B2C (unregistered)
4. Aggregate B2C by state and HSN
5. Include amendments (credit/debit notes)
6. Validate GSTIN format (15 characters)
7. Validate state codes (2 digits)
8. Ensure HSN codes are present for goods
