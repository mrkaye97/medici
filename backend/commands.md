## Run Atlas

#### Generate a migration

```bash
dbmate new
```

```bash
dbmate migrate
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

### Connec to db

```bash
psql -d postgres://postgres:postgres@localhost:5442/medici

```
