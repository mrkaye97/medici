## Run Atlas

#### Generate a migration

```bash
atlas migrate diff create_initial_models \
  --dir "file://migrations" \
  --to "file://schema.sql" \
  --dev-url "postgres://postgres:postgres@localhost:5442/medici?sslmode=disable"
```

```bash
atlas migrate apply \
  --url "postgres://postgres:postgres@localhost:5442/medici?sslmode=disable"
```

### Generate SQLC

```bash
sqlc generate
```
