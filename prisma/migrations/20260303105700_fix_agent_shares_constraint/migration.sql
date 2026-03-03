-- Fix agent_shares constraint to allow multiple revoked shares
-- Drop the old unique constraint that prevents re-sharing/re-revoking
DROP INDEX IF EXISTS "agent_shares_agent_id_shared_with_user_id_status_key";

-- Create a partial unique index that only enforces uniqueness for ACTIVE shares
-- This allows multiple revoked shares for the same agent/user pair
CREATE UNIQUE INDEX "agent_shares_active_unique" 
ON "agent_shares"("agent_id", "shared_with_user_id") 
WHERE "status" = 'active';
