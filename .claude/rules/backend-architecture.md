---
paths:
  - "backend/**"
---

# Backend architecture rules

Full description: @.claude/ARCHITECTURE.md. These rules are mandatory when touching `../../server`.

1. **Contract first.** API changes start in `contracts/openapi.yaml`. Resources and DTOs must match it exactly (paths, names, status codes, error shape).
2. **Feature-first + hexagonal.** New code goes in `com.vehiclepassport.server.<feature>/{api,application,domain,infrastructure}`. A new feature = a new top-level package with the same four sub-packages.
3. **Dependency direction:** `api → application → domain ← infrastructure`. Never import `infrastructure` from `api`/`application`/`domain`; never import `api` from anywhere but `api`.
4. **`domain` is pure Java.** No Quarkus, JPA, JAX-RS, Jackson or other framework annotations/imports.
5. **Resources are thin.** A `*Resource` only validates input, maps DTO → command, calls a `port/in` use case, maps the result to a response DTO. No business logic, no repository access.
6. **Transactions** (`@Transactional`) belong in `application/service`, not in resources or repositories.
7. **Persistence** is behind `application/port/out`. JPA/Panache entities live only in `infrastructure/persistence/entity` and never leak out; map to domain models.
8. **Cross-feature access** only via the other feature's `application/port/in`. Never touch another feature's entities, repositories or domain classes.
9. **`shared`** holds cross-cutting code only (config, error mapping, security, utils) and must not depend on any feature.
10. **Schema changes** only through new Flyway migrations in `src/main/resources/db/migration`. Never edit an applied migration.
11. **Errors** are domain exceptions mapped centrally in `shared/error`; do not build HTTP error responses ad hoc in resources.
12. **Tests:** unit tests mirror the main package under `src/test/java`; `@QuarkusTest` / integration tests go in `src/integration-test/java`. Domain and application tests must not need a running Quarkus.
13. **Don't invent structure.** If code doesn't fit these layers, update `.claude/ARCHITECTURE.md` first (and tell the user) rather than placing it ad hoc.
