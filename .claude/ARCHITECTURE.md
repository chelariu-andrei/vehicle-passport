# Architecture — vehicle-passport

## Monorepo layout

```
contracts/openapi.yaml   # SOURCE OF TRUTH for the HTTP API
backend/vehicle-server/  # Quarkus (Java) REST backend
mobile/                  # Expo + expo-router
infra/                   # deployment / IaC
docs/
```

Contract-first: change `contracts/openapi.yaml` first, then backend and mobile follow it.

## Backend (`../server`)

Quarkus, **feature-first packages**, **hexagonal (ports & adapters)** inside each feature.
Base package: `com.vehiclepassport.server`.

```
src/main/java/com/vehiclepassport/server/
├── <feature>/                     # e.g. vehicle, (later: passport, user, ...)
│   ├── api/                       # INBOUND adapter (REST)
│   │   ├── <Feature>Resource.java #   JAX-RS resources, thin
│   │   ├── dto/                   #   request/response DTOs (match openapi.yaml)
│   │   └── mapper/                #   DTO <-> domain mapping
│   ├── application/               # USE CASES
│   │   ├── port/in/               #   use-case interfaces (called by api)
│   │   ├── port/out/              #   interfaces for what the app needs (repos, clients)
│   │   └── service/               #   use-case implementations, transactions live here
│   ├── domain/                    # PURE business model
│   │   ├── model/                 #   entities, value objects
│   │   ├── event/                 #   domain events
│   │   └── exception/             #   domain exceptions
│   └── infrastructure/            # OUTBOUND adapters
│       ├── persistence/entity/    #   JPA/Panache entities
│       ├── persistence/repository/#   implement port/out
│       └── client/                #   external HTTP/other clients
└── shared/                        # cross-cutting only
    ├── config/  error/  security/  util/
```

Other folders:

- `src/main/resources/db/migration/` — Flyway migrations (`V<n>__<desc>.sql`), the only way the schema changes.
- `src/test/java/` — unit tests (mirror main packages). `src/integration-test/java/` — `@QuarkusTest` / `@QuarkusIntegrationTest`.

### Dependency rule

```
api ──▶ application ──▶ domain ◀── infrastructure
                 ▲                      │
                 └── port/out ◀─────────┘ (implements)
```

- `domain` depends on nothing (no Quarkus, JPA, JAX-RS, Jackson annotations).
- `application` depends on `domain` only (CDI annotations like `@ApplicationScoped`/`@Transactional` are allowed).
- `api` depends on `application` (port/in) and `domain` models via mappers; never on `infrastructure`.
- `infrastructure` implements `application.port.out`; nothing else depends on it.
- A feature talks to another feature only through that feature's `application/port/in`. No reaching into another feature's `domain`, `infrastructure` or entities.
- `shared` must not depend on any feature.

### Conventions

- DTOs ≠ domain models ≠ persistence entities. Always map between them.
- Errors: domain/application throw domain exceptions; a single exception mapper in `shared/error` turns them into the HTTP error shape from the OpenAPI contract.
- Validation: request shape via Bean Validation on DTOs; business rules in domain/application.
- Config via `application.properties` + `@ConfigMapping`; no hard-coded env values.
- Naming: `*Resource` (api), `*UseCase` (port/in), `*Port` (port/out), `*Service` (application impl), `*Repository` impl in infrastructure, `*Entity` for persistence entities, `*Dto`/`*Request`/`*Response` for API.
