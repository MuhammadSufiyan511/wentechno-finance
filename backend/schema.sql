-- =============================================
-- COMPANY FINANCIAL TRACKER - DATABASE SCHEMA
-- =============================================

CREATE DATABASE IF NOT EXISTS company_finance;
USE company_finance;

-- ============ CORE TABLES ============

CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role ENUM('CEO') DEFAULT 'CEO',
    avatar_url VARCHAR(255),
    last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE business_units (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6',
    icon VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE revenues (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_unit_id INT NOT NULL,
    category VARCHAR(100) NOT NULL,
    sub_category VARCHAR(100),
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    reference_number VARCHAR(50),
    payment_method ENUM('cash','bank_transfer','card','online','cheque') DEFAULT 'cash',
    payment_status ENUM('paid','pending','partial','overdue') DEFAULT 'paid',
    approval_status ENUM('pending', 'approved', 'rejected', 'na') DEFAULT 'na',
    date DATE NOT NULL,
    bank_account_id INT,
    tax_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE CASCADE
);

CREATE TABLE expenses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_unit_id INT NOT NULL,
    category VARCHAR(100) NOT NULL,
    sub_category VARCHAR(100),
    expense_type ENUM('fixed','variable','one-time') DEFAULT 'variable',
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    vendor VARCHAR(100),
    receipt_number VARCHAR(50),
    payment_method ENUM('cash','bank_transfer','card','online','cheque') DEFAULT 'cash',
    approval_status ENUM('pending', 'approved', 'rejected', 'na') DEFAULT 'na',
    date DATE NOT NULL,
    bank_account_id INT,
    tax_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE CASCADE
);

CREATE TABLE transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_unit_id INT NOT NULL,
    type ENUM('income','expense') NOT NULL,
    category VARCHAR(100),
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    reference_id INT,
    reference_type VARCHAR(50),
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE CASCADE
);

-- ============ PANEL 1: ECOM / POS / WEBSITE ============

CREATE TABLE clients (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    company VARCHAR(100),
    address TEXT,
    total_billed DECIMAL(15,2) DEFAULT 0,
    total_paid DECIMAL(15,2) DEFAULT 0,
    status ENUM('active','inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE projects (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT,
    name VARCHAR(200) NOT NULL,
    type ENUM('website','ecommerce','pos','saas','mobile_app','custom') NOT NULL,
    description TEXT,
    total_amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    development_cost DECIMAL(15,2) DEFAULT 0,
    marketing_cost DECIMAL(15,2) DEFAULT 0,
    status ENUM('inquiry','active','in_progress','completed','cancelled') DEFAULT 'inquiry',
    quote_id INT,
    current_milestone VARCHAR(100),
    start_date DATE,
    end_date DATE,
    assigned_to VARCHAR(100),
    commission_rate DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE TABLE invoices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    project_id INT,
    client_id INT,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    amount DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    status ENUM('draft','sent','paid','pending','overdue','cancelled') DEFAULT 'draft',
    approval_status ENUM('pending', 'approved', 'rejected', 'na') DEFAULT 'na',
    due_date DATE,
    paid_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE TABLE subscriptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_unit_id INT NOT NULL,
    client_id INT,
    school_id INT,
    plan_name VARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    billing_cycle ENUM('monthly','quarterly','semi_annual','yearly') DEFAULT 'monthly',
    start_date DATE NOT NULL,
    end_date DATE,
    next_billing_date DATE,
    status ENUM('active','expired','cancelled','paused') DEFAULT 'active',
    mrr DECIMAL(15,2) DEFAULT 0,
    arr DECIMAL(15,2) DEFAULT 0,
    renewal_date DATE,
    auto_renew BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- ============ PANEL 2: URBANFIT ============

CREATE TABLE urbanfit_orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20),
    order_type ENUM('stitching','alteration','ready_made','fabric_sale') NOT NULL,
    items_description TEXT,
    measurements TEXT,
    total_amount DECIMAL(15,2) NOT NULL,
    advance_paid DECIMAL(15,2) DEFAULT 0,
    remaining_amount DECIMAL(15,2) GENERATED ALWAYS AS (total_amount - advance_paid) STORED,
    fabric_cost DECIMAL(15,2) DEFAULT 0,
    stitching_cost DECIMAL(15,2) DEFAULT 0,
    status ENUM('pending','cutting','stitching','finishing','ready','delivered','cancelled') DEFAULT 'pending',
    order_date DATE NOT NULL,
    delivery_date DATE,
    delivered_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE quotes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT,
    quote_number VARCHAR(50) NOT NULL UNIQUE,
    subject VARCHAR(200),
    total_amount DECIMAL(15,2) NOT NULL,
    status ENUM('draft','sent','accepted','declined','expired') DEFAULT 'draft',
    valid_until DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE TABLE project_milestones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    project_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    amount DECIMAL(15,2) NOT NULL,
    due_date DATE,
    status ENUM('pending','completed','invoiced') DEFAULT 'pending',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE urbanfit_returns (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    reason TEXT,
    amount DECIMAL(15,2) NOT NULL,
    status ENUM('pending','approved','refunded') DEFAULT 'pending',
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES urbanfit_orders(id) ON DELETE CASCADE
);

CREATE TABLE fee_challans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    challan_number VARCHAR(50) NOT NULL UNIQUE,
    due_date DATE NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    status ENUM('unpaid','paid','partial','overdue') DEFAULT 'unpaid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES school_students(id) ON DELETE CASCADE
);

CREATE TABLE course_attendance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    batch_id INT NOT NULL,
    student_id INT, -- If linked to student table potentially
    student_name VARCHAR(100), -- Fallback or IT course student
    date DATE NOT NULL,
    status ENUM('present','absent','late') NOT NULL,
    notes TEXT,
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
);

CREATE TABLE instructor_payouts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    trainer_id INT NOT NULL,
    batch_id INT,
    amount DECIMAL(15,2) NOT NULL,
    payout_date DATE,
    status ENUM('pending','approved','paid') DEFAULT 'pending',
    notes TEXT,
    FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE
);

CREATE TABLE vendors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    category VARCHAR(100),
    status ENUM('active','inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE purchase_orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    vendor_id INT NOT NULL,
    business_unit_id INT NOT NULL,
    po_number VARCHAR(50) NOT NULL UNIQUE,
    total_amount DECIMAL(15,2) NOT NULL,
    status ENUM('draft','sent','received','partial','cancelled') DEFAULT 'draft',
    order_date DATE NOT NULL,
    delivery_date DATE,
    notes TEXT,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
    FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE CASCADE
);

CREATE TABLE urbanfit_daily_sales (
    id INT PRIMARY KEY AUTO_INCREMENT,
    date DATE NOT NULL UNIQUE,
    total_sales DECIMAL(15,2) DEFAULT 0,
    cash_sales DECIMAL(15,2) DEFAULT 0,
    card_sales DECIMAL(15,2) DEFAULT 0,
    online_sales DECIMAL(15,2) DEFAULT 0,
    items_sold INT DEFAULT 0,
    returns_amount DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============ PANEL 3: SCHOOL SaaS ============

CREATE TABLE saas_schools (
    id INT PRIMARY KEY AUTO_INCREMENT,
    school_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    plan ENUM('basic','standard','premium','enterprise') DEFAULT 'basic',
    monthly_fee DECIMAL(15,2) NOT NULL,
    students_count INT DEFAULT 0,
    status ENUM('active','inactive','churned','trial') DEFAULT 'trial',
    join_date DATE NOT NULL,
    churn_date DATE,
    churn_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============ PANEL 4: PHYSICAL SCHOOL ============

CREATE TABLE school_students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id_number VARCHAR(20) UNIQUE,
    name VARCHAR(100) NOT NULL,
    class VARCHAR(20) NOT NULL,
    section VARCHAR(10),
    parent_name VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    monthly_fee DECIMAL(15,2) NOT NULL,
    admission_fee DECIMAL(15,2) DEFAULT 0,
    status ENUM('active','inactive','graduated','transferred') DEFAULT 'active',
    admission_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE fee_collections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    fee_type ENUM('monthly','admission','exam','transport','other') DEFAULT 'monthly',
    month VARCHAR(20) NOT NULL,
    year INT NOT NULL,
    status ENUM('paid','pending','partial','waived') DEFAULT 'pending',
    paid_amount DECIMAL(15,2) DEFAULT 0,
    payment_method ENUM('cash','bank_transfer','card','online') DEFAULT 'cash',
    paid_date DATE,
    receipt_number VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES school_students(id) ON DELETE CASCADE
);

-- ============ PANEL 5: IT COURSES ============

CREATE TABLE courses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(20) UNIQUE,
    duration VARCHAR(50),
    duration_hours INT,
    fee DECIMAL(15,2) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    certificate_cost DECIMAL(15,2) DEFAULT 0,
    status ENUM('active','inactive','upcoming') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE trainers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    specialization VARCHAR(200),
    salary DECIMAL(15,2),
    per_batch_fee DECIMAL(15,2),
    payment_type ENUM('salary','per_batch','per_hour') DEFAULT 'salary',
    status ENUM('active','inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE batches (
    id INT PRIMARY KEY AUTO_INCREMENT,
    course_id INT NOT NULL,
    trainer_id INT,
    batch_name VARCHAR(100) NOT NULL,
    batch_code VARCHAR(20) UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE,
    timing VARCHAR(50),
    max_students INT DEFAULT 30,
    current_students INT DEFAULT 0,
    status ENUM('upcoming','active','completed','cancelled') DEFAULT 'upcoming',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL
);

CREATE TABLE enrollments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    batch_id INT NOT NULL,
    student_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    total_fee DECIMAL(15,2) NOT NULL,
    fee_paid DECIMAL(15,2) DEFAULT 0,
    fee_pending DECIMAL(15,2) GENERATED ALWAYS AS (total_fee - fee_paid) STORED,
    discount DECIMAL(15,2) DEFAULT 0,
    status ENUM('active','completed','dropped','refunded') DEFAULT 'active',
    refund_amount DECIMAL(15,2) DEFAULT 0,
    enrollment_date DATE NOT NULL,
    completion_date DATE,
    certificate_issued BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
);

-- ============ SALARIES (ALL UNITS) ============

CREATE TABLE salaries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_unit_id INT NOT NULL,
    employee_name VARCHAR(100) NOT NULL,
    designation VARCHAR(100),
    department VARCHAR(100),
    base_salary DECIMAL(15,2) NOT NULL,
    bonus DECIMAL(15,2) DEFAULT 0,
    deductions DECIMAL(15,2) DEFAULT 0,
    net_salary DECIMAL(15,2) GENERATED ALWAYS AS (base_salary + bonus - deductions) STORED,
    month VARCHAR(20) NOT NULL,
    year INT NOT NULL,
    status ENUM('paid','pending','partial') DEFAULT 'pending',
    paid_date DATE,
    payment_method ENUM('bank_transfer','cash','cheque') DEFAULT 'bank_transfer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE CASCADE
);

-- ============ SYSTEM TABLES ============

CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action ENUM('create', 'update', 'delete', 'login', 'logout', 'other') NOT NULL,
    module VARCHAR(50) NOT NULL,
    entity_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE period_closes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    year INT NOT NULL,
    month INT NOT NULL,
    status ENUM('open', 'closed') DEFAULT 'closed',
    closed_by INT,
    closed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE KEY (year, month),
    FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE approvals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    entity_type ENUM('revenue', 'expense', 'invoice') NOT NULL,
    entity_id INT NOT NULL,
    requested_by INT,
    action_by INT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (action_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
    title VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(255),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE bank_accounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_unit_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    account_number VARCHAR(50),
    bank_name VARCHAR(100),
    balance DECIMAL(15,2) DEFAULT 0,
    type ENUM('bank', 'cash', 'mobile_wallet') DEFAULT 'bank',
    currency VARCHAR(3) DEFAULT 'PKR',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE CASCADE
);

CREATE TABLE budgets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_unit_id INT NOT NULL,
    category VARCHAR(100) NOT NULL,
    planned_amount DECIMAL(15,2) NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY (business_unit_id, category, month, year),
    FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE CASCADE
);

CREATE TABLE tax_configs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_unit_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    rate DECIMAL(5,2) NOT NULL,
    type ENUM('sales', 'withholding', 'income', 'vat') DEFAULT 'sales',
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE CASCADE
);

CREATE TABLE scenarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE scenario_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    scenario_id INT NOT NULL,
    type ENUM('revenue', 'expense') NOT NULL,
    category VARCHAR(100),
    amount DECIMAL(15,2) NOT NULL,
    projected_date DATE,
    FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
);

CREATE TABLE reconciliations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    bank_account_id INT NOT NULL,
    statement_date DATE NOT NULL,
    statement_balance DECIMAL(15,2) NOT NULL,
    system_balance DECIMAL(15,2) NOT NULL,
    status ENUM('pending', 'completed') DEFAULT 'pending',
    reconciled_by INT,
    reconciled_at TIMESTAMP,
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (reconciled_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============ INDEXES ============

CREATE INDEX idx_revenues_date ON revenues(date);
CREATE INDEX idx_revenues_bu ON revenues(business_unit_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_bu ON expenses(business_unit_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_bu ON transactions(business_unit_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_fee_collections_status ON fee_collections(status);
CREATE INDEX idx_enrollments_status ON enrollments(status);
CREATE INDEX idx_salaries_month_year ON salaries(month, year);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_module_entity ON audit_logs(module, entity_id);


-- ============ VIEWS ============

CREATE OR REPLACE VIEW v_monthly_revenue AS
SELECT 
    business_unit_id,
    bu.name as business_name,
    YEAR(r.date) as year,
    MONTH(r.date) as month,
    SUM(r.amount) as total_revenue
FROM revenues r
JOIN business_units bu ON r.business_unit_id = bu.id
GROUP BY business_unit_id, bu.name, YEAR(r.date), MONTH(r.date);

CREATE OR REPLACE VIEW v_monthly_expenses AS
SELECT 
    business_unit_id,
    bu.name as business_name,
    YEAR(e.date) as year,
    MONTH(e.date) as month,
    SUM(e.amount) as total_expenses
FROM expenses e
JOIN business_units bu ON e.business_unit_id = bu.id
GROUP BY business_unit_id, bu.name, YEAR(e.date), MONTH(e.date);

CREATE OR REPLACE VIEW v_profit_loss AS
SELECT 
    COALESCE(r.business_unit_id, e.business_unit_id) as business_unit_id,
    COALESCE(r.year, e.year) as year,
    COALESCE(r.month, e.month) as month,
    COALESCE(r.total_revenue, 0) as revenue,
    COALESCE(e.total_expenses, 0) as expenses,
    COALESCE(r.total_revenue, 0) - COALESCE(e.total_expenses, 0) as profit
FROM v_monthly_revenue r
LEFT JOIN v_monthly_expenses e 
    ON r.business_unit_id = e.business_unit_id 
    AND r.year = e.year 
    AND r.month = e.month
UNION
SELECT 
    e.business_unit_id,
    e.year,
    e.month,
    0 as revenue,
    e.total_expenses as expenses,
    -e.total_expenses as profit
FROM v_monthly_expenses e
LEFT JOIN v_monthly_revenue r 
    ON e.business_unit_id = r.business_unit_id 
    AND e.year = r.year 
    AND e.month = r.month
WHERE r.business_unit_id IS NULL;