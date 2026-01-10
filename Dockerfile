# Stage 1: Build Rust backend
FROM rust:1.87-slim AS backend-builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN cargo install diesel_cli --no-default-features --features postgres

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
COPY --from=backend-builder /usr/local/cargo/bin/diesel ./diesel
COPY --from=backend-builder /app/migrations ./migrations
COPY --from=backend-builder /app/diesel.toml ./diesel.toml

# Copy frontend static files
COPY --from=frontend-builder /app/dist ./static

# Caddy config
COPY <<EOF /app/Caddyfile
:80 {
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

CMD ["sh", "-c", "./diesel migration run && supervisord -c /etc/supervisor/conf.d/app.conf"]
