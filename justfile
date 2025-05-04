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

[working-directory: 'frontend']
set-env-frontend:
  echo "\n" >> .env
  echo "VITE_API_URL=http://localhost:8000" >> .env

  echo "## Set if you want to deploy somewhere" >> .env
  echo "## __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=your.domain.com" >> .env

[working-directory: 'server']
set-env-backend:
  echo "\n" >> .env
  echo "DATABASE_URL=postgres://postgres:postgres@localhost:5442/medici" >> .env
  echo "AUTH_SECRET_KEY=medici-key" >> .env

[working-directory: 'server']
db-migrate:
  diesel migration run --database-url="$(grep DATABASE_URL .env | cut -d '=' -f2)"
