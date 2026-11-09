create table vehicle_passport.scan_job (
    id                    uuid primary key,
    batch_id              uuid         not null,
    vin                   varchar(17)  not null references vehicle_passport.vehicle (vin),
    owner_id              uuid         not null,
    period_id             uuid         not null references vehicle_passport.ownership_period (id),
    document_key          text         not null,
    content_type          varchar(100) not null,
    status                varchar(20)  not null,
    attempts              integer      not null default 0,
    processing_started_at timestamptz,
    result                jsonb,
    warnings              jsonb        not null default '[]'::jsonb,
    failure_reason        text,
    created_at            timestamptz  not null
);

create index scan_job_pending
    on vehicle_passport.scan_job (created_at) where status = 'PENDING';

create index scan_job_processing
    on vehicle_passport.scan_job (processing_started_at) where status = 'PROCESSING';
