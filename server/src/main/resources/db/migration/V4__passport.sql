-- snapshot_json is text, not jsonb: jsonb rewrites key order and whitespace, which would break hash verification.
create table vehicle_passport.passport (
    id            uuid primary key,
    vin           varchar(17)  not null references vehicle_passport.vehicle (vin),
    created_by    uuid         not null,
    created_at    timestamptz  not null,
    snapshot_json text         not null,
    hash          varchar(64)  not null,
    token         varchar(100) not null,
    expires_at    timestamptz,
    revoked_at    timestamptz,
    pdf_key       text         not null,
    constraint passport_token_unique unique (token)
);

create index passport_created_by on vehicle_passport.passport (created_by, created_at desc);
