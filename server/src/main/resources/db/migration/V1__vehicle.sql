create schema if not exists vehicle_passport;

create table vehicle_passport.vehicle (
    vin    varchar(17) primary key,
    make   varchar(100) not null,
    model  varchar(100) not null,
    engine varchar(100),
    year   integer      not null,
    fuel   varchar(20)  not null
);

create table vehicle_passport.ownership_period (
    id         uuid primary key,
    vin        varchar(17) not null references vehicle_passport.vehicle (vin),
    owner_id   uuid        not null,
    owned_from timestamptz not null,
    owned_to   timestamptz
);

create unique index ownership_period_one_open_per_vin
    on vehicle_passport.ownership_period (vin) where owned_to is null;
create index ownership_period_open_by_owner
    on vehicle_passport.ownership_period (owner_id) where owned_to is null;

create table vehicle_passport.ownership_claim (
    id          uuid primary key,
    vin         varchar(17) not null references vehicle_passport.vehicle (vin),
    claimant_id uuid        not null,
    status      varchar(20) not null,
    filed_at    timestamptz not null,
    decided_at  timestamptz
);

create unique index ownership_claim_one_pending_per_claimant
    on vehicle_passport.ownership_claim (vin, claimant_id) where status = 'PENDING';
create index ownership_claim_pending_by_vin
    on vehicle_passport.ownership_claim (vin) where status = 'PENDING';
