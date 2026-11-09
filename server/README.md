# vehicle-passport server

Quarkus (Java) REST backend, feature-first hexagonal. The HTTP contract is `../contracts/openapi.yaml`.

## Run

Requires JDK 21+, Maven, Docker (tests) and the local Supabase stack from `infra/` (`npx supabase start`).
Dev mode connects to Postgres at `127.0.0.1:54322` and validates Supabase JWTs.

Create a private Storage bucket named `vehicle-passport` and take the S3 credentials from `npx supabase status -o env`.

## Environment variables

| Variable | Meaning | Default |
|---|---|---|
| `SUPABASE_URL` | Supabase base URL; JWTs are verified against `$SUPABASE_URL/auth/v1` | `http://127.0.0.1:54321` |
| `STORAGE_S3_ENDPOINT` | S3 endpoint of Supabase Storage | `http://127.0.0.1:54321/storage/v1/s3` |
| `STORAGE_S3_REGION` | S3 region | `local` |
| `STORAGE_S3_ACCESS_KEY` | S3 access key id | `local` (placeholder, set a real one) |
| `STORAGE_S3_SECRET_KEY` | S3 secret | `local` (placeholder, set a real one) |
| `STORAGE_S3_BUCKET` | private bucket | `vehicle-passport` |
| `PASSPORT_PUBLIC_BASE_URL` | base of the `publicUrl` returned for passports | `http://localhost:8080` |

Never commit keys or tokens; pass them via the environment.

## Commands

```bash
# dev mode
mvn -f server/pom.xml quarkus:dev

# unit tests
mvn -f server/pom.xml test

# full build: unit + integration tests (needs Docker)
mvn -f server/pom.xml verify -Dquarkus.http.test-port=0 -Dquarkus.http.test-ssl-port=0
```

## Receipt extraction

Per decision D7, no extraction provider is configured by default: scans are stored and
can be reviewed and confirmed manually, but no data is extracted automatically until a
provider is wired in.
