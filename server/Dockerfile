FROM rust:1.87-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN cargo install diesel_cli --no-default-features --features postgres

COPY . .

RUN cargo build --release

FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libssl3 \
    libpq5 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/server ./server
COPY --from=builder /usr/local/cargo/bin/diesel ./diesel

COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/diesel.toml ./diesel.toml

EXPOSE 8000

CMD ["sh", "-c", "echo 'Starting migration...' && ./diesel migration run && echo 'Migration complete, starting server...' && RUST_BACKTRACE=1 ./server"]