-- The hash and size of the stored scan file, carried into the SCAN_SOURCE attachment on confirm.
-- Null for jobs submitted before hashing existed.
alter table vehicle_passport.scan_job
    add column sha256     char(64),
    add column size_bytes bigint;
