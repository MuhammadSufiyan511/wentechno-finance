USE company_finance;

-- Insert CEO user (password: Admin@123)
INSERT INTO users (username, email, password, full_name, role) VALUES 
('ceo', 'ceo@company.com', '$2a$10$Re4kUYPd88oV6.04yccFV.nmg9MZ4N1Ni.B.ftfY6q70Nu4bMyuWe', 'Muhammad Ahmed', 'CEO');

-- Insert Business Units
INSERT INTO business_units (name, code, description, color, icon) VALUES
('Ecom / POS / Website', 'ECOM', 'Web development, POS systems, and SaaS subscriptions', '#3B82F6', 'monitor'),
('UrbanFit Tailors', 'URBANFIT', 'Physical tailor shop and stitching orders', '#10B981', 'scissors'),
('School Management SaaS', 'SCHOOL_SAAS', 'School management software subscriptions', '#8B5CF6', 'cloud'),
('Physical School', 'SCHOOL', 'Physical school fee collection and management', '#F59E0B', 'graduation-cap'),
('IT Courses Training', 'IT_COURSES', 'IT training center and courses', '#EF4444', 'book-open'),
('Office & General', 'OFFICE', 'Office expenses, utilities, and general overhead', '#6B7280', 'building');

-- Sample Revenue Data
INSERT INTO revenues (business_unit_id, category, amount, description, date, payment_status) VALUES
(1, 'Project Revenue', 150000, 'E-commerce website for ABC Corp', '2025-01-15', 'paid'),
(1, 'SaaS Subscription', 25000, 'Monthly hosting subscriptions', '2025-01-01', 'paid'),
(1, 'Project Revenue', 80000, 'POS System for XYZ Store', '2025-01-20', 'pending'),
(1, 'Hosting Renewal', 15000, 'Annual hosting renewals', '2025-02-01', 'paid'),
(1, 'Project Revenue', 200000, 'Custom ERP development', '2025-02-10', 'partial'),
(2, 'Stitching Orders', 45000, 'Daily stitching revenue', '2025-01-15', 'paid'),
(2, 'Ready Made Sales', 35000, 'Ready-made garments', '2025-01-20', 'paid'),
(2, 'Fabric Sales', 20000, 'Fabric retail sales', '2025-02-01', 'paid'),
(2, 'Stitching Orders', 55000, 'Premium stitching orders', '2025-02-15', 'paid'),
(3, 'Subscription', 50000, 'Basic plan - 5 schools', '2025-01-01', 'paid'),
(3, 'Subscription', 75000, 'Premium plan - 3 schools', '2025-01-01', 'paid'),
(3, 'Subscription', 100000, 'Enterprise plan - 2 schools', '2025-02-01', 'paid'),
(4, 'Fee Collection', 500000, 'January monthly fees', '2025-01-10', 'paid'),
(4, 'Fee Collection', 480000, 'February monthly fees', '2025-02-10', 'partial'),
(4, 'Admission Fee', 100000, 'New admissions', '2025-01-05', 'paid'),
(5, 'Course Fee', 120000, 'Web Development batch', '2025-01-10', 'paid'),
(5, 'Course Fee', 90000, 'Python Programming batch', '2025-01-15', 'paid'),
(5, 'Course Fee', 150000, 'Full Stack batch', '2025-02-01', 'paid'),
(5, 'Course Fee', 60000, 'UI/UX Design batch', '2025-02-10', 'pending');

-- Sample Revenue for more months  
INSERT INTO revenues (business_unit_id, category, amount, description, date, payment_status) VALUES
(1, 'Project Revenue', 180000, 'Mobile app development', '2025-03-05', 'paid'),
(1, 'SaaS Subscription', 30000, 'Monthly subscriptions March', '2025-03-01', 'paid'),
(2, 'Stitching Orders', 62000, 'March stitching revenue', '2025-03-15', 'paid'),
(3, 'Subscription', 130000, 'March SaaS subscriptions', '2025-03-01', 'paid'),
(4, 'Fee Collection', 510000, 'March monthly fees', '2025-03-10', 'paid'),
(5, 'Course Fee', 175000, 'March course enrollments', '2025-03-05', 'paid'),
(1, 'Project Revenue', 220000, 'Enterprise portal', '2025-04-10', 'paid'),
(2, 'Stitching Orders', 58000, 'April stitching revenue', '2025-04-15', 'paid'),
(3, 'Subscription', 140000, 'April SaaS subscriptions', '2025-04-01', 'paid'),
(4, 'Fee Collection', 495000, 'April monthly fees', '2025-04-10', 'paid'),
(5, 'Course Fee', 130000, 'April course enrollments', '2025-04-05', 'paid');

-- Sample Expenses
INSERT INTO expenses (business_unit_id, category, expense_type, amount, description, date) VALUES
(1, 'Development', 'variable', 60000, 'Developer salaries', '2025-01-30'),
(1, 'Marketing', 'variable', 25000, 'Facebook & Google Ads', '2025-01-15'),
(1, 'Server Cost', 'fixed', 8000, 'AWS hosting', '2025-01-01'),
(1, 'Software', 'fixed', 5000, 'Development tools', '2025-01-01'),
(2, 'Fabric Cost', 'variable', 25000, 'Raw fabric purchase', '2025-01-10'),
(2, 'Tailor Salaries', 'fixed', 40000, 'Monthly tailor salaries', '2025-01-30'),
(2, 'Shop Rent', 'fixed', 25000, 'Monthly shop rent', '2025-01-01'),
(2, 'Utilities', 'fixed', 8000, 'Electricity & water', '2025-01-15'),
(3, 'Server Cost', 'fixed', 15000, 'Cloud servers', '2025-01-01'),
(3, 'Development', 'variable', 80000, 'Dev team salaries', '2025-01-30'),
(3, 'Support', 'fixed', 30000, 'Support team', '2025-01-30'),
(4, 'Teacher Salaries', 'fixed', 300000, 'Monthly teacher salaries', '2025-01-30'),
(4, 'Utilities', 'fixed', 40000, 'School utilities', '2025-01-15'),
(4, 'Maintenance', 'variable', 15000, 'Building maintenance', '2025-01-20'),
(4, 'Books & Material', 'variable', 25000, 'Study materials', '2025-01-05'),
(5, 'Trainer Salaries', 'fixed', 80000, 'Monthly trainer salaries', '2025-01-30'),
(5, 'Marketing', 'variable', 20000, 'Marketing campaigns', '2025-01-15'),
(5, 'Certificates', 'variable', 5000, 'Certificate printing', '2025-01-25'),
(5, 'Lab Equipment', 'one-time', 50000, 'New computers', '2025-01-10'),
(6, 'Office Rent', 'fixed', 50000, 'Monthly office rent', '2025-01-01'),
(6, 'Internet', 'fixed', 5000, 'Office internet', '2025-01-01'),
(6, 'Electricity', 'fixed', 15000, 'Office electricity', '2025-01-15'),
(6, 'Software Subscriptions', 'fixed', 10000, 'Office software', '2025-01-01'),
(6, 'Salaries', 'fixed', 100000, 'Admin staff salaries', '2025-01-30'),
(6, 'Equipment', 'one-time', 30000, 'Office furniture', '2025-01-10');

-- More expense months
INSERT INTO expenses (business_unit_id, category, expense_type, amount, description, date) VALUES
(1, 'Development', 'variable', 65000, 'February dev salaries', '2025-02-28'),
(1, 'Marketing', 'variable', 30000, 'February marketing', '2025-02-15'),
(2, 'Fabric Cost', 'variable', 28000, 'February fabric', '2025-02-10'),
(2, 'Tailor Salaries', 'fixed', 40000, 'February tailor pay', '2025-02-28'),
(3, 'Server Cost', 'fixed', 15000, 'February servers', '2025-02-01'),
(3, 'Development', 'variable', 80000, 'February dev team', '2025-02-28'),
(4, 'Teacher Salaries', 'fixed', 300000, 'February teacher pay', '2025-02-28'),
(4, 'Utilities', 'fixed', 38000, 'February utilities', '2025-02-15'),
(5, 'Trainer Salaries', 'fixed', 80000, 'February trainer pay', '2025-02-28'),
(6, 'Office Rent', 'fixed', 50000, 'February rent', '2025-02-01'),
(6, 'Salaries', 'fixed', 100000, 'February admin salaries', '2025-02-28'),
(6, 'Electricity', 'fixed', 14000, 'February electricity', '2025-02-15');

-- Sample Clients
INSERT INTO clients (name, email, phone, company, total_billed, total_paid) VALUES
('Ali Hassan', 'ali@abc.com', '0300-1234567', 'ABC Corporation', 150000, 150000),
('Sara Khan', 'sara@xyz.com', '0321-9876543', 'XYZ Solutions', 80000, 40000),
('Ahmed Raza', 'ahmed@tech.com', '0333-5555555', 'Tech Innovations', 200000, 100000),
('Fatima Noor', 'fatima@digital.com', '0345-7777777', 'Digital World', 120000, 120000),
('Usman Ali', 'usman@soft.com', '0312-8888888', 'Soft Solutions', 95000, 95000);

-- Sample Projects
INSERT INTO projects (client_id, name, type, total_amount, paid_amount, development_cost, marketing_cost, status, start_date, end_date, assigned_to, commission_rate) VALUES
(1, 'ABC E-commerce Platform', 'ecommerce', 150000, 150000, 45000, 10000, 'completed', '2025-01-01', '2025-02-15', 'Bilal', 5),
(2, 'XYZ POS System', 'pos', 80000, 40000, 25000, 5000, 'in_progress', '2025-01-15', '2025-03-01', 'Hamza', 5),
(3, 'Custom ERP System', 'custom', 200000, 100000, 80000, 15000, 'active', '2025-02-01', '2025-05-01', 'Bilal', 7),
(4, 'Digital World Website', 'website', 120000, 120000, 30000, 8000, 'completed', '2024-12-01', '2025-01-15', 'Ayesha', 5),
(5, 'Soft Solutions SaaS', 'saas', 95000, 95000, 35000, 12000, 'completed', '2024-11-01', '2025-01-01', 'Hamza', 6);

-- Sample Invoices
INSERT INTO invoices (project_id, client_id, invoice_number, amount, tax_amount, total_amount, status, due_date, paid_date) VALUES
(1, 1, 'INV-2025-001', 150000, 0, 150000, 'paid', '2025-02-15', '2025-02-10'),
(2, 2, 'INV-2025-002', 40000, 0, 40000, 'paid', '2025-02-01', '2025-01-28'),
(2, 2, 'INV-2025-003', 40000, 0, 40000, 'pending', '2025-03-01', NULL),
(3, 3, 'INV-2025-004', 100000, 0, 100000, 'paid', '2025-03-01', '2025-02-25'),
(3, 3, 'INV-2025-005', 100000, 0, 100000, 'pending', '2025-04-01', NULL),
(4, 4, 'INV-2025-006', 120000, 0, 120000, 'paid', '2025-01-15', '2025-01-12'),
(5, 5, 'INV-2025-007', 95000, 0, 95000, 'paid', '2025-01-01', '2024-12-28');

-- Sample UrbanFit Orders
INSERT INTO urbanfit_orders (order_number, customer_name, customer_phone, order_type, items_description, total_amount, advance_paid, fabric_cost, stitching_cost, status, order_date, delivery_date) VALUES
('UF-2025-001', 'Imran Shah', '0300-1111111', 'stitching', '3 Piece Suit', 5500, 3000, 0, 2500, 'delivered', '2025-01-05', '2025-01-12'),
('UF-2025-002', 'Kamran Ali', '0321-2222222', 'stitching', 'Sherwani', 15000, 8000, 0, 7000, 'ready', '2025-01-10', '2025-01-20'),
('UF-2025-003', 'Zain Ahmed', '0333-3333333', 'alteration', 'Pant alteration', 800, 800, 0, 500, 'delivered', '2025-01-15', '2025-01-16'),
('UF-2025-004', 'Fahad Khan', '0345-4444444', 'stitching', '2 Shalwar Kameez', 4000, 2000, 0, 2000, 'stitching', '2025-02-01', '2025-02-10'),
('UF-2025-005', 'Tariq Mehmood', '0312-5555555', 'ready_made', 'Ready-made Kurta', 3500, 3500, 2000, 0, 'delivered', '2025-02-05', '2025-02-05');

-- Sample UrbanFit Daily Sales
INSERT INTO urbanfit_daily_sales (date, total_sales, cash_sales, card_sales, online_sales, items_sold) VALUES
('2025-01-15', 25000, 15000, 7000, 3000, 12),
('2025-01-16', 18000, 10000, 5000, 3000, 8),
('2025-01-17', 32000, 20000, 8000, 4000, 15),
('2025-02-01', 28000, 16000, 8000, 4000, 13),
('2025-02-02', 22000, 12000, 6000, 4000, 10);

-- Sample SaaS Schools
INSERT INTO saas_schools (school_name, contact_person, email, phone, plan, monthly_fee, students_count, status, join_date) VALUES
('City Grammar School', 'Mr. Abdullah', 'city@school.com', '0300-1000001', 'premium', 15000, 500, 'active', '2024-06-01'),
('Al-Noor Academy', 'Ms. Saima', 'alnoor@school.com', '0321-1000002', 'standard', 10000, 300, 'active', '2024-08-01'),
('Green Valley School', 'Mr. Tariq', 'green@school.com', '0333-1000003', 'basic', 5000, 150, 'active', '2024-09-01'),
('Elite Public School', 'Mr. Waseem', 'elite@school.com', '0345-1000004', 'enterprise', 25000, 1200, 'active', '2024-07-01'),
('Sunrise Academy', 'Ms. Hina', 'sunrise@school.com', '0312-1000005', 'premium', 15000, 450, 'active', '2024-10-01'),
('Model High School', 'Mr. Imran', 'model@school.com', '0300-1000006', 'standard', 10000, 350, 'churned', '2024-05-01'),
('Star Kids School', 'Ms. Nadia', 'star@school.com', '0321-1000007', 'basic', 5000, 100, 'active', '2025-01-01');

-- Sample School Students
INSERT INTO school_students (student_id_number, name, class, section, parent_name, phone, monthly_fee, admission_fee, status, admission_date) VALUES
('STD-001', 'Ahmad Khan', '10', 'A', 'Khalid Khan', '0300-2000001', 5000, 10000, 'active', '2024-04-01'),
('STD-002', 'Ayesha Malik', '9', 'B', 'Rashid Malik', '0321-2000002', 5000, 10000, 'active', '2024-04-01'),
('STD-003', 'Hassan Ali', '8', 'A', 'Tariq Ali', '0333-2000003', 4500, 8000, 'active', '2024-04-01'),
('STD-004', 'Fatima Shah', '10', 'A', 'Noman Shah', '0345-2000004', 5000, 10000, 'active', '2024-04-01'),
('STD-005', 'Bilal Ahmed', '7', 'C', 'Sohail Ahmed', '0312-2000005', 4000, 8000, 'active', '2025-01-01');

-- Sample Fee Collections
INSERT INTO fee_collections (student_id, amount, fee_type, month, year, status, paid_amount, paid_date, receipt_number) VALUES
(1, 5000, 'monthly', 'January', 2025, 'paid', 5000, '2025-01-10', 'RCP-001'),
(2, 5000, 'monthly', 'January', 2025, 'paid', 5000, '2025-01-12', 'RCP-002'),
(3, 4500, 'monthly', 'January', 2025, 'paid', 4500, '2025-01-11', 'RCP-003'),
(4, 5000, 'monthly', 'January', 2025, 'pending', 0, NULL, NULL),
(5, 4000, 'monthly', 'January', 2025, 'partial', 2000, '2025-01-15', 'RCP-004'),
(1, 5000, 'monthly', 'February', 2025, 'paid', 5000, '2025-02-08', 'RCP-005'),
(2, 5000, 'monthly', 'February', 2025, 'paid', 5000, '2025-02-10', 'RCP-006'),
(3, 4500, 'monthly', 'February', 2025, 'pending', 0, NULL, NULL);

-- Sample Courses
INSERT INTO courses (name, code, duration, duration_hours, fee, category, certificate_cost, status) VALUES
('Full Stack Web Development', 'FSWD', '3 months', 200, 50000, 'Web Development', 500, 'active'),
('Python Programming', 'PY101', '2 months', 120, 30000, 'Programming', 500, 'active'),
('UI/UX Design', 'UIUX', '2 months', 100, 35000, 'Design', 500, 'active'),
('Mobile App Development', 'MAD', '3 months', 180, 45000, 'Mobile', 500, 'active'),
('Data Science & AI', 'DSAI', '4 months', 250, 60000, 'Data Science', 500, 'active'),
('Graphic Design', 'GD101', '2 months', 80, 25000, 'Design', 300, 'active');

-- Sample Trainers
INSERT INTO trainers (name, email, phone, specialization, salary, payment_type, status) VALUES
('Bilal Hassan', 'bilal@trainer.com', '0300-3000001', 'Web Development', 60000, 'salary', 'active'),
('Sana Fatima', 'sana@trainer.com', '0321-3000002', 'Python, Data Science', 55000, 'salary', 'active'),
('Usman Ghani', 'usman@trainer.com', '0333-3000003', 'UI/UX, Graphic Design', 50000, 'salary', 'active'),
('Ali Raza', 'ali@trainer.com', '0345-3000004', 'Mobile Development', 15000, 'per_batch', 'active');

-- Sample Batches
INSERT INTO batches (course_id, trainer_id, batch_name, batch_code, start_date, end_date, timing, max_students, current_students, status) VALUES
(1, 1, 'FSWD Batch 1', 'FSWD-B1', '2025-01-15', '2025-04-15', '9:00 AM - 12:00 PM', 25, 18, 'active'),
(2, 2, 'Python Batch 1', 'PY-B1', '2025-01-10', '2025-03-10', '2:00 PM - 5:00 PM', 20, 15, 'active'),
(3, 3, 'UIUX Batch 1', 'UIUX-B1', '2025-02-01', '2025-04-01', '10:00 AM - 1:00 PM', 15, 10, 'active'),
(4, 4, 'MAD Batch 1', 'MAD-B1', '2025-02-15', '2025-05-15', '3:00 PM - 6:00 PM', 20, 8, 'upcoming'),
(1, 1, 'FSWD Batch 2', 'FSWD-B2', '2025-03-01', '2025-06-01', '6:00 PM - 9:00 PM', 25, 20, 'active');

-- Sample Enrollments
INSERT INTO enrollments (batch_id, student_name, phone, email, total_fee, fee_paid, discount, status, enrollment_date) VALUES
(1, 'Hamza Ali', '0300-4000001', 'hamza@email.com', 50000, 50000, 0, 'active', '2025-01-10'),
(1, 'Sara Ahmed', '0321-4000002', 'sara@email.com', 50000, 30000, 0, 'active', '2025-01-12'),
(1, 'Zain Malik', '0333-4000003', 'zain@email.com', 45000, 45000, 5000, 'active', '2025-01-14'),
(2, 'Nadia Khan', '0345-4000004', 'nadia@email.com', 30000, 30000, 0, 'active', '2025-01-08'),
(2, 'Faisal Shah', '0312-4000005', 'faisal@email.com', 30000, 15000, 0, 'active', '2025-01-09'),
(3, 'Hira Fatima', '0300-4000006', 'hira@email.com', 35000, 35000, 0, 'active', '2025-01-28'),
(5, 'Omer Raza', '0321-4000007', 'omer@email.com', 50000, 25000, 0, 'active', '2025-02-28'),
(1, 'Ali Abbas', '0333-4000008', 'ali.a@email.com', 50000, 0, 0, 'dropped', '2025-01-15');

-- Sample Salaries
INSERT INTO salaries (business_unit_id, employee_name, designation, department, base_salary, bonus, deductions, month, year, status, paid_date) VALUES
(1, 'Bilal Ahmed', 'Senior Developer', 'Development', 80000, 5000, 2000, 'January', 2025, 'paid', '2025-01-30'),
(1, 'Hamza Ali', 'Junior Developer', 'Development', 45000, 0, 1000, 'January', 2025, 'paid', '2025-01-30'),
(1, 'Ayesha Khan', 'Marketing Manager', 'Marketing', 55000, 3000, 1500, 'January', 2025, 'paid', '2025-01-30'),
(2, 'Aslam Tailor', 'Master Tailor', 'Stitching', 25000, 0, 0, 'January', 2025, 'paid', '2025-01-30'),
(2, 'Rashid Tailor', 'Tailor', 'Stitching', 18000, 0, 0, 'January', 2025, 'paid', '2025-01-30'),
(4, 'Ms. Saima', 'Senior Teacher', 'Teaching', 45000, 0, 1000, 'January', 2025, 'paid', '2025-01-30'),
(4, 'Mr. Tariq', 'Teacher', 'Teaching', 35000, 0, 800, 'January', 2025, 'paid', '2025-01-30'),
(5, 'Bilal Hassan', 'Lead Trainer', 'Training', 60000, 5000, 1500, 'January', 2025, 'paid', '2025-01-30'),
(6, 'Sadia Receptionist', 'Receptionist', 'Admin', 25000, 0, 500, 'January', 2025, 'paid', '2025-01-30'),
(6, 'Kashif Accountant', 'Accountant', 'Finance', 40000, 0, 1000, 'January', 2025, 'paid', '2025-01-30');
