FROM rust:1.86.0-slim AS builder

WORKDIR /app

COPY . .

RUN apt-get update && apt-get install -y libfl-dev libpq-dev

RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y libpq5

WORKDIR /app

COPY --from=builder /app/target/release/server ./

CMD ["./server"]