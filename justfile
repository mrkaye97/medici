setup:
  docker compose up -d

  sleep 3

  cd server && \
  cargo build && \
  diesel migration run --database-url="$(grep DATABASE_URL .env | cut -d '=' -f2)"

  cd frontend && \
  pnpm install

[working-directory: 'frontend']
gen-openapi:
  curl http://localhost:8000/api/openapi.json | jq > openapi.json
  npx openapi-typescript openapi.json -o schema.ts
