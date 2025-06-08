use axum::{Json, routing::get};
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;
use tracing_subscriber::{self, EnvFilter, prelude::*};

mod handlers;
use handlers::{MaybeTracerProvider, handlers_routes, init_tracer_provider};

use crate::handlers::init_logger_provider;

#[tokio::main]
async fn main() {
    let _ = dotenvy::dotenv();

    let tracer_provider = init_tracer_provider().expect("Failed to initialize tracer provider");
    let logger_provider = init_logger_provider().expect("Failed to initialize logger provider");
    let otel_log_layer = OpenTelemetryTracingBridge::new(&logger_provider);

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with(
            tracing_subscriber::fmt::layer()
                .with_file(true)
                .with_line_number(true),
        )
        .with(otel_log_layer)
        .init();

    let (router, openapi) = handlers_routes().split_for_parts();

    let app = router
        .route("/api/openapi.json", get(|| async { Json(openapi) }))
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    let listener = TcpListener::bind(addr).await.unwrap();

    tracing::info!("Listening on {}", addr);

    let shutdown_signal = async move {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install CTRL+C signal handler");

        match tracer_provider {
            MaybeTracerProvider::Sdk(sdk_provider) => {
                let shutdown_result =
                    tokio::task::spawn_blocking(move || sdk_provider.shutdown()).await;

                match shutdown_result {
                    Ok(Ok(())) => tracing::info!("Traces flushed successfully"),
                    Ok(Err(e)) => tracing::info!("Error shutting down tracer provider: {}", e),
                    Err(e) => tracing::info!("Error running shutdown task: {}", e),
                }
            }
            MaybeTracerProvider::Noop(_) => {
                tracing::info!("No-op tracer provider, no shutdown needed");
            }
        }
    };

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal)
    .await
    .unwrap();
}
