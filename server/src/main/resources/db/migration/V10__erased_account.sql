-- Subjects whose account was purged. Their access tokens stay valid for up to an hour after the purge; the API
-- refuses them instead of provisioning a new profile. Holds the bare subject id only, no personal data.
create table vehicle_passport.erased_account (
    id        uuid primary key,
    erased_at timestamptz not null
);
