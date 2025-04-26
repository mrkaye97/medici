# Medici

### Commands

Generate a TS schema from OpenAPI spec

```bash copy
npx openapi-typescript openapi.json -o schema.ts
```

Write an OpenAPI spec:

```bash copy
curl http://localhost:8000/api/openapi.json | jq > openapi.json
```

Run the migrations

```bash copy
diesel migration run --database-url=...
```
