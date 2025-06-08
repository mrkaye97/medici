use std::sync::OnceLock;
use std::time::{Duration as BuiltInDuration, SystemTime, UNIX_EPOCH};

use axum::extract::{MatchedPath, Query};
use axum::http::StatusCode;
use axum::middleware;
use axum::{Json, extract::Path};
use axum::{
    extract::Request,
    middleware::Next,
    response::{IntoResponse, Response},
};
use axum_extra::TypedHeader;
use axum_extra::headers::Authorization;
use axum_extra::headers::authorization::Bearer;
use bcrypt::{DEFAULT_COST, hash_with_salt};
use chrono::{DateTime, Duration, Utc};
use diesel::pg::PgConnection;
use diesel::r2d2::{ConnectionManager, Pool, PooledConnection};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use once_cell::sync::Lazy;
use opentelemetry::KeyValue;
use opentelemetry::global::{self, BoxedTracer};
use opentelemetry::trace::noop::NoopTracerProvider;
use opentelemetry::trace::{FutureExt, Span, SpanKind, Status, TraceContextExt, Tracer};
use opentelemetry_otlp::{LogExporter, Protocol, WithExportConfig};
use opentelemetry_sdk::Resource;
use opentelemetry_sdk::logs::{BatchLogProcessor, SdkLoggerProvider};
use opentelemetry_sdk::trace::{BatchConfigBuilder, BatchSpanProcessor, SdkTracerProvider};
use serde::{Deserialize, Serialize};
use server::compute_balances_for_member;
use server::models::{
    self, Expense, ExpenseCategory, Friendship, Member, MemberChangeset, MemberPassword, NewPool,
    PoolMembership,
};
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

type PgPool = Pool<ConnectionManager<PgConnection>>;
type PgPooledConnection = PooledConnection<ConnectionManager<PgConnection>>;

static DB_POOL: Lazy<PgPool> = Lazy::new(|| {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let manager = ConnectionManager::<PgConnection>::new(database_url);
    Pool::builder()
        .build(manager)
        .expect("Failed to create pool")
});

pub async fn get_db_connection() -> Result<PgPooledConnection, anyhow::Error> {
    Ok(DB_POOL.get()?)
}

const PASSWORD_SALT: [u8; 16] = *b"MediciSalt123456";

pub fn get_tracer() -> &'static BoxedTracer {
    static TRACER: OnceLock<BoxedTracer> = OnceLock::new();
    TRACER.get_or_init(|| global::tracer("medici-server"))
}

fn get_resource() -> Resource {
    static RESOURCE: OnceLock<Resource> = OnceLock::new();
    RESOURCE
        .get_or_init(|| {
            Resource::builder()
                .with_service_name("medici-server")
                .build()
        })
        .clone()
}

pub enum MaybeTracerProvider {
    Sdk(SdkTracerProvider),
    Noop(NoopTracerProvider),
}

pub fn init_tracer_provider()
-> Result<MaybeTracerProvider, Box<dyn std::error::Error + Send + Sync + 'static>> {
    let exporter_endpoint = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT").unwrap_or("".to_string());

    if exporter_endpoint.is_empty() {
        let no_op_provider = NoopTracerProvider::new();
        return Ok(MaybeTracerProvider::Noop(no_op_provider));
    }

    let exporter_url = format!("{}/v1/traces", exporter_endpoint);

    let otlp_exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_http()
        .with_protocol(Protocol::Grpc)
        .with_endpoint(exporter_url)
        .with_timeout(BuiltInDuration::from_secs(10))
        .build()?;

    let batch_config = BatchConfigBuilder::default()
        .with_max_export_batch_size(512)
        .with_scheduled_delay(BuiltInDuration::from_millis(5000))
        .with_max_queue_size(2048)
        .build();

    let batch_processor = BatchSpanProcessor::new(otlp_exporter, batch_config);

    let tracer_provider = SdkTracerProvider::builder()
        .with_resource(get_resource())
        .with_span_processor(batch_processor)
        .build();

    global::set_tracer_provider(tracer_provider.clone());

    Ok(MaybeTracerProvider::Sdk(tracer_provider))
}

pub fn init_logger_provider()
-> Result<SdkLoggerProvider, Box<dyn std::error::Error + Send + Sync + 'static>> {
    let exporter_endpoint = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT").unwrap_or_default();

    if exporter_endpoint.is_empty() {
        return Err("OTEL_EXPORTER_OTLP_ENDPOINT not set".into());
    }

    let log_exporter = LogExporter::builder()
        .with_http()
        .with_endpoint(format!("{}/v1/logs", exporter_endpoint))
        .with_timeout(BuiltInDuration::from_secs(10))
        .build()?;

    // Create logger provider with batch processor
    let logger_provider = SdkLoggerProvider::builder()
        .with_resource(get_resource()) // Use your existing resource function
        .with_log_processor(BatchLogProcessor::builder(log_exporter).build())
        .build();

    Ok(logger_provider)
}

fn hash_password(password: &str) -> String {
    hash_with_salt(password, DEFAULT_COST, PASSWORD_SALT)
        .expect("Failed to hash password")
        .to_string()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
}

fn generate_jwt(member_id: uuid::Uuid) -> Result<String, jsonwebtoken::errors::Error> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_secs() as usize;

    let expiration = now + 7 * 24 * 60 * 60;

    let claims = Claims {
        sub: member_id.to_string(),
        exp: expiration,
        iat: now,
    };

    let secret = std::env::var("AUTH_SECRET_KEY").expect("AUTH_SECRET_KEY must be set");

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

fn verify_jwt(token: &str) -> Result<uuid::Uuid, jsonwebtoken::errors::Error> {
    let secret = std::env::var("AUTH_SECRET_KEY").expect("AUTH_SECRET_KEY must be set");

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )?;

    let user_id = uuid::Uuid::parse_str(&token_data.claims.sub).map_err(|_| {
        jsonwebtoken::errors::Error::from(jsonwebtoken::errors::ErrorKind::InvalidToken)
    })?;

    Ok(user_id)
}

#[derive(Serialize, ToSchema)]
#[serde(untagged)]
pub enum AuthResult {
    Authenticated {
        id: uuid::Uuid,
        token: String,
        is_authenticated: bool,
        expires_at: DateTime<Utc>,
    },
    Unauthenticated {
        id: Option<uuid::Uuid>,
        token: Option<String>,
        is_authenticated: bool,
        expires_at: Option<DateTime<Utc>>,
    },
}

pub async fn auth_middleware(
    TypedHeader(auth): TypedHeader<Authorization<Bearer>>,
    request: Request,
    next: Next,
) -> Response {
    match verify_jwt(auth.token()) {
        Ok(_) => next.run(request).await,
        Err(_) => (
            StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({
                "error": "Invalid token"
            })),
        )
            .into_response(),
    }
}

pub async fn trace_middleware(request: Request, next: Next) -> Response {
    let tracer = get_tracer();

    let path = request
        .extensions()
        .get::<MatchedPath>()
        .map(|matched_path| matched_path.as_str().to_string())
        .unwrap_or_else(|| request.uri().path().to_string());

    let method = request.method().as_str().to_string();

    let mut span = tracer
        .span_builder("http.request")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("http.method", method));
    span.set_attribute(KeyValue::new("http.path", path));

    let cx = opentelemetry::Context::current().with_span(span);

    let response = async move { next.run(request).await }
        .with_context(cx.clone())
        .await;

    let span = cx.span();
    span.set_attribute(KeyValue::new(
        "http.status_code",
        response.status().as_u16().to_string(),
    ));

    let status = if response.status().is_success() {
        Status::Ok
    } else {
        Status::Error {
            description: std::borrow::Cow::Borrowed(
                response
                    .status()
                    .canonical_reason()
                    .unwrap_or("Unknown error"),
            ),
        }
    };

    span.set_status(status);
    span.end();

    response.into_response()
}

#[derive(Deserialize, ToSchema)]
pub struct PoolInput {
    name: String,
    description: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct PoolMembershipInput {
    member_id: uuid::Uuid,
}

#[derive(Deserialize, ToSchema)]
pub struct ExpenseLineItem {
    debtor_member_id: uuid::Uuid,
    amount: f64,
}

#[derive(Deserialize, ToSchema)]
pub struct ExpenseInput {
    paid_by_member_id: uuid::Uuid,
    pool_id: uuid::Uuid,
    name: String,
    amount: f64,
    line_items: Vec<ExpenseLineItem>,
    category: String,
    description: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct SignupInput {
    first_name: String,
    last_name: String,
    email: String,
    password: String,
}

#[derive(Deserialize, ToSchema)]
pub struct LoginInput {
    email: String,
    password: String,
}

#[derive(Deserialize, ToSchema)]
pub struct FriendRequestInput {
    friend_email: String,
}

#[utoipa::path(
    post,
    path = "/api/members/{member_id}/pools",
    request_body = PoolInput,
    params(
        ("member_id" = uuid::Uuid, Path, description = "ID of the member to create a pool under")
    ),
    responses(
        (status = 200, description = "Create a pool successfully", body = models::Pool),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn create_pool_handler(
    Path(member_id): Path<uuid::Uuid>,
    Json(pool_input): Json<PoolInput>,
) -> Json<models::Pool> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("create_pool_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let new_pool = NewPool {
        name: pool_input.name,
        description: pool_input.description,
    };

    let pool = tokio::task::spawn_blocking(move || {
        models::Pool::create(&mut conn, &new_pool).expect("Failed to create pool")
    })
    .await
    .expect("Task panicked");

    let pool_id = pool.id;

    let new_membership = models::NewPoolMembership {
        pool_id: pool_id,
        member_id: member_id,
        role: models::PoolRole::ADMIN,
        default_split_percentage: 100.0,
    };

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    tokio::task::spawn_blocking(move || {
        PoolMembership::create(&mut conn, &new_membership)
            .expect("Failed to create pool membership")
    })
    .await
    .expect("Task panicked");

    span.end();

    Json(pool)
}

#[utoipa::path(
    post,
    path = "/api/pools/{pool_id}/members",
    request_body = PoolMembershipInput,
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to add a member to")
    ),
    responses(
        (status = 200, description = "Add a friend to a pool successfully", body = PoolMembership),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn add_friend_to_pool_handler(
    Path(pool_id): Path<uuid::Uuid>,
    Json(input): Json<PoolMembershipInput>,
) -> Json<PoolMembership> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("add_friend_to_pool_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("pool_id", pool_id.to_string()));
    span.set_attribute(KeyValue::new("member_id", input.member_id.to_string()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let result = tokio::task::spawn_blocking(move || {
        PoolMembership::add_member(&mut conn, pool_id, input.member_id)
            .expect("Failed to add friend to pool")
    })
    .await
    .expect("Task panicked");

    span.end();

    Json(result)
}

#[derive(Deserialize, ToSchema)]
pub struct RemoveFriendFromPoolPath {
    pool_id: uuid::Uuid,
    member_id: uuid::Uuid,
}

#[utoipa::path(
    delete,
    path = "/api/pools/{pool_id}/members/{member_id}",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool"),
        ("member_id" = uuid::Uuid, Path, description = "ID of the member to remove")
    ),
    responses(
        (status = 200, description = "Remove a friend from a pool successfully", body = serde_json::Value),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn remove_friend_from_pool_handler(
    Path(path): Path<RemoveFriendFromPoolPath>,
) -> Json<serde_json::Value> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("remove_friend_from_pool_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let pool_id = path.pool_id;
    let member_id = path.member_id;

    span.set_attribute(KeyValue::new("pool_id", pool_id.to_string()));
    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let result = tokio::task::spawn_blocking(move || {
        PoolMembership::remove_member(&mut conn, pool_id, member_id)
            .expect("Failed to remove friend from pool")
    })
    .await
    .expect("Task panicked");

    span.end();

    Json(serde_json::json!({"success": result > 0}))
}

#[utoipa::path(
    get,
    path = "/api/members/{member_id}",
    params(
        ("member_id" = uuid::Uuid, Path, description = "ID of the member to fetch")
    ),
    responses(
        (status = 200, description = "Get a member successfully", body = Member),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_member_handler(
    Path(member_id): Path<uuid::Uuid>,
) -> Result<Json<Member>, (StatusCode, Json<serde_json::Value>)> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("get_member_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let member = tokio::task::spawn_blocking(move || Member::find(&mut conn, member_id))
        .await
        .expect("Task panicked");

    span.end();

    match member {
        Ok(m) => Ok(Json(m)),
        Err(_) => Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Member not found"})),
        )),
    }
}

#[utoipa::path(
    post,
    path = "/api/login",
    request_body = LoginInput,
    responses(
        (status = 200, description = "Log in a member successfully", body = AuthResult),
        (status = 400, description = "Incorrect credentials", body = AuthResult),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn login_handler(
    Json(input): Json<LoginInput>,
) -> Result<Json<AuthResult>, (StatusCode, Json<AuthResult>)> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("login_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("email", input.email.clone()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");
    let email = input.email;
    let password = input.password;

    let result = tokio::task::spawn_blocking(move || {
        let password_hash = hash_password(&password);
        match Member::authenticate(&mut conn, &email, &password_hash) {
            Ok((id, is_authenticated)) => {
                if is_authenticated {
                    match generate_jwt(id) {
                        Ok(token) => AuthResult::Authenticated {
                            id,
                            token,
                            is_authenticated: true,
                            expires_at: Utc::now() + Duration::days(28),
                        },
                        Err(_) => AuthResult::Unauthenticated {
                            id: None,
                            token: None,
                            is_authenticated: false,
                            expires_at: None,
                        },
                    }
                } else {
                    AuthResult::Unauthenticated {
                        id: None,
                        token: None,
                        is_authenticated: false,
                        expires_at: None,
                    }
                }
            }
            Err(_) => AuthResult::Unauthenticated {
                id: None,
                token: None,
                is_authenticated: false,
                expires_at: None,
            },
        }
    })
    .await
    .expect("Task panicked");

    span.end();

    match result {
        AuthResult::Authenticated { .. } => Ok(Json(result)),
        AuthResult::Unauthenticated { .. } => Err((StatusCode::BAD_REQUEST, Json(result))),
    }
}

#[derive(Debug, Deserialize)]
pub struct AuthQuery {
    pub token: String,
}

#[utoipa::path(
    get,
    path = "/api/authenticate/{member_id}",
    params(
        ("member_id" = uuid::Uuid, Path, description = "ID of the member to authenticate"),
        ("token" = String, Query, description = "Token to authenticate the member"),
    ),
    responses(
        (status = 200, description = "Authenticate a member successfully", body = AuthResult),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn authenticate_handler(
    Path(member_id): Path<uuid::Uuid>,
    Query(query): Query<AuthQuery>,
) -> Json<AuthResult> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("authenticate_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let token = query.token;

    let result = match verify_jwt(&token) {
        Ok(token_member_id) => {
            if token_member_id == member_id {
                match generate_jwt(member_id) {
                    Ok(new_token) => Json(AuthResult::Authenticated {
                        id: member_id,
                        token: new_token,
                        is_authenticated: true,
                        expires_at: Utc::now() + Duration::days(28),
                    }),
                    Err(_) => Json(AuthResult::Unauthenticated {
                        id: None,
                        token: None,
                        is_authenticated: false,
                        expires_at: None,
                    }),
                }
            } else {
                Json(AuthResult::Unauthenticated {
                    id: None,
                    token: None,
                    is_authenticated: false,
                    expires_at: None,
                })
            }
        }
        Err(_) => Json(AuthResult::Unauthenticated {
            id: None,
            token: None,
            is_authenticated: false,
            expires_at: None,
        }),
    };

    span.end();
    result
}

#[utoipa::path(
    get,
    path = "/api/members/{member_id}/friends",
    params(
        ("member_id" = uuid::Uuid, Path, description = "ID of the member to fetch friends for")
    ),
    responses(
        (status = 200, description = "List friends of a member successfully", body = Vec<Member>),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn list_friends_handler(Path(member_id): Path<uuid::Uuid>) -> Json<Vec<Member>> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("list_friends_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let friends = tokio::task::spawn_blocking(move || {
        Friendship::get_friends(&mut conn, member_id).expect("Failed to list friends")
    })
    .await
    .expect("Task panicked");

    span.end();

    Json(friends)
}

#[derive(Serialize, ToSchema, Debug)]
#[serde(rename_all = "lowercase")]
pub enum FriendshipDirection {
    Inbound,
    Outbound,
}

#[derive(Serialize, ToSchema, Debug)]
pub struct FriendRequestsList {
    pub member: models::Member,
    pub direction: FriendshipDirection,
}

#[utoipa::path(
    get,
    path = "/api/members/{member_id}/friend-requests",
    params(
        ("member_id" = uuid::Uuid, Path, description = "ID of the member to fetch friend requests for")
    ),
    responses(
        (status = 200, description = "List inbound friend requests of a member successfully", body = Vec<FriendRequestsList>),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn list_inbound_friend_requests_handler(
    Path(member_id): Path<uuid::Uuid>,
) -> Json<Vec<FriendRequestsList>> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("list_inbound_friend_requests_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let requests = tokio::task::spawn_blocking(move || {
        Friendship::get_pending_requests(&mut conn, member_id)
            .expect("Failed to list friend requests")
    })
    .await
    .expect("Task panicked")
    .into_iter()
    .map(|(member, is_inbound)| FriendRequestsList {
        member,
        direction: if is_inbound {
            FriendshipDirection::Inbound
        } else {
            FriendshipDirection::Outbound
        },
    })
    .collect();

    span.end();

    Json(requests)
}

#[utoipa::path(
    post,
    path = "/api/members/{member_id}/friend-requests",
    params(
        ("member_id" = uuid::Uuid, Path, description = "ID of the member to create a friend request for")
    ),
    request_body = FriendRequestInput,
    responses(
        (status = 200, description = "Create a friend request successfully", body = serde_json::Value),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn create_friend_request_handler(
    Path(member_id): Path<uuid::Uuid>,
    Json(input): Json<FriendRequestInput>,
) -> Json<serde_json::Value> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("create_friend_request_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));
    span.set_attribute(KeyValue::new("friend_email", input.friend_email.clone()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");
    let member_id = member_id;
    let friend_email = input.friend_email.clone();

    let result = tokio::task::spawn_blocking(move || {
        Friendship::send_request_by_email(&mut conn, member_id, &friend_email)
            .expect("Failed to create friend request")
    })
    .await
    .expect("Task panicked");

    span.end();

    Json(serde_json::json!({"success": true, "request": result}))
}

#[derive(Deserialize, ToSchema)]
pub struct AcceptFriendRequestPath {
    inviting_member_id: uuid::Uuid,
    invitee_member_id: uuid::Uuid,
}

#[utoipa::path(
    post,
    path = "/api/members/{inviting_member_id}/friend-requests/{invitee_member_id}/accept",
    params(
        ("inviting_member_id" = uuid::Uuid, Path, description = "ID of the member accepting the request"),
        ("invitee_member_id" = uuid::Uuid, Path, description = "ID of the friend request to accept")
    ),
    responses(
        (status = 200, description = "Accept a friend request successfully", body = serde_json::Value),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn accept_friend_request_handler(
    Path(path): Path<AcceptFriendRequestPath>,
) -> Json<serde_json::Value> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("accept_friend_request_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let inviting_member_id = path.inviting_member_id;
    let invitee_member_id = path.invitee_member_id;

    span.set_attribute(KeyValue::new(
        "inviting_member_id",
        inviting_member_id.to_string(),
    ));
    span.set_attribute(KeyValue::new(
        "invitee_member_id",
        invitee_member_id.to_string(),
    ));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");
    let result = tokio::task::spawn_blocking(move || {
        Friendship::update_status(
            &mut conn,
            inviting_member_id,
            invitee_member_id,
            models::FriendshipStatus::Accepted,
        )
        .expect("Failed to accept friend request")
    })
    .await
    .expect("Task panicked");

    span.end();

    Json(serde_json::json!({"success": true, "friendship": result}))
}

#[utoipa::path(
    delete,
    path = "/api/members/{inviting_member_id}/friend-requests/{invitee_member_id}",
    params(
        ("inviting_member_id" = uuid::Uuid, Path, description = "ID of the member delete the request"),
        ("invitee_member_id" = uuid::Uuid, Path, description = "ID of the friend request to delete")
    ),
    responses(
        (status = 200, description = "Accept a friend request successfully", body = serde_json::Value),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn delete_friend_request(
    Path(path): Path<AcceptFriendRequestPath>,
) -> Json<serde_json::Value> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("delete_friend_request")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let inviting_member_id = path.inviting_member_id;
    let invitee_member_id = path.invitee_member_id;

    span.set_attribute(KeyValue::new(
        "inviting_member_id",
        inviting_member_id.to_string(),
    ));
    span.set_attribute(KeyValue::new(
        "invitee_member_id",
        invitee_member_id.to_string(),
    ));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");
    let result = tokio::task::spawn_blocking(move || {
        Friendship::delete(&mut conn, inviting_member_id, invitee_member_id)
            .expect("Failed to delete friend request")
    })
    .await
    .expect("Task panicked");

    span.end();

    Json(serde_json::json!({"success": true, "friendship": result}))
}

#[derive(Deserialize, ToSchema)]
pub struct ExpensePath {
    member_id: uuid::Uuid,
    pool_id: uuid::Uuid,
    expense_id: uuid::Uuid,
}

#[utoipa::path(
    get,
    path = "/api/members/{member_id}/pools/{pool_id}/expenses/{expense_id}",
    params(
        ("member_id" = uuid::Uuid, Path, description = "ID of the member to fetch expenses for"),
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to fetch expenses for"),
        ("expense_id" = uuid::Uuid, Path, description = "ID of the expense to fetch")
    ),
    responses(
        (status = 200, description = "Get expenses", body = models::Expense),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_expense_handler(
    Path(path): Path<ExpensePath>,
) -> Result<Json<models::Expense>, (StatusCode, Json<serde_json::Value>)> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("get_expense_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", path.member_id.to_string()));
    span.set_attribute(KeyValue::new("pool_id", path.pool_id.to_string()));
    span.set_attribute(KeyValue::new("expense_id", path.expense_id.to_string()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let expense = tokio::task::spawn_blocking(move || {
        models::Expense::find(
            &mut conn,
            path.expense_id,
            path.member_id,
            path.pool_id,
            false,
        )
        .or_else(|_| {
            models::Expense::find(
                &mut conn,
                path.expense_id,
                path.member_id,
                path.pool_id,
                true,
            )
        })
    })
    .await
    .expect("Task panicked");

    span.end();

    match expense {
        Ok(e) => Ok(Json(e)),
        Err(_) => Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Expense not found"})),
        )),
    }
}

#[utoipa::path(
    delete,
    path = "/api/members/{member_id}/pools/{pool_id}/expenses/{expense_id}",
    params(
        ("member_id" = uuid::Uuid, Path, description = "ID of the member to delete the expense for"),
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to delete the expense for"),
        ("expense_id" = uuid::Uuid, Path, description = "ID of the expense to delete")
    ),
    responses(
        (status = 200, description = "The deleted expense", body = models::Expense),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn delete_expense_handler(
    Path(path): Path<ExpensePath>,
) -> Result<Json<models::Expense>, (StatusCode, Json<serde_json::Value>)> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("delete_expense_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", path.member_id.to_string()));
    span.set_attribute(KeyValue::new("pool_id", path.pool_id.to_string()));
    span.set_attribute(KeyValue::new("expense_id", path.expense_id.to_string()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let expense = tokio::task::spawn_blocking(move || {
        models::Expense::delete(&mut conn, path.expense_id, path.pool_id, false)
    })
    .await
    .expect("Task panicked");

    span.end();

    match expense {
        Ok(e) => Ok(Json(e)),
        Err(_) => Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Expense not found"})),
        )),
    }
}

#[utoipa::path(
    post,
    path = "/api/signup",
    request_body = SignupInput,
    responses(
        (status = 200, description = "Get expenses", body = AuthResult),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn signup_handler(
    Json(input): Json<SignupInput>,
) -> Result<Json<AuthResult>, (StatusCode, Json<serde_json::Value>)> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("signup_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("email", input.email.clone()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let password_hash = hash_password(&input.password);
    let new_member = models::NewMember {
        first_name: input.first_name,
        last_name: input.last_name,
        email: input.email,
        bio: None,
    };

    let member = tokio::task::spawn_blocking(move || -> Result<Member, diesel::result::Error> {
        let member = Member::create(&mut conn, &new_member)?;

        let new_password = models::NewMemberPassword {
            member_id: member.id,
            password_hash,
        };
        MemberPassword::create(&mut conn, &new_password)?;

        Ok(member)
    })
    .await
    .expect("Task panicked");

    span.end();

    match member {
        Ok(m) => match generate_jwt(m.id) {
            Ok(token) => Ok(Json(AuthResult::Authenticated {
                id: m.id,
                token,
                is_authenticated: true,
                expires_at: Utc::now() + Duration::days(28),
            })),
            Err(_) => Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to generate token"})),
            )),
        },
        Err(_) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to create member"})),
        )),
    }
}

#[utoipa::path(
    post,
    path = "/api/pools/{pool_id}/expenses",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to add expense to")
    ),
    request_body = ExpenseInput,
    responses(
        (status = 200, description = "Create expense", body = Expense),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn add_expense_handler(Json(input): Json<ExpenseInput>) -> Json<models::Expense> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("add_expense_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("pool_id", input.pool_id.to_string()));
    span.set_attribute(KeyValue::new(
        "paid_by_member_id",
        input.paid_by_member_id.to_string(),
    ));
    span.set_attribute(KeyValue::new("amount", input.amount.to_string()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let new_expense = models::NewExpense {
        name: input.name,
        amount: input.amount,
        is_settled: false,
        pool_id: input.pool_id,
        paid_by_member_id: input.paid_by_member_id,
        description: input.description,
        notes: None,
        category: match input.category.as_str() {
            "FoodDining" => models::ExpenseCategory::FoodDining,
            "Groceries" => models::ExpenseCategory::Groceries,
            "Transportation" => models::ExpenseCategory::Transportation,
            "HousingRent" => models::ExpenseCategory::HousingRent,
            "Utilities" => models::ExpenseCategory::Utilities,
            "Healthcare" => models::ExpenseCategory::Healthcare,
            "Entertainment" => models::ExpenseCategory::Entertainment,
            "Shopping" => models::ExpenseCategory::Shopping,
            "Education" => models::ExpenseCategory::Education,
            "Travel" => models::ExpenseCategory::Travel,
            "PersonalCare" => models::ExpenseCategory::PersonalCare,
            "Fitness" => models::ExpenseCategory::Fitness,
            "Subscriptions" => models::ExpenseCategory::Subscriptions,
            "BillsPayments" => models::ExpenseCategory::BillsPayments,
            "BusinessExpenses" => models::ExpenseCategory::BusinessExpenses,
            "Investments" => models::ExpenseCategory::Investments,
            "Insurance" => models::ExpenseCategory::Insurance,
            "Gifts" => models::ExpenseCategory::Gifts,
            "Charity" => models::ExpenseCategory::Charity,
            "HomeHouseholdSupplies" => models::ExpenseCategory::HomeHouseholdSupplies,
            "Pets" => models::ExpenseCategory::Pets,
            "Taxes" => models::ExpenseCategory::Taxes,
            "Childcare" => models::ExpenseCategory::Childcare,
            "ProfessionalServices" => models::ExpenseCategory::ProfessionalServices,
            _ => models::ExpenseCategory::Miscellaneous,
        },
    };

    let debtor_member_ids: Vec<uuid::Uuid> = input
        .line_items
        .iter()
        .map(|item| item.debtor_member_id)
        .collect();

    let amounts: Vec<f64> = input.line_items.iter().map(|item| item.amount).collect();

    let (expense, _line_items) = tokio::task::spawn_blocking(move || {
        models::Expense::create_with_line_items(
            &mut conn,
            &new_expense,
            &debtor_member_ids,
            &amounts,
        )
        .expect("Failed to create expense with line items")
    })
    .await
    .expect("Task panicked");

    span.end();

    Json(expense)
}

#[derive(Serialize, ToSchema)]
pub struct PoolDetails {
    #[serde(flatten)]
    pool: models::Pool,
    role: models::PoolRole,
    total_debt: f64,
}

#[derive(Deserialize, ToSchema)]
pub struct PoolDetailsPath {
    member_id: uuid::Uuid,
    pool_id: uuid::Uuid,
}

#[utoipa::path(
    get,
    path = "/api/members/{member_id}/pools/{pool_id}",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to fetch details for"),
        ("member_id" = uuid::Uuid, Path, description = "ID of the member to fetch details for")
    ),
    responses(
        (status = 200, description = "Create expense", body = PoolDetails),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_pool_details_handler(Path(path): Path<PoolDetailsPath>) -> Json<PoolDetails> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("get_pool_details_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let member_id = path.member_id;
    let pool_id = path.pool_id;

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));
    span.set_attribute(KeyValue::new("pool_id", pool_id.to_string()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let pool_details = tokio::task::spawn_blocking(move || {
        models::Pool::get_with_debt_for_member(&mut conn, pool_id, member_id)
            .expect("Failed to get pool details")
    })
    .await
    .expect("Task panicked");

    let details = PoolDetails {
        pool: pool_details.0,
        role: pool_details.1,
        total_debt: pool_details.2,
    };

    span.end();

    Json(details)
}

#[utoipa::path(
    patch,
    path = "/api/members/{member_id}/pools/{pool_id}/settle-up",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to settle up"),
        ("member_id" = uuid::Uuid, Path, description = "ID of the member who confirmed the settle up")
    ),
    responses(
        (status = 200, description = "Pool settled up", body = PoolDetails),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn settle_up_pool_handler(Path(path): Path<PoolDetailsPath>) -> Json<PoolDetails> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("settle_up_pool_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let member_id = path.member_id;
    let pool_id = path.pool_id;

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));
    span.set_attribute(KeyValue::new("pool_id", pool_id.to_string()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    tokio::task::spawn_blocking(move || models::Pool::settle_up(&mut conn, pool_id, member_id));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let pool_details = tokio::task::spawn_blocking(move || {
        models::Pool::get_with_debt_for_member(&mut conn, pool_id, member_id)
            .expect("Failed to get pool details")
    })
    .await
    .expect("Task panicked");

    let details = PoolDetails {
        pool: pool_details.0,
        role: pool_details.1,
        total_debt: pool_details.2,
    };

    span.end();

    Json(details)
}

#[derive(Deserialize, Serialize, ToSchema, Debug)]
pub struct PoolMembershipWithMemberDetails {
    member: models::Member,
    pool_membership: models::PoolMembership,
}

#[derive(Deserialize, ToSchema)]
pub struct ModifyDefaultSplitInput {
    default_split_percentages: Vec<models::MemberIdSplitPercentage>,
}

#[utoipa::path(
    patch,
    path = "/api/members/{member_id}/pools/{pool_id}/default-splits",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to modify default split percentages for"),
        ("member_id" = uuid::Uuid, Path, description = "ID of the member who confirmed the modification")
    ),
    request_body = ModifyDefaultSplitInput,
    responses(
        (status = 200, description = "Default splits modified", body = Vec<PoolMembershipWithMemberDetails>),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn modify_default_splits_handler(
    Path(path): Path<PoolDetailsPath>,
    Json(input): Json<ModifyDefaultSplitInput>,
) -> Json<Vec<PoolMembershipWithMemberDetails>> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("modify_default_splits_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let pool_id = path.pool_id;

    span.set_attribute(KeyValue::new("pool_id", pool_id.to_string()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    tokio::task::spawn_blocking(move || {
        models::PoolMembership::update_default_split_percentage(
            &mut conn,
            pool_id,
            input.default_split_percentages,
        )
    });

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let members = tokio::task::spawn_blocking(move || {
        PoolMembership::list(&mut conn, pool_id).expect("Failed to list members of pool")
    })
    .await
    .expect("Task panicked");

    span.end();

    Json(
        members
            .into_iter()
            .map(
                |(pool_membership, member)| PoolMembershipWithMemberDetails {
                    member,
                    pool_membership,
                },
            )
            .collect(),
    )
}
#[derive(Serialize, ToSchema)]
pub struct RecentExpenseDetails {
    #[serde(flatten)]
    expense: models::Expense,
    line_amount: f64,
}

#[derive(Deserialize, ToSchema)]
pub struct RecentExpensesQuery {
    limit: Option<i64>,
    category: Option<ExpenseCategory>,
    is_settled: bool,
    paid_by_member_id: Option<uuid::Uuid>,
    since: Option<chrono::DateTime<Utc>>,
    until: Option<chrono::DateTime<Utc>>,
}

#[derive(Deserialize, ToSchema)]
pub struct RecentExpensesPath {
    pool_id: uuid::Uuid,
    member_id: uuid::Uuid,
}

#[utoipa::path(
    get,
    path = "/api/pools/{pool_id}/members/{member_id}/expenses",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to fetch expenses for"),
        ("member_id" = uuid::Uuid, Path, description = "ID of the member to fetch expenses for"),
        ("category" = Option<ExpenseCategory>, Query, description = "Filter expenses by category"),
        ("limit" = Option<i64>, Query, description = "Limit the number of expenses returned"),
        ("is_settled" = bool, Query, description = "Filter expenses by settle status"),
        ("paid_by_member_id" = Option<uuid::Uuid>, Query, description = "Filter expenses by the member who paid"),
        ("since" = Option<chrono::DateTime<Utc>>, Query, description = "Filter expenses since a specific date"),
        ("until" = Option<chrono::DateTime<Utc>>, Query, description = "Filter expenses until a specific date"),
    ),
    responses(
        (status = 200, description = "Create expense", body = Vec<RecentExpenseDetails>),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_pool_recent_expenses_handler(
    Path(path): Path<RecentExpensesPath>,
    Query(query): Query<RecentExpensesQuery>,
) -> Json<Vec<RecentExpenseDetails>> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("get_pool_recent_expenses_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let limit = query.limit.unwrap_or(5);
    let since = query
        .since
        .unwrap_or_else(|| Utc::now() - chrono::Duration::days(30));
    let until = query.until.unwrap_or_else(|| Utc::now());

    span.set_attribute(KeyValue::new("pool_id", path.pool_id.to_string()));
    span.set_attribute(KeyValue::new("member_id", path.member_id.to_string()));
    span.set_attribute(KeyValue::new("limit", limit.to_string()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let expenses = tokio::task::spawn_blocking(move || {
        models::Expense::get_recent_for_member_in_pool(
            &mut conn,
            path.pool_id,
            path.member_id,
            limit,
            query.category,
            query.paid_by_member_id,
            query.is_settled,
            since,
            until,
        )
        .expect("Failed to get recent expenses")
    })
    .await
    .expect("Task panicked");

    span.end();

    Json(
        expenses
            .into_iter()
            .map(|(expense, line_amount)| RecentExpenseDetails {
                expense,
                line_amount,
            })
            .collect(),
    )
}

#[derive(Deserialize, ToSchema)]
pub struct PoolBalancesForMemberPath {
    pool_id: uuid::Uuid,
    member_id: uuid::Uuid,
}

#[utoipa::path(
    get,
    path = "/api/pools/{pool_id}/members/{member_id}/balances",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to fetch balances for"),
        ("member_id" = uuid::Uuid, Path, description = "ID of the member to fetch balances for"),
    ),
    responses(
        (status = 200, description = "Got balances", body = Vec<models::Balance>),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_pool_balances_for_member(
    Path(path): Path<PoolBalancesForMemberPath>,
) -> Json<Vec<models::Balance>> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("get_pool_balances_for_member")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let pool_id = path.pool_id;
    let member_id = path.member_id;

    span.set_attribute(KeyValue::new("pool_id", pool_id.to_string()));
    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let expenses = tokio::task::spawn_blocking(move || {
        models::Expense::list_unpaid_for_balance_computation(&mut conn, pool_id)
            .expect("Failed to get balances")
    })
    .await
    .expect("Task panicked");

    span.end();

    return Json(compute_balances_for_member(member_id, expenses));
}

#[derive(Deserialize, Serialize, ToSchema)]
pub struct MembersOfPoolPath {
    pool_id: uuid::Uuid,
    member_id: uuid::Uuid,
}

#[utoipa::path(
    get,
    path = "/api/members/{member_id}/pools/{pool_id}/members",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to fetch members for"),
        ("member_id" = uuid::Uuid, Path, description = "ID of the member to fetch members for")
    ),
    responses(
        (status = 200, description = "List all members of a pool successfully", body = Vec<PoolMembershipWithMemberDetails>),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn list_members_of_pool_handler(
    Path(path): Path<MembersOfPoolPath>,
) -> Json<Vec<PoolMembershipWithMemberDetails>> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("list_members_of_pool_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let pool_id = path.pool_id;

    span.set_attribute(KeyValue::new("pool_id", pool_id.to_string()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let members = tokio::task::spawn_blocking(move || {
        PoolMembership::list(&mut conn, pool_id).expect("Failed to list members of pool")
    })
    .await
    .expect("Task panicked");

    span.end();

    Json(
        members
            .into_iter()
            .map(
                |(pool_membership, member)| PoolMembershipWithMemberDetails {
                    member,
                    pool_membership,
                },
            )
            .collect(),
    )
}

#[utoipa::path(
    get,
    path = "/api/members/{member_id}/pools",
    params(
        ("member_id" = uuid::Uuid, Path, description = "ID of the member to fetch pools for")
    ),
    responses(
        (status = 200, description = "List pools for member", body = Vec<models::Pool>),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn list_pools_for_member_handler(
    Path(member_id): Path<uuid::Uuid>,
) -> Json<Vec<models::Pool>> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("list_pools_for_member_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let pools = tokio::task::spawn_blocking(move || {
        models::Pool::find_by_member_id(&mut conn, member_id)
            .expect("Failed to list pools for member")
    })
    .await
    .expect("Task panicked");

    span.end();

    Json(pools)
}

#[derive(Deserialize, ToSchema)]
pub struct PoolMembershipQuery {
    member_id: uuid::Uuid,
}

#[utoipa::path(
    post,
    path = "/api/pools/{pool_id}/memberships",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to create membership for"),
        ("member_id" = uuid::Uuid, Query, description = "ID of the member to create membership for")
    ),
    responses(
        (status = 200, description = "Create pool membership", body = PoolMembership),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn create_pool_membership_handler(
    Path(pool_id): Path<uuid::Uuid>,
    Query(query): Query<PoolMembershipQuery>,
) -> Json<PoolMembership> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("create_pool_membership_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let member_id = query.member_id;

    span.set_attribute(KeyValue::new("pool_id", pool_id.to_string()));
    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let new_membership = models::NewPoolMembership {
        pool_id: pool_id,
        member_id: member_id,
        role: models::PoolRole::PARTICIPANT,
        default_split_percentage: 0.0,
    };

    let membership = tokio::task::spawn_blocking(move || {
        PoolMembership::create(&mut conn, &new_membership)
            .expect("Failed to create pool membership")
    })
    .await
    .expect("Task panicked");

    span.end();

    Json(membership)
}

#[utoipa::path(
    patch,
    path = "/api/members/{member_id}",
    params(
        ("member_id" = uuid::Uuid, Path, description = "ID of the member to update")
    ),
    request_body = MemberChangeset,
    responses(
        (status = 200, description = "Updated member", body = Member),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn update_member_handler(
    Path(member_id): Path<uuid::Uuid>,
    Json(json): Json<MemberChangeset>,
) -> Json<Member> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("update_member_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let membership = tokio::task::spawn_blocking(move || {
        Member::update(&mut conn, member_id, &json).expect("Failed to create pool membership")
    })
    .await
    .expect("Task panicked");

    span.end();

    Json(membership)
}

pub fn handlers_routes() -> OpenApiRouter {
    let public_routes = OpenApiRouter::new()
        .routes(routes!(signup_handler))
        .routes(routes!(login_handler))
        .routes(routes!(authenticate_handler));

    let protected_routes = OpenApiRouter::new()
        .routes(routes!(get_member_handler))
        .routes(routes!(create_pool_handler))
        .routes(routes!(create_pool_membership_handler))
        .routes(routes!(add_friend_to_pool_handler))
        .routes(routes!(remove_friend_from_pool_handler))
        .routes(routes!(list_friends_handler))
        .routes(routes!(list_inbound_friend_requests_handler))
        .routes(routes!(create_friend_request_handler))
        .routes(routes!(accept_friend_request_handler))
        .routes(routes!(get_expense_handler))
        .routes(routes!(add_expense_handler))
        .routes(routes!(get_pool_details_handler))
        .routes(routes!(get_pool_recent_expenses_handler))
        .routes(routes!(list_members_of_pool_handler))
        .routes(routes!(list_pools_for_member_handler))
        .routes(routes!(delete_friend_request))
        .routes(routes!(get_pool_balances_for_member))
        .routes(routes!(settle_up_pool_handler))
        .routes(routes!(modify_default_splits_handler))
        .routes(routes!(delete_expense_handler))
        .routes(routes!(update_member_handler))
        .route_layer(middleware::from_fn(auth_middleware))
        .route_layer(middleware::from_fn(trace_middleware));

    public_routes.merge(protected_routes)
}
