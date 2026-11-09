create table vehicle_passport.vehicle_event (
    id           uuid primary key,
    vin          varchar(17)   not null references vehicle_passport.vehicle (vin),
    type         varchar(20)   not null,
    event_date   date          not null,
    odometer_km  integer       not null,
    cost_amount  numeric(12, 2) not null,
    currency     varchar(3)    not null,
    notes        text,
    details      jsonb,
    evidence     varchar(20)   not null,
    source       varchar(20)   not null,
    created_by   uuid          not null,
    period_id    uuid          not null references vehicle_passport.ownership_period (id),
    document_key text,
    created_at   timestamptz   not null,
    deleted_at   timestamptz
);

create index vehicle_event_timeline
    on vehicle_passport.vehicle_event (vin, event_date, created_at, id);
