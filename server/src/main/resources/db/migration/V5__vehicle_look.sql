-- The owner's number plate (owner-only, cleared on transfer) and the look of the illustrative model.
-- Every column is optional; all look columns null means the car has no look.
alter table vehicle_passport.vehicle
    add column plate         varchar(10),
    add column body_type     varchar(20),
    add column paint_color   varchar(20),
    add column paint_hex     char(7),
    add column paint_finish  varchar(20),
    add column wheel_style   varchar(20),
    add column rim_color     varchar(20),
    add column glass_tint    varchar(20),
    add column contrast_roof boolean,
    add constraint vehicle_plate_format
        check (plate ~ '^[A-Z0-9](?:[A-Z0-9 -]{0,8}[A-Z0-9])?$'),
    add constraint vehicle_body_type_known
        check (body_type in ('HATCHBACK', 'SEDAN', 'ESTATE', 'SUV', 'COUPE', 'MPV', 'PICKUP')),
    add constraint vehicle_paint_color_known
        check (paint_color in ('WHITE', 'BLACK', 'SILVER', 'GREY', 'BLUE', 'RED', 'GREEN', 'BEIGE', 'BROWN',
                               'YELLOW', 'ORANGE', 'GOLD')),
    add constraint vehicle_paint_hex_format
        check (paint_hex ~ '^#[0-9a-f]{6}$'),
    add constraint vehicle_paint_finish_known
        check (paint_finish in ('GLOSS', 'METALLIC', 'SATIN', 'MATTE')),
    add constraint vehicle_wheel_style_known
        check (wheel_style in ('FIVE_SPOKE', 'MULTI_SPOKE', 'AERO')),
    add constraint vehicle_rim_color_known
        check (rim_color in ('SILVER', 'BLACK', 'BODY')),
    add constraint vehicle_glass_tint_known
        check (glass_tint in ('LIGHT', 'DARK'));
