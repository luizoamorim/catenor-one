-- Catenor One [REF-IMPL] hackathon Part B audit vocabulary (scoped capability → authorized asset action).
ALTER TYPE "catenor_private"."AuditEventType" ADD VALUE 'CAPABILITY_GRANTED';
ALTER TYPE "catenor_private"."AuditEventType" ADD VALUE 'ASSET_ACTION_AUTHORIZED';
ALTER TYPE "catenor_private"."AuditEventType" ADD VALUE 'ASSET_ACTION_DENIED';
ALTER TYPE "catenor_private"."AuditEventType" ADD VALUE 'ASSET_ACTION_EXECUTED';
