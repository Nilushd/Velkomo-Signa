-- Requests can be deleted (by their submitter or an admin, before any approver acts or after a rejection).
-- The rule is checked in the server; at database level only the server's property-wide scope may delete.
create policy submissions_delete on submissions for delete to signa_app using (property_id = signa_prop() and signa_is_system());
