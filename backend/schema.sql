-- University Materiality Platform formal schema for Supabase PostgreSQL / PostgreSQL.
-- SQLAlchemy creates the same tables at app startup; this file is provided for managed DB review.

create table if not exists stakeholder_groups (
  id serial primary key,
  name varchar(80) not null unique,
  scope varchar(20) not null,
  description varchar(255),
  weight double precision not null default 1.0,
  is_active boolean not null default true
);

create table if not exists users (
  id serial primary key,
  email varchar(255) not null unique,
  name varchar(80) not null,
  password_hash varchar(255) not null,
  role varchar(20) not null default 'respondent',
  stakeholder_group_id integer not null references stakeholder_groups(id),
  is_active boolean not null default true
);

create table if not exists topics (
  id serial primary key,
  code varchar(20) not null unique,
  category varchar(20) not null,
  name_zh varchar(100) not null,
  name_en varchar(120) not null,
  description text,
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
  year integer not null,
  status varchar(20) not null default 'active',
  starts_at timestamptz,
  ends_at timestamptz,
  is_open boolean not null default true,
  impact_threshold double precision not null default 3.5,
  financial_threshold double precision not null default 3.5,
  created_at timestamptz not null default now()
);

create table if not exists invitation_codes (
  id serial primary key,
  campaign_id integer not null references survey_campaigns(id),
  code varchar(80) not null,
  stakeholder_group_id integer not null references stakeholder_groups(id),
  label varchar(120),
  survey_type varchar(30) not null default 'expert',
  is_active boolean not null default true,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint uq_campaign_invitation_code unique (campaign_id, code)
);

create table if not exists concern_survey_responses (
  id serial primary key,
  campaign_id integer not null references survey_campaigns(id),
  stakeholder_group_id integer not null references stakeholder_groups(id),
  open_answer text,
  submitted_at timestamptz not null default now()
);

create table if not exists concern_survey_scores (
  id serial primary key,
  response_id integer not null references concern_survey_responses(id) on delete cascade,
  topic_id integer not null references topics(id),
  concern_score integer not null,
  constraint uq_concern_response_topic unique (response_id, topic_id),
  constraint ck_concern_score_1_to_5 check (concern_score between 1 and 5)
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

create table if not exists expert_assessment_scores (
  id serial primary key,
  response_id integer not null references expert_assessment_responses(id) on delete cascade,
  topic_id integer not null references topics(id),
  impact_likelihood_score integer,
  positive_impact_score integer,
  negative_impact_score integer,
  admissions_revenue_score integer,
  reputation_score integer,
  operating_cost_score integer,
  funding_score integer,
  legal_liability_score integer,
  financial_likelihood_score integer,
  impact_score double precision not null default 0,
  financial_score double precision not null default 0,
  constraint uq_expert_response_topic unique (response_id, topic_id),
  constraint ck_expert_scores_1_to_5 check (
    coalesce(impact_likelihood_score, 1) between 1 and 5
    and coalesce(positive_impact_score, 1) between 1 and 5
    and coalesce(negative_impact_score, 1) between 1 and 5
    and coalesce(admissions_revenue_score, 1) between 1 and 5
    and coalesce(reputation_score, 1) between 1 and 5
    and coalesce(operating_cost_score, 1) between 1 and 5
    and coalesce(funding_score, 1) between 1 and 5
    and coalesce(legal_liability_score, 1) between 1 and 5
    and coalesce(financial_likelihood_score, 1) between 1 and 5
  )
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
  organization_score integer not null,
  actual_or_potential varchar(20) not null default 'actual',
  positive_or_negative varchar(20) not null default 'negative',
  scale_score integer not null,
  scope_score integer not null,
  remediability_score integer,
  impact_likelihood_score integer not null,
  impact_score double precision not null,
  risk_or_opportunity varchar(20) not null default 'risk',
  time_horizon varchar(20) not null default 'medium',
  financial_magnitude_score integer not null,
  operational_resilience_score integer not null,
  financial_likelihood_score integer not null,
  financial_score double precision not null,
  constraint uq_response_topic unique (response_id, topic_id),
  constraint ck_topic_scores_1_to_5 check (
    organization_score between 1 and 5
    and scale_score between 1 and 5
    and scope_score between 1 and 5
    and coalesce(remediability_score, 1) between 1 and 5
    and impact_likelihood_score between 1 and 5
    and financial_magnitude_score between 1 and 5
    and operational_resilience_score between 1 and 5
    and financial_likelihood_score between 1 and 5
  )
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
create index if not exists ix_topics_code on topics(code);
create index if not exists ix_topics_category on topics(category);
create index if not exists ix_invitation_codes_code on invitation_codes(code);
create index if not exists ix_concern_survey_responses_campaign on concern_survey_responses(campaign_id);
create index if not exists ix_expert_assessment_responses_campaign on expert_assessment_responses(campaign_id);
create index if not exists ix_audit_logs_action on audit_logs(action);
create index if not exists ix_ai_analysis_versions_campaign on ai_analysis_versions(campaign_id);

-- Third-stage management APIs use the existing tables above:
-- topics: create/edit/disable issue library items.
-- survey_campaigns: create/edit/open/close annual questionnaire campaigns.
-- invitation_codes: generate single-use anonymous invitation codes by stakeholder group.
-- ai_analysis_versions: stores versioned AI drafts for summaries, stakeholder difference analysis, management recommendations and GRI 3-1/3-2/3-3 sections.
