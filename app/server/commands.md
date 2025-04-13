## Run Atlas

#### Generate a migration

```bash
atlas migrate diff \
  --dir "file://src/db/migrations" \
  --to "file://src/db/schema.sql" \
  --dev-url "docker://postgres/15"
```

```bash
atlas migrate apply \
  --dir "file://src/db/migrations" \
  --url "postgres://postgres:postgres@localhost:5442/medici?sslmode=disable"
```

### Generate SQLC

```bash
sqlc generate
```

### Seed db

```sql
INSERT INTO member (first_name, last_name, email, password_hash)
VALUES
  ('Matt', 'Kaye', 'mrkaye97@gmail.com', 'password'),
  ('Madi', 'Ramsey', 'madiramsey18@gmail.com', 'password')
;

INSERT INTO pool (name, description)
VALUES ('Roommates', 'A group for us being loving roommates and also engineers!')
;

INSERT INTO pool_membership (pool_id, member_id, role)
SELECT p.id, m.id, 'ADMIN'
FROM pool p, member m
;
```