-- New Supabase projects no longer expose public tables to the Data API by
-- default. Signed-in users get table access; row level security still limits
-- every row to the companies they belong to. Anonymous visitors get nothing.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

-- Members can see the other members of their company (for a team screen later).
drop policy if exists self_read on company_members;
create policy member_read on company_members for select using (is_member(company_id));
