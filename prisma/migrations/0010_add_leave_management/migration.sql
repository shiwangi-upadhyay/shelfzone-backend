-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('CASUAL', 'SICK', 'EARNED', 'MATERNITY', 'PATERNITY', 'COMPENSATORY', 'UNPAID', 'BEREAVEMENT');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "leave_policies" (
    "id" TEXT NOT NULL,
    "leave_type" "LeaveType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "total_days_per_year" INTEGER NOT NULL,
    "max_consecutive_days" INTEGER NOT NULL,
    "can_carry_forward" BOOLEAN NOT NULL DEFAULT false,
    "max_carry_forward_days" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type" "LeaveType" NOT NULL,
    "year" INTEGER NOT NULL,
    "total_entitled" DOUBLE PRECISION NOT NULL,
    "used" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carried_forward" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remaining" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type" "LeaveType" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "total_days" DOUBLE PRECISION NOT NULL,
    "is_half_day" BOOLEAN NOT NULL DEFAULT false,
    "half_day_type" TEXT,
    "reason" TEXT NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leave_policies_leave_type_key" ON "leave_policies"("leave_type");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employee_id_leave_type_year_key" ON "leave_balances"("employee_id", "leave_type", "year");

-- CreateIndex (performance)
CREATE INDEX "leave_balances_employee_id_leave_type_year_idx" ON "leave_balances"("employee_id", "leave_type", "year");
CREATE INDEX "leave_requests_employee_id_status_idx" ON "leave_requests"("employee_id", "status");
CREATE INDEX "leave_requests_start_date_end_date_idx" ON "leave_requests"("start_date", "end_date");

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
