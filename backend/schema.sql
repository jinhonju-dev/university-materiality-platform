-- University Materiality Platform formal schema for Supabase PostgreSQL / PostgreSQL.
-- Invitation codes are stored as hashes only. Full plaintext codes are returned once when generated.

create table if not exists stakeholder_groups (
  id serial primary key,
  code varchar(40) not null unique,
  name varchar(80) not null unique,
  scope varchar(20) not null default 'internal',
  description varchar(255),
  weight double precision not null default 1.0,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists users (
  id serial primary key,
  email varchar(255) not null unique,
  name varchar(80) not null,
  password_hash varchar(255) not null,
  role varchar(20) not null default 'respondent',
  stakeholder_group_id integer references stakeholder_groups(id),
  is_active boolean not null default true,
  last_login_at timestamptz,
  failed_login_count integer not null default 0,
  locked_until timestamptz,
  force_password_change boolean not null default false,
  created_by_user_id integer references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists topics (
  id serial primary key,
  code varchar(20) not null unique,
  topic_code varchar(20) not null unique,
  category varchar(20) not null,
  name_zh varchar(100) not null,
  name_en varchar(120) not null,
  description text,
  scenario_description text,
  gri_mapping varchar(255),
  sdgs_mapping varchar(255),
  responsible_unit varchar(120),
  management_approach text,
  kpi text,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists survey_campaigns (
  id serial primary key,
  title varchar(160) not null,
  name varchar(160) not null,
  year integer not null,
  survey_type varchar(40) not null check (survey_type in ('concern', 'expert_materiality')),
  status varchar(20) not null default 'draft',
  starts_at timestamptz,
  start_date timestamptz,
  ends_at timestamptz,
  end_date timestamptz,
  is_open boolean not null default false,
  is_active boolean not null default true,
  impact_threshold double precision not null default 3.5,
  financial_threshold double precision not null default 3.5,
  materiality_threshold double precision not null default 3.5,
  allow_public_response boolean not null default true,
  require_invitation_code boolean not null default false,
  description text,
  privacy_notice text,
  created_at timestamptz not null default now()
);

create table if not exists invitation_codes (
  id serial primary key,
  campaign_id integer not null references survey_campaigns(id),
  code_hash varchar(64) not null,
  code_prefix varchar(16) not null,
  stakeholder_group_id integer not null references stakeholder_groups(id),
  evaluator_role varchar(80),
  label varchar(120),
  survey_type varchar(30) not null default 'expert_materiality',
  expires_at timestamptz,
  max_uses integer not null default 1,
  used_count integer not null default 0,
  used_at timestamptz,
  revoked_at timestamptz,
  is_active boolean not null default true,
  created_by_user_id integer references users(id),
  created_at timestamptz not null default now(),
  constraint uq_campaign_invitation_code_hash unique (campaign_id, code_hash),
  constraint ck_invitation_max_uses check (max_uses >= 1),
  constraint ck_invitation_used_count check (used_count >= 0)
);

create table if not exists concern_responses (
  id serial primary key,
  campaign_id integer not null references survey_campaigns(id),
  stakeholder_group_id integer not null references stakeholder_groups(id),
  open_answer text,
  submitted_at timestamptz not null default now()
);

create table if not exists concern_topic_scores (
  id serial primary key,
  response_id integer not null references concern_responses(id) on delete cascade,
  topic_id integer not null references topics(id),
  concern_score integer not null check (concern_score between 1 and 5),
  constraint uq_concern_response_topic unique (response_id, topic_id)
);

create table if not exists expert_assessment_responses (
  id serial primary key,
  campaign_id integer not null references survey_campaigns(id),
  invitation_code_id integer not null references invitation_codes(id),
  stakeholder_group_id integer not null references stakeholder_groups(id),
  open_answer text,
  submitted_at timestamptz not null default now(),
  constraint uq_expert_campaign_invitation unique (campaign_id, invitation_code_id)
);

create table if not exists expert_topic_scores (
  id serial primary key,
  response_id integer not null references expert_assessment_responses(id) on delete cascade,
  topic_id integer not null references topics(id),
  positive_likelihood_score integer check (positive_likelihood_score between 1 and 5),
  positive_impact_magnitude_score integer check (positive_impact_magnitude_score between 1 and 5),
  negative_likelihood_score integer check (negative_likelihood_score between 1 and 5),
  negative_impact_magnitude_score integer check (negative_impact_magnitude_score between 1 and 5),
  enrollment_revenue_score integer check (enrollment_revenue_score between 1 and 5),
  legal_responsibility_score integer check (legal_responsibility_score between 1 and 5),
  impact_likelihood_score integer check (impact_likelihood_score between 1 and 5),
  positive_impact_score integer check (positive_impact_score between 1 and 5),
  negative_impact_score integer check (negative_impact_score between 1 and 5),
  admissions_revenue_score integer check (admissions_revenue_score between 1 and 5),
  reputation_score integer check (reputation_score between 1 and 5),
  operating_cost_score integer check (operating_cost_score between 1 and 5),
  funding_score integer check (funding_score between 1 and 5),
  legal_liability_score integer check (legal_liability_score between 1 and 5),
  financial_likelihood_score integer check (financial_likelihood_score between 1 and 5),
  impact_score double precision not null default 0,
  financial_score double precision not null default 0,
  constraint uq_expert_response_topic unique (response_id, topic_id)
);

create table if not exists survey_drafts (
  id serial primary key,
  campaign_id integer not null references survey_campaigns(id),
  respondent_id integer references users(id),
  invitation_code_id integer references invitation_codes(id),
  payload_json text not null,
  updated_at timestamptz not null default now(),
  constraint uq_draft_campaign_respondent unique (campaign_id, respondent_id),
  constraint uq_draft_campaign_invitation unique (campaign_id, invitation_code_id)
);

-- Legacy matrix response tables are retained for backward compatibility with the first-stage dashboard.
create table if not exists survey_responses (
  id serial primary key,
  campaign_id integer not null references survey_campaigns(id),
  respondent_id integer references users(id),
  invitation_code_id integer references invitation_codes(id),
  stakeholder_group_id integer not null references stakeholder_groups(id),
  open_answer text,
  submitted_at timestamptz not null default now(),
  constraint uq_campaign_respondent unique (campaign_id, respondent_id),
  constraint uq_campaign_invitation unique (campaign_id, invitation_code_id)
);

create table if not exists topic_scores (
  id serial primary key,
  response_id integer not null references survey_responses(id) on delete cascade,
  topic_id integer not null references topics(id),
  organization_score integer not null check (organization_score between 1 and 5),
  actual_or_potential varchar(20) not null default 'actual',
  positive_or_negative varchar(20) not null default 'negative',
  scale_score integer check (scale_score between 1 and 5),
  scope_score integer check (scope_score between 1 and 5),
  remediability_score integer check (remediability_score between 1 and 5),
  impact_likelihood_score integer check (impact_likelihood_score between 1 and 5),
  impact_score double precision not null,
  risk_or_opportunity varchar(20) not null default 'risk',
  time_horizon varchar(20) not null default 'medium',
  financial_magnitude_score integer check (financial_magnitude_score between 1 and 5),
  operational_resilience_score integer check (operational_resilience_score between 1 and 5),
  financial_likelihood_score integer check (financial_likelihood_score between 1 and 5),
  financial_score double precision not null,
  constraint uq_response_topic unique (response_id, topic_id)
);

create table if not exists audit_logs (
  id serial primary key,
  actor_user_id integer references users(id),
  action varchar(80) not null,
  resource_type varchar(80) not null,
  resource_id varchar(80),
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists material_topic_overrides (
  id serial primary key,
  campaign_id integer not null references survey_campaigns(id),
  topic_id integer not null references topics(id),
  is_material boolean not null,
  reason text not null,
  created_by_user_id integer references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_material_override_campaign_topic unique (campaign_id, topic_id)
);

create table if not exists ai_analysis_versions (
  id serial primary key,
  campaign_id integer not null references survey_campaigns(id),
  version integer not null,
  model varchar(80) not null,
  prompt_version varchar(40) not null default 'gri-v1',
  input_hash varchar(64) not null,
  content_json text not null,
  is_active boolean not null default true,
  created_by_user_id integer references users(id),
  created_at timestamptz not null default now(),
  constraint uq_ai_analysis_campaign_version unique (campaign_id, version)
);

create index if not exists ix_users_email on users(email);
create index if not exists ix_stakeholder_groups_code on stakeholder_groups(code);
create index if not exists ix_topics_code on topics(code);
create index if not exists ix_topics_topic_code on topics(topic_code);
create index if not exists ix_topics_category on topics(category);
create index if not exists ix_campaigns_type_status on survey_campaigns(survey_type, status, is_active);
create index if not exists ix_invitation_codes_hash on invitation_codes(code_hash);
create index if not exists ix_invitation_codes_prefix on invitation_codes(code_prefix);
create index if not exists ix_concern_responses_campaign on concern_responses(campaign_id);
create index if not exists ix_expert_assessment_responses_campaign on expert_assessment_responses(campaign_id);
create index if not exists ix_audit_logs_action on audit_logs(action);
create index if not exists ix_material_topic_overrides_campaign on material_topic_overrides(campaign_id);
create index if not exists ix_ai_analysis_versions_campaign on ai_analysis_versions(campaign_id);
