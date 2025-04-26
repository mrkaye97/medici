use axum::{
    Json, Router,
    response::IntoResponse,
    routing::{get, post},
};
mod api_doc;
use api_doc::ApiDoc;
use hyper::StatusCode;
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;
use tracing_subscriber;
use utoipa::OpenApi;

mod handlers;
use handlers::{
    accept_friend_request_handler, add_expense_handler, add_friend_to_pool_handler,
    authenticate_handler, create_friend_request_handler, create_pool_membership_handler,
    get_expense_handler, get_member_handler, get_pool_details_handler,
    get_pool_recent_expenses_handler, list_friends_handler, list_inbound_friend_requests_handler,
    list_members_handler, list_members_of_pool_handler, list_pools_for_member_handler,
    login_handler, remove_friend_from_pool_handler, signup_handler,
};
use handlers::{create_pool_handler, health_check};

async fn openapi_handler() -> impl IntoResponse {
    let openapi = ApiDoc::openapi();
    (StatusCode::OK, Json(openapi))
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let app = Router::new()
        .route("/api/health", get(health_check))
        // Member routes
        .route("/api/members", get(list_members_handler))
        .route("/api/members/:id", get(get_member_handler))
        .route("/api/signup", post(signup_handler))
        .route("/api/login", post(login_handler))
        .route("/api/authenticate", post(authenticate_handler))
        // Pool routes
        .route("/api/pools", post(create_pool_handler))
        .route("/api/pools/details", post(get_pool_details_handler))
        .route("/api/members/:id/pools", get(list_pools_for_member_handler))
        // Pool membership routes
        .route("/api/pools/members", post(list_members_of_pool_handler))
        .route(
            "/api/pools/membership",
            post(create_pool_membership_handler),
        )
        .route("/api/pools/add-member", post(add_friend_to_pool_handler))
        .route(
            "/api/pools/remove-member",
            post(remove_friend_from_pool_handler),
        )
        // Expense routes
        .route("/api/expenses", post(add_expense_handler))
        .route("/api/expenses/:id", get(get_expense_handler))
        .route(
            "/api/pools/expenses",
            post(get_pool_recent_expenses_handler),
        )
        // Friendship routes
        .route("/api/members/:id/friends", get(list_friends_handler))
        .route(
            "/api/members/:id/friend-requests",
            get(list_inbound_friend_requests_handler),
        )
        .route("/api/friend-requests", post(create_friend_request_handler))
        .route(
            "/api/friend-requests/accept",
            post(accept_friend_request_handler),
        )
        .route("/api/openapi.json", get(openapi_handler))
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([127, 0, 0, 1], 8000));
    let listener = TcpListener::bind(addr).await.unwrap();
    tracing::info!("Listening on {}", addr);

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}
