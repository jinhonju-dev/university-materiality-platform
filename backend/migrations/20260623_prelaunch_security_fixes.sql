-- High-priority prelaunch security fixes.
-- Apply to PostgreSQL production databases before switching traffic.
--
-- Invitation code note:
-- If an older database still has invitation_codes.code with plaintext values,
-- do not keep or migrate those plaintext codes. Revoke those rows and generate
-- new invitation codes so only code_hash/code_prefix are retained.

begin;

alter table invitation_codes add column if not exists code_hash varchar(64);
alter table invitation_codes add column if not exists code_prefix varchar(16);
alter table invitation_codes add column if not exists max_uses integer not null default 1;
alter table invitation_codes add column if not exists used_count integer not null default 0;
alter table invitation_codes add column if not exists used_at timestamptz;
alter table invitation_codes add column if not exists expires_at timestamptz;
alter table invitation_codes add column if not exists revoked_at timestamptz;

-- Plaintext invitation codes cannot be safely converted without the application
-- SECRET_KEY used for HMAC hashing. Force administrators to revoke/regenerate.
update invitation_codes
set is_active = false,
    revoked_at = coalesce(revoked_at, now()),
    code_hash = coalesce(code_hash, md5('revoked-invitation-' || id::text || '-' || now()::text)),
    code_prefix = coalesce(code_prefix, 'REVOKED')
where code_hash is null;

update invitation_codes
set code_prefix = 'REDACTED'
where code_prefix is null;

alter table invitation_codes alter column code_hash set not null;
alter table invitation_codes alter column code_prefix set not null;

alter table invitation_codes drop column if exists code;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'uq_campaign_invitation_code_hash'
  ) then
    alter table invitation_codes
      add constraint uq_campaign_invitation_code_hash unique (campaign_id, code_hash);
  end if;
end $$;

create index if not exists ix_invitation_codes_hash on invitation_codes(code_hash);
create index if not exists ix_invitation_codes_prefix on invitation_codes(code_prefix);

alter table topic_scores alter column scale_score drop not null;
alter table topic_scores alter column scope_score drop not null;
alter table topic_scores alter column impact_likelihood_score drop not null;
alter table topic_scores alter column financial_magnitude_score drop not null;
alter table topic_scores alter column operational_resilience_score drop not null;
alter table topic_scores alter column financial_likelihood_score drop not null;

commit;
