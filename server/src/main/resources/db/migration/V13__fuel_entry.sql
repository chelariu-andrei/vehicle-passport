-- Fuel entries (fuel & cost spec §4): private working data of the owner, one row per fill-up or charge.
create table vehicle_passport.fuel_entry (
    id               uuid primary key,
    vin              varchar(17)    not null references vehicle_passport.vehicle (vin),
    period_id        uuid           not null references vehicle_passport.ownership_period (id),
    created_by       uuid           not null,
    entry_date       date           not null,
    odometer_km      integer        not null check (odometer_km >= 0),
    fuel_type        varchar(20)    not null,           -- PETROL | DIESEL | LPG | ELECTRIC
    quantity         numeric(9, 3)  not null check (quantity > 0),   -- litres, or kWh for ELECTRIC
    total            numeric(12, 2) not null check (total >= 0),
    unit_price       numeric(10, 4) not null,           -- derived, stored for the price series
    currency         varchar(3)     not null,
    grade            varchar(10),                       -- STANDARD | PREMIUM, not for ELECTRIC
    charge_type      varchar(10),                       -- HOME | AC_PUBLIC | DC_FAST, only ELECTRIC
    station          varchar(60),
    note             varchar(200),
    full_tank        boolean        not null default true,
    missed_previous  boolean        not null default false,
    created_at       timestamptz    not null,
    updated_at       timestamptz    not null,
    deleted_at       timestamptz
);

create index fuel_entry_by_vin_date
    on vehicle_passport.fuel_entry (vin, period_id, entry_date, odometer_km, id) where deleted_at is null;
