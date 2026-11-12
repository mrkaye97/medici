# Stage 1: Build Rust backend
#
# cargo-chef builds the dependencies in their own layer from a "recipe" of
# Cargo.toml/Cargo.lock, so that layer is reused from cache until the
# dependencies change. A normal code change only recompiles the server crate.
FROM rust:1.91-slim-bookworm AS chef

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN cargo install cargo-chef --locked --version 0.1.78

FROM chef AS planner
COPY server/ .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS backend-builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

COPY server/ .
RUN cargo build --release

# Stage 2: Build frontend
FROM node:22-alpine AS frontend-builder

WORKDIR /app

RUN npm install -g pnpm

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ .

ENV VITE_API_URL=""
RUN pnpm build

# Stage 3: Final runtime
FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libssl3 \
    libpq5 \
    ca-certificates \
    curl \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Install Caddy
ARG TARGETARCH
RUN curl -fsSL "https://github.com/caddyserver/caddy/releases/download/v2.8.4/caddy_2.8.4_linux_${TARGETARCH}.tar.gz" \
    | tar -xz -C /usr/local/bin caddy

# Copy backend
COPY --from=backend-builder /app/target/release/server ./server

# Copy frontend static files
COPY --from=frontend-builder /app/dist ./static

# Caddy config
COPY <<EOF /app/Caddyfile
:80 {
    # Password reset links carry a token in the URL; never send it to other
    # sites in the Referer header.
    header Referrer-Policy no-referrer

    handle /api/* {
        reverse_proxy localhost:8000
    }
    handle {
        root * /app/static
        try_files {path} /index.html
        file_server
    }
}
EOF

# Supervisor config
COPY <<EOF /etc/supervisor/conf.d/app.conf
[supervisord]
nodaemon=true
logfile=/dev/null
logfile_maxbytes=0

[program:backend]
command=/app/server
autostart=true
autorestart=true
stdout_logfile=/dev/fd/1
stdout_logfile_maxbytes=0
stderr_logfile=/dev/fd/2
stderr_logfile_maxbytes=0

[program:caddy]
command=/usr/local/bin/caddy run --config /app/Caddyfile
autostart=true
autorestart=true
stdout_logfile=/dev/fd/1
stdout_logfile_maxbytes=0
stderr_logfile=/dev/fd/2
stderr_logfile_maxbytes=0
EOF

EXPOSE 80

# Migrations are compiled into the server. If they fail, the container exits
# instead of starting the app against a half-migrated database.
CMD ["sh", "-c", "./server migrate && supervisord -c /etc/supervisor/conf.d/app.conf"]
