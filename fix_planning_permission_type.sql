-- Migration to fix has_planning_permission type
-- The UI uses this as a text field for "Latest planning permission application details"
-- but the DB was set to BOOLEAN.

ALTER TABLE properties 
ALTER COLUMN has_planning_permission TYPE TEXT 
USING (CASE WHEN has_planning_permission THEN 'Yes' ELSE 'No' END);

-- If it was empty or null, it stays NULL after migration, which is fine for TEXT.
-- Actually, the USING clause above converts existing booleans to 'Yes'/'No'.
-- If the table is currently empty, it's even simpler.

NOTIFY pgrst, 'reload schema';
