use axum::{Json, routing::get};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;

mod email;
mod handlers;
use handlers::{MaybeTracerProvider, handlers_routes, init_tracer_provider};

#[tokio::main]
async fn main() {
    let _ = dotenvy::dotenv();

    // `server reset-link <email>` prints a one-time password reset link for
    // the person running the server to pass on, e.g. when SMTP isn't set up:
    //   docker compose exec medici ./server reset-link someone@example.com
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("reset-link") {
        let Some(email) = args.get(2) else {
            eprintln!("usage: server reset-link <email>");
            std::process::exit(2);
        };

        let email = email.clone();
        let result =
            tokio::task::spawn_blocking(move || handlers::issue_reset_link_for_cli(&email))
                .await
                .expect("reset-link task panicked");

        match result {
            Ok(link) => {
                println!("{}", link);
                println!(
                    "This link works once and expires in {} minutes.",
                    server::PASSWORD_RESET_TTL_MINUTES
                );
                return;
            }
            Err(e) => {
                eprintln!("error: {}", e);
                std::process::exit(1);
            }
        }
    }

    let tracer_provider = init_tracer_provider().expect("Failed to initialize tracer provider");

    let (router, openapi) = handlers_routes().split_for_parts();

    let app = router
        .route("/api/openapi.json", get(|| async { Json(openapi) }))
        .layer(CorsLayer::permissive());

    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8000);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
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
