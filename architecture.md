## React + Angular + Firebase Integration Architecture (Updated for Companies House + Dividends)

### 1. Firebase Backend
- **Firestore (NoSQL DB)**
  - `invoices` collection (shared between Angular & React)
  - `expenses` collection (React app)
  - `companies` collection (both apps reference company info)
  - `filings` collection (CT600, Annual Accounts, CS01 reminders & metadata)
  - `dividends` collection (declarations, vouchers, board minutes)
- **Firebase Storage**
  - Stores invoices, receipts, annual accounts, confirmation statements, dividend vouchers, board minutes
- **Firebase Authentication**
  - Shared login (email/password, OAuth)
  - Access control by company ID or role

### 2. Angular Invoice App
- Reads/writes to:
  - `invoices`
  - `companies`
- Uploads invoice PDFs to Firebase Storage
- Existing logic unchanged
- Realtime updates propagate to React app

### 3. React New Ltd Company App
- Reads/writes:
  - `invoices` (from Angular)
  - `expenses`
  - `filings` (CT600, Annual Accounts, CS01)
  - `dividends` (new feature)
- Features:
  - Realtime Firestore sync
  - PDF / iXBRL-ready generation for:
    - CT600 (HMRC)
    - Annual Accounts (Companies House)
    - Confirmation Statement (CS01)
  - Receipt/document upload handling
  - Dashboard: finances, deadlines, tax estimates

### 3.5 Dividend Management (New)
- **Firestore `dividends` collection**
  - Dividend declarations
  - Board minutes metadata
  - Dividend vouchers per shareholder
  - Payment status (planned / paid)
- **React app features**
  - Create dividend declarations
  - Auto-generate:
    - Board Minutes PDF
    - Dividend Voucher PDF
  - Upload to Firebase Storage
  - Tag dividends to financial year
  - Include dividend totals in CT600 preparation

### 4. Optional Enhancements
- Cloud Functions for:
  - Profit & corporation tax auto-calculation
  - Auto-generate reports when a financial year closes
  - Email reminders for deadlines
- PWA support for mobile usability
- Role-based access support

### 5. Data Flow Example
1. Angular app creates invoice → Firestore updates → React app dashboard syncs
2. React app adds expense → totals update → Cloud Function recalculates tax
3. React app generates CT600, Accounts, CS01 PDFs → user downloads and files manually
4. React app records dividend → generates board minutes + voucher → saves to Storage → included in tax calculations
