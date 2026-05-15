# GST Compliance System (GSTR-1 & GSTR-3B)

## Overview
A comprehensive, enterprise-grade GST reporting system designed for Indian businesses. Compliant with FY 2025-26 regulations, including "hard-locking" logic and automated data aggregation.

## Components

### 1. Data Aggregation Engine
Located in `server/controllers/mongo/gst/`, this engine processes raw transaction data from `Bill` and `StockReg` models.
- `gstr1DataAggregator.js`: Handles detailed outward supply tables (4A, 4B, 5, 6, 7, 12, 13).
- `gstr3bDataAggregator.js`: Handles summary return tables (3.1, 4, 5).

### 2. Unified Dashboard
A single-page application (SPA) module at `client/pages/gst/gst-returns.js` providing a tabbed interface.
- **GSTR-1 Tab**: Detailed drill-down into sales, exports, and HSN summaries.
- **GSTR-3B Tab**: High-level summary of tax liability and eligible ITC.

## GSTR-3B Table Mapping (FY 2025-26)

### Table 3.1: Outward Supplies & RCM
- **3.1(a)**: Regular `SALES` (Taxable).
- **3.1(b)**: `EXPORT`, `SEZ`, `DEEMED_EXPORT`.
- **3.1(c)**: `SALES` marked as Exempt/Nil-rated.
- **3.1(d)**: `PURCHASE` with `reverse_charge: true`.
- **3.1(e)**: Non-GST supplies.

### Table 4: Eligible ITC
- **Import of Goods**: `PURCHASE` with `bill_subtype: 'IMPORT'`.
- **Inward RCM**: `PURCHASE` with `reverse_charge: true`.
- **All Other ITC**: Standard `PURCHASE` from registered dealers.
- **Reversals**: Derived from `DEBIT_NOTE` (Purchase Returns).

## Key Features
- **Multi-GSTIN Support**: Filter reports by specific firm registration.
- **Live Validation**: Checks for GSTIN format, HSN codes, and state code consistency.
- **Enterprise UI**: Clean, responsive design using Tailwind CSS with professional data tables.
- **Export Ready**: Support for JSON and Excel formats for statutory filing.

## File Structure
```
server/
  controllers/mongo/gst/
    gstr1DataAggregator.js
    gstr3bDataAggregator.js
    gstr1Controller.js
    gstr3bController.js
  routes/mongo/gst/
    gstr1.routes.js
    gstr3b.routes.js

client/
  pages/gst/
    gst-returns.js        # Main Dashboard
    gstr3b.js             # 3B Management Logic
```
