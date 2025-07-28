FROM rust:1.87-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpq-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN cargo install diesel_cli --no-default-features --features postgres

COPY . .

RUN cargo build --release

EXPOSE 8000

CMD ["sh", "-c", "echo 'Starting migration...' && diesel migration run && echo 'Migration complete, starting server...' && RUST_BACKTRACE=1 ./target/release/server"]
