create table vehicle_passport.user_profile (
    id                     uuid primary key,
    email                  text,
    display_name           text,
    phone                  text,
    created_at             timestamptz not null,
    deletion_scheduled_for timestamptz,
    constraint user_profile_phone_format check (phone is null or phone ~ '^\+[1-9]\d{6,14}$')
);

create index user_profile_deletion_due on vehicle_passport.user_profile (deletion_scheduled_for)
    where deletion_scheduled_for is not null;

create table vehicle_passport.user_settings (
    user_id                   uuid primary key,
    language                  text       not null,
    appearance                text       not null,
    distance_unit             text       not null,
    currency                  text       not null,
    notif_document_deadlines  boolean    not null,
    notif_reminder_days       smallint[] not null,
    notif_scans               boolean    not null,
    notif_passport_views      boolean    not null,
    notif_transfers           boolean    not null,
    notif_product_news        boolean    not null default false,
    constraint user_settings_language check (language in ('system', 'ro', 'en')),
    constraint user_settings_appearance check (appearance in ('system', 'dark', 'light')),
    constraint user_settings_distance_unit check (distance_unit in ('km', 'mi')),
    constraint user_settings_currency check (currency in ('RON', 'EUR', 'USD')),
    constraint user_settings_reminder_days check (notif_reminder_days <@ array[30, 7, 1]::smallint[])
);

create table vehicle_passport.legal_document (
    type           text    not null,
    locale         text    not null,
    version        text    not null,
    title          text    not null,
    body_markdown  text    not null,
    effective_date date    not null,
    is_current     boolean not null,
    primary key (type, locale, version),
    constraint legal_document_type check (type in ('terms', 'privacy', 'data-sharing')),
    constraint legal_document_locale check (locale in ('ro', 'en'))
);

create unique index legal_document_one_current on vehicle_passport.legal_document (type, locale)
    where is_current;

-- Append-only: rows are never updated or deleted by the application.
create table vehicle_passport.consent_record (
    id           uuid primary key,
    user_id      uuid,
    subject_hash text,
    type         text        not null,
    version      text,
    granted      boolean     not null,
    source       text        not null,
    created_at   timestamptz not null,
    constraint consent_record_type check (type in ('terms', 'privacy', 'marketing', 'analytics')),
    constraint consent_record_source check (source in ('sign-up-form', 'social-sign-up', 're-consent', 'settings')),
    constraint consent_record_subject check (user_id is not null or subject_hash is not null)
);

create index consent_record_user on vehicle_passport.consent_record (user_id, created_at desc);

create table vehicle_passport.support_report (
    id          uuid primary key,
    user_id     uuid,
    kind        text        not null,
    message     text        not null,
    diagnostics jsonb,
    created_at  timestamptz not null,
    constraint support_report_kind check (kind in ('problem', 'question'))
);
