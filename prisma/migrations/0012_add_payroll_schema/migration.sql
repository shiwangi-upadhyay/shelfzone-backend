-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'PROCESSING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayComponent" AS ENUM ('BASIC', 'HRA', 'DA', 'SPECIAL_ALLOWANCE', 'MEDICAL', 'TRANSPORT', 'PF_EMPLOYEE', 'PF_EMPLOYER', 'ESI_EMPLOYEE', 'ESI_EMPLOYER', 'PROFESSIONAL_TAX', 'TDS', 'OTHER_DEDUCTION', 'OTHER_ALLOWANCE');

-- CreateTable
CREATE TABLE "salary_structures" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "basic_salary" TEXT NOT NULL,
    "hra" TEXT,
    "da" TEXT,
    "special_allowance" TEXT,
    "medical_allowance" TEXT,
    "transport_allowance" TEXT,
    "gross_salary" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "total_employees" INTEGER NOT NULL DEFAULT 0,
    "total_gross_pay" TEXT,
    "total_deductions" TEXT,
    "total_net_pay" TEXT,
    "processed_by" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" TEXT NOT NULL,
    "payroll_run_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "basic_pay" TEXT NOT NULL,
    "hra" TEXT,
    "da" TEXT,
    "special_allowance" TEXT,
    "medical_allowance" TEXT,
    "transport_allowance" TEXT,
    "gross_pay" TEXT NOT NULL,
    "pf_employee" TEXT,
    "pf_employer" TEXT,
    "esi_employee" TEXT,
    "esi_employer" TEXT,
    "professional_tax" TEXT,
    "tds" TEXT,
    "other_deductions" TEXT,
    "total_deductions" TEXT NOT NULL,
    "net_pay" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salary_structures_employee_id_key" ON "salary_structures"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_month_year_key" ON "payroll_runs"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_payroll_run_id_employee_id_key" ON "payslips"("payroll_run_id", "employee_id");

-- CreateIndex
CREATE INDEX "payslips_employee_id_year_month_idx" ON "payslips"("employee_id", "year", "month");

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
