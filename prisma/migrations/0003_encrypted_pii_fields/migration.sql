-- Add encrypted PII columns to users table
ALTER TABLE "users" ADD COLUMN "encrypted_aadhaar" TEXT;
ALTER TABLE "users" ADD COLUMN "encrypted_pan" TEXT;
ALTER TABLE "users" ADD COLUMN "encrypted_salary" TEXT;
