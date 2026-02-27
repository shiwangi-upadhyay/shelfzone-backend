-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND');

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "check_in" TIMESTAMP(3) NOT NULL,
    "check_out" TIMESTAMP(3),
    "check_in_note" TEXT,
    "check_out_note" TEXT,
    "status" "AttendanceStatus" NOT NULL,
    "hours_worked" DOUBLE PRECISION,
    "overtime_hours" DOUBLE PRECISION,
    "is_regularized" BOOLEAN NOT NULL DEFAULT false,
    "regularized_by" TEXT,
    "regularized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_summaries" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "total_present" INTEGER NOT NULL DEFAULT 0,
    "total_absent" INTEGER NOT NULL DEFAULT 0,
    "total_half_days" INTEGER NOT NULL DEFAULT 0,
    "total_late" INTEGER NOT NULL DEFAULT 0,
    "total_leaves" INTEGER NOT NULL DEFAULT 0,
    "total_holidays" INTEGER NOT NULL DEFAULT 0,
    "total_hours_worked" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_overtime_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (unique: one record per employee per day)
CREATE UNIQUE INDEX "attendance_records_employee_id_date_key" ON "attendance_records"("employee_id", "date");

-- CreateIndex (daily reports)
CREATE INDEX "attendance_records_date_idx" ON "attendance_records"("date");

-- CreateIndex (unique: one summary per employee per month)
CREATE UNIQUE INDEX "attendance_summaries_employee_id_month_year_key" ON "attendance_summaries"("employee_id", "month", "year");

-- CreateIndex (monthly lookups)
CREATE INDEX "attendance_summaries_employee_id_year_month_idx" ON "attendance_summaries"("employee_id", "year", "month");

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_regularized_by_fkey" FOREIGN KEY ("regularized_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_summaries" ADD CONSTRAINT "attendance_summaries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
