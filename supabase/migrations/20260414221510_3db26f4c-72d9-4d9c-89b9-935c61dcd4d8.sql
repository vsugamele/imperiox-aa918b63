
DROP POLICY IF EXISTS "Project owners can view flow executions" ON imphq_flow_executions;

CREATE POLICY "Authenticated users can view flow executions"
ON imphq_flow_executions
FOR SELECT
TO authenticated
USING (true);
