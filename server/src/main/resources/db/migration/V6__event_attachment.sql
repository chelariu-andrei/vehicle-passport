create table vehicle_passport.event_attachment (
    id           uuid primary key,
    event_id     uuid         not null references vehicle_passport.vehicle_event (id),
    vin          varchar(17)  not null references vehicle_passport.vehicle (vin),
    sha256       char(64),
    content_type varchar(100) not null,
    size_bytes   bigint       not null,
    storage_key  text         not null,
    kind         varchar(20)  not null,
    created_by   uuid         not null,
    created_at   timestamptz  not null,
    deleted_at   timestamptz
);

create index event_attachment_event
    on vehicle_passport.event_attachment (event_id);

-- Scan sources and legacy rows (sha256 null) are exempt.
create unique index event_attachment_upload_hash
    on vehicle_passport.event_attachment (vin, sha256)
    where kind = 'UPLOAD' and deleted_at is null;

-- Legacy documents become scan sources; their hash, type and size are unknown.
insert into vehicle_passport.event_attachment
    (id, event_id, vin, sha256, content_type, size_bytes, storage_key, kind, created_by, created_at)
select gen_random_uuid(), e.id, e.vin, null, 'application/octet-stream', 0, e.document_key, 'SCAN_SOURCE',
       e.created_by, e.created_at
from vehicle_passport.vehicle_event e
where e.document_key is not null
  and not exists (select 1 from vehicle_passport.event_attachment a
                  where a.event_id = e.id and a.kind = 'SCAN_SOURCE' and a.storage_key = e.document_key);
