-- Extended timeline (spec 2026-11-16 §7). Existing details keep no `kind`: the mapper reads a missing kind as SCAN.
alter table vehicle_passport.vehicle_event
    alter column odometer_km drop not null,
    add column custom_label  varchar(60),
    add column valid_from    date,
    add column valid_until   date,
    add column components    text[] not null default '{}',
    add column custom_fields jsonb  not null default '[]';
create index vehicle_event_components on vehicle_passport.vehicle_event using gin (components);
