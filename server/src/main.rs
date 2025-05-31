use axum::{Json, routing::get};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;
use tracing_subscriber;

mod handlers;
use handlers::{MaybeTracerProvider, handlers_routes, init_tracer_provider};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    let _ = dotenvy::dotenv();

    let provider = init_tracer_provider().expect("Failed to initialize tracer provider");

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

        match provider {
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
