-- Tire-season reminders (deadlines spec §7): on by default, existing rows included.
alter table vehicle_passport.user_settings add column notif_tire_season boolean not null default true;
