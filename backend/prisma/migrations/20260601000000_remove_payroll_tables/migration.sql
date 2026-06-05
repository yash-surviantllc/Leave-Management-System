-- Remove payroll tables in dependency order

-- Drop payslips table (depends on payroll_items)
DROP TABLE IF EXISTS "payslips";

-- Drop payroll_items table (depends on payrolls and salaries)
DROP TABLE IF EXISTS "payroll_items";

-- Drop payrolls table (depends on users)
DROP TABLE IF EXISTS "payrolls";

-- Drop salaries table (depends on employees)
DROP TABLE IF EXISTS "salaries";

-- Drop PayrollStatus enum
DROP TYPE IF EXISTS "PayrollStatus";
