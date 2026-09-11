-- TASKS T3.5 / PLAN §25.3 (D16): catenor_private."AuditEvent" is append-only.
-- INSERT stays allowed; UPDATE, DELETE and TRUNCATE are rejected (TRUNCATE bypasses row-level triggers,
-- so it gets its own statement-level trigger). Raw SQL, reviewed with the maintainer on 2026-09-11.

CREATE FUNCTION "catenor_private"."reject_audit_event_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'catenor_private.AuditEvent is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER "AuditEvent_append_only"
  BEFORE UPDATE OR DELETE ON "catenor_private"."AuditEvent"
  FOR EACH ROW
  EXECUTE FUNCTION "catenor_private"."reject_audit_event_change"();

CREATE TRIGGER "AuditEvent_no_truncate"
  BEFORE TRUNCATE ON "catenor_private"."AuditEvent"
  FOR EACH STATEMENT
  EXECUTE FUNCTION "catenor_private"."reject_audit_event_change"();
