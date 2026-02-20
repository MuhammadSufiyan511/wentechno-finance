# Company Revenue & Financial Tracker (Mini ERP)

Full-stack system with:
- Frontend: React + Tailwind
- Backend: Node.js + Express + JWT
- Database: MySQL (simple setup)

## Folder Structure

```text
.
|-- src/
|   |-- components/
|   |-- constants/
|   |-- pages/
|   |-- services/
|   |-- App.jsx
|-- server/
|   |-- src/
|   |   |-- config/
|   |   |-- controllers/
|   |   |-- middleware/
|   |   |-- routes/
|   |   |-- utils/
|   |   |-- index.js
|   |-- .env.example
|-- database/
|   |-- schema.sql
|   |-- seed.sql
```

## Setup (MySQL)

1. Install packages:
```bash
npm install
```

2. Run SQL in MySQL:
```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

3. Backend env:
```bash
cp server/.env.example server/.env
```

4. Run app:
```bash
npm run dev:full
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:4000`

## Login
- Email: `ceo@wentechno.com`
- Password: `123456`

## Key API Endpoints

- `POST /api/auth/login`
- `GET /api/dashboard/overview?period=monthly`
- `GET /api/dashboard/trends`
- `GET /api/dashboard/unit-breakdown`
- `GET /api/panels/:panelKey`
- `GET /api/transactions?panel=ecom_pos`
- `GET /api/reports/export/pdf?month=2&year=2026`
- `GET /api/reports/export/excel?month=2&year=2026`

## Financial Logic

Implemented in `server/src/utils/financial.js`:
- Gross Revenue = sum(revenue)
- Total Expenses = sum(expense)
- Net Profit = Gross Revenue - Total Expenses
- Profit Margin % = (Net Profit / Gross Revenue) * 100
- Cash Flow = Net Profit (simple operating view)
- Monthly Growth % = ((Current Revenue - Previous Revenue) / Previous Revenue) * 100

## Notes
- Export endpoints currently return structured export payloads; plug in PDF/Excel file stream logic as next step.
- Designed as scalable mini ERP with business-unit-level and global CEO-level analytics.
