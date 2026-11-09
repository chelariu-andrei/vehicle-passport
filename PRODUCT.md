# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Stack

Expo + expo-router (React Native). 3D via three.js / react-three-fiber (user's request). Backend: Quarkus REST API described by `contracts/openapi.yaml`.

## Users

Primary: a car owner keeping the verified history of their vehicle: registering cars in a garage, logging service events, scanning service invoices, and handing a frozen passport to a buyer when selling. Secondary (not first-class in v1 mobile): a buyer or service shop reading a shared passport.

## Product Purpose

Vehicle history belongs to the machine (VIN), not the user. The app lets an owner build a trustworthy history (manually or by scanning invoices) and share a frozen, verifiable passport. Success: a buyer can trust the car's real state because every entry carries an evidence level.

## Positioning

History attached to the VIN with explicit evidence levels (ESTIMATED < USER_CONFIRMED < DOCUMENTED < VERIFIED) and an immutable, revocable, hash-backed passport that never exposes owner data.

## Operating Context

Phone, mostly one-handed, often in a garage, parking lot or workshop while holding an invoice. Flows: garage list, vehicle detail, timeline, add/edit event, scan invoice (single or batch up to 20) then confirm/reject extracted values, create/revoke passport, share via link/QR/PDF, ownership claims.

## Capabilities and Constraints

Backend v1 exposes 26 operations across vehicles, claims, events, timeline, scans, passports and public passports (see `contracts/openapi.yaml`). Auth is a Supabase JWT bearer token. Errors are `application/problem+json`, except 401 with an empty body. A scanned value must never be saved as DOCUMENTED without explicit user confirmation. Only the active owner can edit, scan or create passports. 3D/360 and car photo media are backend non-goals in v1; the app renders a generic 3D car model (user decision), tinted to the vehicle. User-captured 360 photos are undecided, a later spec. Scanning is photos only, one per invoice. V1 targets internal testing, not public stores.

## Brand Commitments

User-stated, binding: strong black and green, premium and friendly, a car app.

## Evidence on Hand

`contracts/openapi.yaml`, `docs/superpowers/specs/2026-11-08-backend-design.md`. No logo, brand assets, photography, testimonials or user data exist; none may be fabricated.

## Product Principles

1. Trust is visible: evidence level is shown wherever a fact is shown.
2. Confirmation is deliberate: scanned data is reviewed, never silently accepted.
3. The car is the hero; paperwork is made effortless.
4. Privacy by default: passports never reveal the owner.

## Accessibility & Inclusion

No product-specific standard established; assume WCAG AA contrast and platform accessibility (Dynamic Type, screen readers, 44/48pt targets).
