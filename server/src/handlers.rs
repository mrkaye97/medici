use std::sync::OnceLock;
use std::time::{Duration as BuiltInDuration, SystemTime, UNIX_EPOCH};

use axum::extract::{FromRequestParts, MatchedPath, Query};
use axum::http::{StatusCode, request::Parts};
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
use bcrypt::DEFAULT_COST;
use chrono::{DateTime, Duration, Utc};
use diesel::pg::PgConnection;
use diesel::prelude::Insertable;
use diesel::r2d2::{ConnectionManager, Pool, PooledConnection};
use diesel::{Connection, QueryResult};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use once_cell::sync::Lazy;
use opentelemetry::KeyValue;
use opentelemetry::global::{self, BoxedTracer};
use opentelemetry::trace::noop::NoopTracerProvider;
use opentelemetry::trace::{FutureExt, Span, SpanKind, Status, TraceContextExt, Tracer};
use opentelemetry_otlp::tonic_types::metadata::MetadataMap;
use opentelemetry_otlp::{Protocol, WithExportConfig, WithTonicConfig};
use opentelemetry_sdk::Resource;
use opentelemetry_sdk::trace::{BatchConfigBuilder, BatchSpanProcessor, SdkTracerProvider};
use serde::{Deserialize, Serialize};
use server::models::{
    self, Expense, ExpenseCategory, ExpenseCategoryRule, Friendship, Member, MemberChangeset,
    MemberPassword, NewExpenseCategoryRule, NewExpenseLineItem, NewPool, PoolMembership,
    SplitMethod,
};
use server::{
    PoolAccess, PoolAccessError, check_pool_access, compute_balances_for_member,
    expense_participants_are_pool_members, verify_login,
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

/// How long a session token is valid. Used for both the JWT `exp` claim and
/// the `expires_at` returned to the client so the two can't drift apart.
const SESSION_DURATION_DAYS: i64 = 7;

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
    let authorization_header =
        std::env::var("OTEL_EXPORTER_OTLP_AUTHORIZATION_HEADER").unwrap_or("".to_string());

    if exporter_endpoint.is_empty() {
        let no_op_provider = NoopTracerProvider::new();
        return Ok(MaybeTracerProvider::Noop(no_op_provider));
    }

    let exporter_url = format!("{}/v1/traces", exporter_endpoint);

    let mut metadata = MetadataMap::new();
    metadata.insert("authorization", authorization_header.parse().unwrap());

    let otlp_exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_tonic()
        .with_protocol(Protocol::Grpc)
        .with_endpoint(exporter_url)
        .with_timeout(BuiltInDuration::from_secs(10))
        .with_metadata(metadata)
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

/// Hash a password with bcrypt and a fresh random salt. bcrypt is slow on
/// purpose, so call this from a blocking task, not directly on the runtime.
fn hash_password(password: &str) -> Result<String, bcrypt::BcryptError> {
    bcrypt::hash(password, DEFAULT_COST)
}

type ApiError = (StatusCode, Json<serde_json::Value>);

fn api_error(status: StatusCode, message: &str) -> ApiError {
    (status, Json(serde_json::json!({ "error": message })))
}

/// Confirm the caller has the required access to a pool. Non-members get 404
/// rather than 403 so pool IDs can't be probed.
async fn authorize_pool(
    pool_id: uuid::Uuid,
    member_id: uuid::Uuid,
    required: PoolAccess,
) -> Result<models::PoolRole, ApiError> {
    let mut conn = get_db_connection().await.map_err(|_| {
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to get database connection",
        )
    })?;

    let role = tokio::task::spawn_blocking(move || {
        PoolMembership::find_role(&mut conn, pool_id, member_id)
    })
    .await
    .map_err(|_| api_error(StatusCode::INTERNAL_SERVER_ERROR, "Task panicked"))?
    .map_err(|_| {
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to check pool access",
        )
    })?;

    check_pool_access(role, required).map_err(|e| match e {
        PoolAccessError::NotMember => api_error(StatusCode::NOT_FOUND, "Pool not found"),
        PoolAccessError::NotAdmin => {
            api_error(StatusCode::FORBIDDEN, "Only pool admins can do that")
        }
    })
}

/// Reject an expense whose payer or debtors aren't in the pool.
async fn validate_expense_participants(
    pool_id: uuid::Uuid,
    paid_by_member_id: Option<uuid::Uuid>,
    debtor_member_ids: Vec<uuid::Uuid>,
) -> Result<(), ApiError> {
    let mut conn = get_db_connection().await.map_err(|_| {
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to get database connection",
        )
    })?;

    let member_ids =
        tokio::task::spawn_blocking(move || PoolMembership::member_ids(&mut conn, pool_id))
            .await
            .map_err(|_| api_error(StatusCode::INTERNAL_SERVER_ERROR, "Task panicked"))?
            .map_err(|_| {
                api_error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Failed to load pool members",
                )
            })?;

    let member_ids: std::collections::HashSet<uuid::Uuid> = member_ids.into_iter().collect();

    if expense_participants_are_pool_members(&member_ids, paid_by_member_id, &debtor_member_ids) {
        Ok(())
    } else {
        Err(api_error(
            StatusCode::BAD_REQUEST,
            "Everyone on an expense must be a member of the pool",
        ))
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
}

pub struct AuthenticatedUser(pub uuid::Uuid);

impl<S> FromRequestParts<S> for AuthenticatedUser
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, Json<serde_json::Value>);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let TypedHeader(auth) =
            TypedHeader::<Authorization<Bearer>>::from_request_parts(parts, state)
                .await
                .map_err(|_| {
                    (
                        StatusCode::UNAUTHORIZED,
                        Json(serde_json::json!({
                            "error": "Missing or invalid authorization header"
                        })),
                    )
                })?;

        let user_id = validate_session(auth.token()).await.map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": "Invalid token"
                })),
            )
        })?;

        Ok(AuthenticatedUser(user_id))
    }
}

fn generate_jwt(member_id: uuid::Uuid) -> Result<String, jsonwebtoken::errors::Error> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_secs() as usize;

    let expiration = now + (SESSION_DURATION_DAYS as usize) * 24 * 60 * 60;

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

/// Check a session token: valid signature, not expired, the member still
/// exists, and it was issued after their last password change (so a reset
/// logs out every existing session).
async fn validate_session(token: &str) -> Result<uuid::Uuid, ()> {
    let (member_id, issued_at) = verify_jwt(token).map_err(|_| ())?;

    let mut conn = get_db_connection().await.map_err(|_| ())?;
    let changed_at = tokio::task::spawn_blocking(move || {
        MemberPassword::password_changed_at(&mut conn, member_id)
    })
    .await
    .map_err(|_| ())?
    .map_err(|_| ())?
    .ok_or(())?;

    if server::session_is_current(issued_at as i64, changed_at) {
        Ok(member_id)
    } else {
        Err(())
    }
}

/// Verify a JWT's signature and expiry. Returns the member ID and the time it
/// was issued (seconds since the epoch).
fn verify_jwt(token: &str) -> Result<(uuid::Uuid, usize), jsonwebtoken::errors::Error> {
    let secret = std::env::var("AUTH_SECRET_KEY").expect("AUTH_SECRET_KEY must be set");

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )?;

    let user_id = uuid::Uuid::parse_str(&token_data.claims.sub).map_err(|_| {
        jsonwebtoken::errors::Error::from(jsonwebtoken::errors::ErrorKind::InvalidToken)
    })?;

    Ok((user_id, token_data.claims.iat))
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
    category: ExpenseCategory,
    description: Option<String>,
    split_method: SplitMethod,
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
    path = "/api/pools",
    request_body = PoolInput,
    responses(
        (status = 200, description = "Create a pool successfully", body = models::Pool),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn create_pool_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
    Json(pool_input): Json<PoolInput>,
) -> Result<Json<models::Pool>, (StatusCode, Json<serde_json::Value>)> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("create_pool_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let new_pool = NewPool {
        name: pool_input.name,
        description: pool_input.description,
    };

    let pool = tokio::task::spawn_blocking(move || models::Pool::create(&mut conn, &new_pool))
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Task panicked"})),
            )
        })?
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to create pool"})),
            )
        })?;

    let pool_id = pool.id;

    let new_membership = models::NewPoolMembership {
        pool_id: pool_id,
        member_id: member_id,
        role: models::PoolRole::ADMIN,
        default_split_percentage: 100.0,
    };

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    tokio::task::spawn_blocking(move || PoolMembership::create(&mut conn, &new_membership))
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Task panicked"})),
            )
        })?
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to create pool membership"})),
            )
        })?;

    span.end();

    Ok(Json(pool))
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
        (status = 404, description = "Pool or member not found"),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn add_friend_to_pool_handler(
    AuthenticatedUser(caller_id): AuthenticatedUser,
    Path(pool_id): Path<uuid::Uuid>,
    Json(input): Json<PoolMembershipInput>,
) -> Result<Json<PoolMembership>, (StatusCode, Json<serde_json::Value>)> {
    authorize_pool(pool_id, caller_id, PoolAccess::Admin).await?;
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("add_friend_to_pool_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("pool_id", pool_id.to_string()));
    span.set_attribute(KeyValue::new("member_id", input.member_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let new_member_id = input.member_id;
    let result = tokio::task::spawn_blocking(move || {
        if !Friendship::are_friends(&mut conn, caller_id, new_member_id)? {
            return Ok(None);
        }

        PoolMembership::add_member(&mut conn, pool_id, new_member_id).map(Some)
    })
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Task panicked"})),
        )
    })?;

    span.end();

    match result {
        Ok(Some(membership)) => Ok(Json(membership)),
        Ok(None) => Err(api_error(
            StatusCode::FORBIDDEN,
            "You can only add your friends to a pool",
        )),
        Err(diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UniqueViolation,
            _,
        )) => Err(api_error(
            StatusCode::CONFLICT,
            "That person is already in this pool",
        )),
        Err(_) => Err(api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to add friend to pool",
        )),
    }
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
    AuthenticatedUser(caller_id): AuthenticatedUser,
    Path(path): Path<RemoveFriendFromPoolPath>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    authorize_pool(path.pool_id, caller_id, PoolAccess::Admin).await?;

    if path.member_id == caller_id {
        // An admin removing themselves could leave the pool with no admin.
        return Err(api_error(
            StatusCode::BAD_REQUEST,
            "You can't remove yourself from a pool",
        ));
    }

    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("remove_friend_from_pool_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let pool_id = path.pool_id;
    let member_id = path.member_id;

    span.set_attribute(KeyValue::new("pool_id", pool_id.to_string()));
    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let result = tokio::task::spawn_blocking(move || {
        PoolMembership::remove_member(&mut conn, pool_id, member_id, caller_id)
    })
    .await
    .map_err(|_| api_error(StatusCode::INTERNAL_SERVER_ERROR, "Task panicked"))?;

    span.end();

    match result {
        Ok(()) => Ok(Json(serde_json::json!({"success": true}))),
        Err(models::RemoveMemberError::NotAMember) => Err(api_error(
            StatusCode::NOT_FOUND,
            "That person isn't in this pool",
        )),
        Err(models::RemoveMemberError::OutstandingBalance) => Err(api_error(
            StatusCode::CONFLICT,
            "This member still has an unsettled balance. Settle up before removing them.",
        )),
        Err(models::RemoveMemberError::Database(e)) => {
            tracing::error!("Failed to remove pool member: {}", e);
            Err(api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to remove member from pool",
            ))
        }
    }
}

#[utoipa::path(
    get,
    path = "/api/members/me",
    responses(
        (status = 200, description = "Get a member successfully", body = Member),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_member_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
) -> Result<Json<Member>, (StatusCode, Json<serde_json::Value>)> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("get_member_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let member = tokio::task::spawn_blocking(move || Member::find(&mut conn, member_id))
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Task panicked"})),
            )
        })?;

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

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(AuthResult::Unauthenticated {
                id: None,
                token: None,
                is_authenticated: false,
                expires_at: None,
            }),
        )
    })?;
    let email = input.email;
    let password = input.password;

    let result = tokio::task::spawn_blocking(move || {
        let unauthenticated = AuthResult::Unauthenticated {
            id: None,
            token: None,
            is_authenticated: false,
            expires_at: None,
        };

        let stored = match Member::find_password_hash_by_email(&mut conn, &email) {
            Ok(stored) => stored,
            Err(_) => return unauthenticated,
        };

        match verify_login(&password, stored).map(|id| (id, generate_jwt(id))) {
            Some((id, Ok(token))) => AuthResult::Authenticated {
                id,
                token,
                is_authenticated: true,
                expires_at: Utc::now() + Duration::days(SESSION_DURATION_DAYS),
            },
            _ => unauthenticated,
        }
    })
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(AuthResult::Unauthenticated {
                id: None,
                token: None,
                is_authenticated: false,
                expires_at: None,
            }),
        )
    })?;

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

    let result = match validate_session(&token).await {
        Ok(token_member_id) => {
            if token_member_id == member_id {
                match generate_jwt(member_id) {
                    Ok(new_token) => Json(AuthResult::Authenticated {
                        id: member_id,
                        token: new_token,
                        is_authenticated: true,
                        expires_at: Utc::now() + Duration::days(SESSION_DURATION_DAYS),
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
    path = "/api/friends",
    responses(
        (status = 200, description = "List friends of a member successfully", body = Vec<Member>),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn list_friends_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
) -> Result<Json<Vec<Member>>, (StatusCode, Json<serde_json::Value>)> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("list_friends_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let friends =
        tokio::task::spawn_blocking(move || Friendship::get_friends(&mut conn, member_id))
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "Task panicked"})),
                )
            })?
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "Failed to list friends"})),
                )
            })?;

    span.end();

    Ok(Json(friends))
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
    path = "/api/friend-requests",
    responses(
        (status = 200, description = "List inbound friend requests of a member successfully", body = Vec<FriendRequestsList>),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn list_inbound_friend_requests_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
) -> Result<Json<Vec<FriendRequestsList>>, (StatusCode, Json<serde_json::Value>)> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("list_inbound_friend_requests_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let requests =
        tokio::task::spawn_blocking(move || Friendship::get_pending_requests(&mut conn, member_id))
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "Task panicked"})),
                )
            })?
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "Failed to list friend requests"})),
                )
            })?
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

    Ok(Json(requests))
}

/// The public part of a member that someone looking them up gets to see.
#[derive(Serialize, ToSchema, Debug)]
pub struct MemberSummary {
    id: uuid::Uuid,
    first_name: String,
    last_name: String,
    email: String,
}

impl From<Member> for MemberSummary {
    fn from(m: Member) -> Self {
        Self {
            id: m.id,
            first_name: m.first_name,
            last_name: m.last_name,
            email: m.email,
        }
    }
}

#[derive(Serialize, ToSchema, Debug)]
pub struct FriendRequestResponse {
    outcome: models::FriendRequestOutcome,
    member: MemberSummary,
}

#[utoipa::path(
    post,
    path = "/api/friend-requests",
    request_body = FriendRequestInput,
    responses(
        (status = 200, description = "What happened: request sent, accepted their pending request, or nothing to do", body = FriendRequestResponse),
        (status = 400, description = "Tried to add yourself"),
        (status = 404, description = "No account with that email"),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn create_friend_request_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
    Json(input): Json<FriendRequestInput>,
) -> Result<Json<FriendRequestResponse>, ApiError> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("create_friend_request_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to get database connection",
        )
    })?;
    let friend_email = input.friend_email;

    let result = tokio::task::spawn_blocking(move || {
        Friendship::send_request_by_email(&mut conn, member_id, &friend_email)
    })
    .await
    .map_err(|_| api_error(StatusCode::INTERNAL_SERVER_ERROR, "Task panicked"))?;

    span.end();

    match result {
        Ok((member, outcome)) => Ok(Json(FriendRequestResponse {
            outcome,
            member: member.into(),
        })),
        Err(models::SendFriendRequestError::NotFound) => Err(api_error(
            StatusCode::NOT_FOUND,
            "No Medici account uses that email",
        )),
        Err(models::SendFriendRequestError::Yourself) => {
            Err(api_error(StatusCode::BAD_REQUEST, "That's your own email"))
        }
        Err(models::SendFriendRequestError::Database(e)) => {
            tracing::error!("Failed to create friend request: {}", e);
            Err(api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to send friend request",
            ))
        }
    }
}

#[derive(Deserialize, ToSchema)]
pub struct MemberLookupQuery {
    email: String,
}

#[derive(Serialize, ToSchema, Debug)]
pub struct MemberLookupResponse {
    /// `null` when no account uses the email.
    member: Option<MemberSummary>,
    /// `null` when no account uses the email.
    relationship: Option<server::Relationship>,
}

#[utoipa::path(
    get,
    path = "/api/members/lookup",
    params(
        ("email" = String, Query, description = "Email to look up (case-insensitive)")
    ),
    responses(
        (status = 200, description = "Who uses this email, and how they relate to you", body = MemberLookupResponse),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn lookup_member_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
    Query(query): Query<MemberLookupQuery>,
) -> Result<Json<MemberLookupResponse>, ApiError> {
    let mut conn = get_db_connection().await.map_err(|_| {
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to get database connection",
        )
    })?;

    let result = tokio::task::spawn_blocking(move || -> QueryResult<MemberLookupResponse> {
        let Some(other) = Member::find_by_email(&mut conn, &query.email)? else {
            return Ok(MemberLookupResponse {
                member: None,
                relationship: None,
            });
        };

        let friendship = Friendship::find_between(&mut conn, member_id, other.id)?;
        let relationship = server::relationship_between(
            member_id,
            other.id,
            friendship.map(|f| (f.inviting_member_id, f.status)),
        );

        Ok(MemberLookupResponse {
            member: Some(other.into()),
            relationship: Some(relationship),
        })
    })
    .await
    .map_err(|_| api_error(StatusCode::INTERNAL_SERVER_ERROR, "Task panicked"))?
    .map_err(|_| api_error(StatusCode::INTERNAL_SERVER_ERROR, "Failed to look up email"))?;

    Ok(Json(result))
}

#[derive(Deserialize, ToSchema)]
pub struct AcceptFriendRequestPath {
    friend_member_id: uuid::Uuid,
}

#[utoipa::path(
    post,
    path = "/api/friend-requests/{friend_member_id}/accept",
    params(
        ("friend_member_id" = uuid::Uuid, Path, description = "ID of the friend to accept request from")
    ),
    responses(
        (status = 200, description = "Accept a friend request successfully", body = serde_json::Value),
        (status = 404, description = "Friend request not found"),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn accept_friend_request_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
    Path(path): Path<AcceptFriendRequestPath>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("accept_friend_request_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let friend_member_id = path.friend_member_id;

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));
    span.set_attribute(KeyValue::new(
        "friend_member_id",
        friend_member_id.to_string(),
    ));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;
    let result = tokio::task::spawn_blocking(move || {
        Friendship::update_status(
            &mut conn,
            friend_member_id,
            member_id,
            models::FriendshipStatus::Accepted,
        )
    })
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Task panicked"})),
        )
    })?;

    span.end();

    match result {
        Ok(friendship) => Ok(Json(
            serde_json::json!({"success": true, "friendship": friendship}),
        )),
        Err(diesel::result::Error::NotFound) => Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Friend request not found"})),
        )),
        Err(_) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to accept friend request"})),
        )),
    }
}

#[utoipa::path(
    delete,
    path = "/api/friend-requests/{friend_member_id}",
    params(
        ("friend_member_id" = uuid::Uuid, Path, description = "ID of the friend request to delete")
    ),
    responses(
        (status = 200, description = "Delete a friend request successfully", body = serde_json::Value),
        (status = 404, description = "Friend request not found"),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn delete_friend_request(
    AuthenticatedUser(member_id): AuthenticatedUser,
    Path(path): Path<AcceptFriendRequestPath>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("delete_friend_request")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let friend_member_id = path.friend_member_id;

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));
    span.set_attribute(KeyValue::new(
        "friend_member_id",
        friend_member_id.to_string(),
    ));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;
    // Either direction: declines a request you received or cancels one you
    // sent. Previously only the "received" direction matched, so cancelling
    // a sent request silently did nothing.
    let result = tokio::task::spawn_blocking(move || {
        Friendship::delete_pending_between(&mut conn, member_id, friend_member_id)
    })
    .await
    .map_err(|_| api_error(StatusCode::INTERNAL_SERVER_ERROR, "Task panicked"))?;

    span.end();

    match result {
        Ok(0) => Err(api_error(StatusCode::NOT_FOUND, "Friend request not found")),
        Ok(_) => Ok(Json(serde_json::json!({"success": true}))),
        Err(_) => Err(api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to delete friend request",
        )),
    }
}

#[derive(Deserialize, ToSchema)]
pub struct ExpensePath {
    pool_id: uuid::Uuid,
    expense_id: uuid::Uuid,
}

#[utoipa::path(
    get,
    path = "/api/pools/{pool_id}/expenses/{expense_id}",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to fetch expenses for"),
        ("expense_id" = uuid::Uuid, Path, description = "ID of the expense to fetch")
    ),
    responses(
        (status = 200, description = "Get expenses", body = models::ExpenseWithLineItems),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_expense_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
    Path(path): Path<ExpensePath>,
) -> Result<Json<models::ExpenseWithLineItems>, (StatusCode, Json<serde_json::Value>)> {
    authorize_pool(path.pool_id, member_id, PoolAccess::Member).await?;

    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("get_expense_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));
    span.set_attribute(KeyValue::new("pool_id", path.pool_id.to_string()));
    span.set_attribute(KeyValue::new("expense_id", path.expense_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let expense = tokio::task::spawn_blocking(move || {
        models::Expense::find_with_line_items(
            &mut conn,
            path.expense_id,
            member_id,
            path.pool_id,
            false,
        )
        .or_else(|_| {
            models::Expense::find_with_line_items(
                &mut conn,
                path.expense_id,
                member_id,
                path.pool_id,
                true,
            )
        })
    })
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Task panicked"})),
        )
    })?;

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
    path = "/api/pools/{pool_id}/expenses/{expense_id}",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to delete the expense for"),
        ("expense_id" = uuid::Uuid, Path, description = "ID of the expense to delete")
    ),
    responses(
        (status = 200, description = "The deleted expense", body = models::Expense),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn delete_expense_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
    Path(path): Path<ExpensePath>,
) -> Result<Json<models::Expense>, (StatusCode, Json<serde_json::Value>)> {
    authorize_pool(path.pool_id, member_id, PoolAccess::Member).await?;

    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("delete_expense_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));
    span.set_attribute(KeyValue::new("pool_id", path.pool_id.to_string()));
    span.set_attribute(KeyValue::new("expense_id", path.expense_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let expense = tokio::task::spawn_blocking(move || {
        models::Expense::delete(&mut conn, path.expense_id, path.pool_id, false)
    })
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Task panicked"})),
        )
    })?;

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

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    server::validate_new_password(&input.password)
        .map_err(|msg| api_error(StatusCode::BAD_REQUEST, &msg))?;

    let password = input.password;
    let new_member = models::NewMember {
        first_name: input.first_name.trim().to_string(),
        last_name: input.last_name.trim().to_string(),
        email: server::normalize_email(&input.email),
        bio: None,
    };

    let member = tokio::task::spawn_blocking(move || -> Result<Member, SignupError> {
        // Checked case-insensitively, so older mixed-case emails also count.
        if Member::find_by_email(&mut conn, &new_member.email)?.is_some() {
            return Err(SignupError::EmailTaken);
        }

        let password_hash = hash_password(&password)?;

        let member = conn.transaction::<_, diesel::result::Error, _>(|conn| {
            let member = Member::create(conn, &new_member)?;

            MemberPassword::create(
                conn,
                &models::NewMemberPassword {
                    member_id: member.id,
                    password_hash,
                },
            )?;

            Ok(member)
        })?;

        Ok(member)
    })
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Task panicked"})),
        )
    })?;

    span.end();

    match member {
        Ok(m) => match generate_jwt(m.id) {
            Ok(token) => Ok(Json(AuthResult::Authenticated {
                id: m.id,
                token,
                is_authenticated: true,
                expires_at: Utc::now() + Duration::days(SESSION_DURATION_DAYS),
            })),
            Err(_) => Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to generate token"})),
            )),
        },
        Err(SignupError::EmailTaken)
        | Err(SignupError::Database(diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UniqueViolation,
            _,
        ))) => Err(api_error(
            StatusCode::CONFLICT,
            "An account with that email already exists",
        )),
        Err(_) => Err(api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to create account",
        )),
    }
}

enum SignupError {
    EmailTaken,
    Database(diesel::result::Error),
    Hash,
}

impl From<diesel::result::Error> for SignupError {
    fn from(e: diesel::result::Error) -> Self {
        Self::Database(e)
    }
}

impl From<bcrypt::BcryptError> for SignupError {
    fn from(_: bcrypt::BcryptError) -> Self {
        Self::Hash
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
pub async fn add_expense_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
    Path(pool_id): Path<uuid::Uuid>,
    Json(input): Json<ExpenseInput>,
) -> Result<Json<models::Expense>, (StatusCode, Json<serde_json::Value>)> {
    // The URL decides which pool this is; the body's pool_id must agree.
    if input.pool_id != pool_id {
        return Err(api_error(
            StatusCode::BAD_REQUEST,
            "pool_id in the body does not match the URL",
        ));
    }

    authorize_pool(pool_id, member_id, PoolAccess::Member).await?;
    validate_expense_participants(
        pool_id,
        Some(input.paid_by_member_id),
        input
            .line_items
            .iter()
            .map(|li| li.debtor_member_id)
            .collect(),
    )
    .await?;

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

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let new_expense = models::NewExpense {
        name: input.name,
        amount: input.amount,
        is_settled: false,
        pool_id: input.pool_id,
        paid_by_member_id: input.paid_by_member_id,
        description: input.description,
        notes: None,
        category: input.category,
        split_method: input.split_method,
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
    })
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Task panicked"})),
        )
    })?
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to create expense with line items"})),
        )
    })?;

    span.end();

    Ok(Json(expense))
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateExpenseInput {
    name: Option<String>,
    amount: Option<f64>,
    line_items: Option<Vec<ExpenseLineItem>>,
    category: Option<ExpenseCategory>,
    description: Option<String>,
    is_settled: Option<bool>,
    split_method: Option<SplitMethod>,
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateExpensePath {
    pool_id: uuid::Uuid,
    expense_id: uuid::Uuid,
}

#[utoipa::path(
    patch,
    path = "/api/pools/{pool_id}/expenses/{expense_id}",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to update expense for"),
        ("expense_id" = uuid::Uuid, Path, description = "ID of the expense to update")
    ),
    request_body = UpdateExpenseInput,
    responses(
        (status = 200, description = "Create expense", body = Expense),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn update_expense_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
    Path(path): Path<UpdateExpensePath>,
    Json(input): Json<UpdateExpenseInput>,
) -> Result<Json<models::Expense>, (StatusCode, Json<serde_json::Value>)> {
    authorize_pool(path.pool_id, member_id, PoolAccess::Member).await?;

    if let Some(line_items) = &input.line_items {
        validate_expense_participants(
            path.pool_id,
            None,
            line_items.iter().map(|li| li.debtor_member_id).collect(),
        )
        .await?;
    }

    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("update_expense_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("pool_id", path.pool_id.to_string()));
    span.set_attribute(KeyValue::new("expense_id", path.expense_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let result = tokio::task::spawn_blocking(move || {
        conn.build_transaction().run(|tx| {
            let changeset = models::ExpenseChangeset {
                name: input.name,
                amount: input.amount,
                is_settled: input.is_settled,
                description: input.description,
                notes: None,
                category: input.category,
                split_method: input.split_method,
            };

            // Filtered by pool, so an expense ID from another pool is "not found".
            let updated_expense = Expense::update(tx, &path.expense_id, &path.pool_id, &changeset)?;

            // Only replace line items when new ones were sent. Previously they
            // were always deleted, so an update without line_items wiped them.
            if let Some(line_items) = &input.line_items {
                models::ExpenseLineItem::delete_by_expense_id(tx, path.expense_id)?;

                let new_line_items: Vec<NewExpenseLineItem> = line_items
                    .iter()
                    .map(|line_item| NewExpenseLineItem {
                        expense_id: path.expense_id,
                        is_settled: false,
                        amount: line_item.amount,
                        debtor_member_id: line_item.debtor_member_id,
                    })
                    .collect();

                models::ExpenseLineItem::bulk_create(tx, &new_line_items)?;
            }

            Ok::<_, diesel::result::Error>(updated_expense)
        })
    })
    .await
    .map_err(|_| api_error(StatusCode::INTERNAL_SERVER_ERROR, "Task panicked"))?;

    span.end();

    match result {
        Ok(expense) => Ok(Json(expense)),
        Err(diesel::result::Error::NotFound) => {
            Err(api_error(StatusCode::NOT_FOUND, "Expense not found"))
        }
        Err(e) => {
            tracing::error!("Failed to update expense: {}", e);
            Err(api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to update expense",
            ))
        }
    }
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
    pool_id: uuid::Uuid,
}

#[utoipa::path(
    get,
    path = "/api/pools/{pool_id}",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to fetch details for")
    ),
    responses(
        (status = 200, description = "Create expense", body = PoolDetails),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_pool_details_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
    Path(path): Path<PoolDetailsPath>,
) -> Result<Json<PoolDetails>, (StatusCode, Json<serde_json::Value>)> {
    authorize_pool(path.pool_id, member_id, PoolAccess::Member).await?;

    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("get_pool_details_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let pool_id = path.pool_id;

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));
    span.set_attribute(KeyValue::new("pool_id", pool_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let pool_details = tokio::task::spawn_blocking(move || {
        models::Pool::get_with_debt_for_member(&mut conn, pool_id, member_id)
    })
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Task panicked"})),
        )
    })?
    .map_err(|e| match e {
        diesel::result::Error::NotFound => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Pool not found"})),
        ),
        _ => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get pool details"})),
        ),
    })?;

    let details = PoolDetails {
        pool: pool_details.0,
        role: pool_details.1,
        total_debt: pool_details.2,
    };

    span.end();

    Ok(Json(details))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct TogglePoolHiddenRequestBody {
    pub is_hidden: bool,
}

#[derive(Serialize, ToSchema)]
pub struct GenericPostSuccessResponse {
    pub success: bool,
}

#[utoipa::path(
    post,
    path = "/api/pools/{pool_id}/toggle-hidden",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to fetch details for")
    ),
    request_body = TogglePoolHiddenRequestBody,
    responses(
        (status = 200, description = "Toggle pool hidden", body = GenericPostSuccessResponse),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn toggle_pool_hidden_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
    Path(path): Path<PoolDetailsPath>,
    Json(input): Json<TogglePoolHiddenRequestBody>,
) -> Result<Json<PoolDetails>, (StatusCode, Json<serde_json::Value>)> {
    authorize_pool(path.pool_id, member_id, PoolAccess::Member).await?;

    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("get_pool_details_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let pool_id = path.pool_id;

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));
    span.set_attribute(KeyValue::new("pool_id", pool_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let update = tokio::task::spawn_blocking(move || {
        models::Pool::toggle_hide(&mut conn, pool_id, input.is_hidden)
    });

    match update.await {
        Ok(Ok(_)) => {
            span.end();
            get_pool_details_handler(AuthenticatedUser(member_id), Path(path)).await
        }
        Ok(Err(_)) | Err(_) => {
            span.end();
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to toggle pool hidden"})),
            ))
        }
    }
}

#[utoipa::path(
    patch,
    path = "/api/pools/{pool_id}/settle-up",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to settle up")
    ),
    responses(
        (status = 200, description = "Pool settled up", body = PoolDetails),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn settle_up_pool_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
    Path(path): Path<PoolDetailsPath>,
) -> Result<Json<PoolDetails>, (StatusCode, Json<serde_json::Value>)> {
    authorize_pool(path.pool_id, member_id, PoolAccess::Member).await?;

    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("settle_up_pool_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let pool_id = path.pool_id;

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));
    span.set_attribute(KeyValue::new("pool_id", pool_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    tokio::task::spawn_blocking(move || models::Pool::settle_up(&mut conn, pool_id, member_id))
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to settle up pool"})),
            )
        })?;

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let pool_details = tokio::task::spawn_blocking(move || {
        models::Pool::get_with_debt_for_member(&mut conn, pool_id, member_id)
    })
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Task panicked"})),
        )
    })?
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get pool details"})),
        )
    })?;

    let details = PoolDetails {
        pool: pool_details.0,
        role: pool_details.1,
        total_debt: pool_details.2,
    };

    span.end();

    Ok(Json(details))
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
    path = "/api/pools/{pool_id}/default-splits",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to modify default split percentages for")
    ),
    request_body = ModifyDefaultSplitInput,
    responses(
        (status = 200, description = "Default splits modified", body = Vec<PoolMembershipWithMemberDetails>),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn modify_default_splits_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
    Path(path): Path<PoolDetailsPath>,
    Json(input): Json<ModifyDefaultSplitInput>,
) -> Result<Json<Vec<PoolMembershipWithMemberDetails>>, (StatusCode, Json<serde_json::Value>)> {
    authorize_pool(path.pool_id, member_id, PoolAccess::Admin).await?;

    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("modify_default_splits_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let pool_id = path.pool_id;

    span.set_attribute(KeyValue::new("pool_id", pool_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    tokio::task::spawn_blocking(move || {
        models::PoolMembership::update_default_split_percentage(
            &mut conn,
            pool_id,
            input.default_split_percentages,
        )
    })
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Task panicked"})),
        )
    })?
    .map_err(|e| match e {
        models::UpdateSplitsError::Invalid(reason) => {
            api_error(StatusCode::BAD_REQUEST, &reason.to_string())
        }
        models::UpdateSplitsError::Database(e) => {
            tracing::error!("Failed to update default splits: {}", e);
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to update default split percentages",
            )
        }
    })?;

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let members = tokio::task::spawn_blocking(move || PoolMembership::list(&mut conn, pool_id))
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Task panicked"})),
            )
        })?
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to list members of pool"})),
            )
        })?;

    span.end();

    Ok(Json(
        members
            .into_iter()
            .map(
                |(pool_membership, member)| PoolMembershipWithMemberDetails {
                    member,
                    pool_membership,
                },
            )
            .collect(),
    ))
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
}

#[utoipa::path(
    get,
    path = "/api/pools/{pool_id}/expenses",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to fetch expenses for"),
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
    AuthenticatedUser(member_id): AuthenticatedUser,
    Path(path): Path<RecentExpensesPath>,
    Query(query): Query<RecentExpensesQuery>,
) -> Result<Json<Vec<RecentExpenseDetails>>, (StatusCode, Json<serde_json::Value>)> {
    authorize_pool(path.pool_id, member_id, PoolAccess::Member).await?;

    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("get_pool_recent_expenses_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let limit = query.limit.unwrap_or(5);
    let since = query
        .since
        .unwrap_or_else(|| Utc::now() - chrono::Duration::days(365));
    let until = query.until.unwrap_or_else(|| Utc::now());

    span.set_attribute(KeyValue::new("pool_id", path.pool_id.to_string()));
    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));
    span.set_attribute(KeyValue::new("limit", limit.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let expenses = tokio::task::spawn_blocking(move || {
        models::Expense::get_recent_for_member_in_pool(
            &mut conn,
            path.pool_id,
            member_id,
            limit,
            query.category,
            query.paid_by_member_id,
            query.is_settled,
            since,
            until,
        )
    })
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Task panicked"})),
        )
    })?
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get recent expenses"})),
        )
    })?;

    span.end();

    Ok(Json(
        expenses
            .into_iter()
            .map(|(expense, line_amount)| RecentExpenseDetails {
                expense,
                line_amount,
            })
            .collect(),
    ))
}

#[derive(Deserialize, ToSchema)]
pub struct PoolBalancesForMemberPath {
    pool_id: uuid::Uuid,
}

#[utoipa::path(
    get,
    path = "/api/pools/{pool_id}/balances",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to fetch balances for")
    ),
    responses(
        (status = 200, description = "Got balances", body = Vec<models::Balance>),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_pool_balances_for_member(
    AuthenticatedUser(member_id): AuthenticatedUser,
    Path(path): Path<PoolBalancesForMemberPath>,
) -> Result<Json<Vec<models::Balance>>, (StatusCode, Json<serde_json::Value>)> {
    authorize_pool(path.pool_id, member_id, PoolAccess::Member).await?;

    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("get_pool_balances_for_member")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let pool_id = path.pool_id;

    span.set_attribute(KeyValue::new("pool_id", pool_id.to_string()));
    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let expenses = tokio::task::spawn_blocking(move || {
        models::Expense::list_unpaid_for_balance_computation(&mut conn, pool_id)
    })
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Task panicked"})),
        )
    })?
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get balances"})),
        )
    })?;

    span.end();

    return Ok(Json(compute_balances_for_member(member_id, expenses)));
}

#[derive(Deserialize, Serialize, ToSchema)]
pub struct MembersOfPoolPath {
    pool_id: uuid::Uuid,
}

#[utoipa::path(
    get,
    path = "/api/pools/{pool_id}/members",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to fetch members for")
    ),
    responses(
        (status = 200, description = "List all members of a pool successfully", body = Vec<PoolMembershipWithMemberDetails>),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn list_members_of_pool_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
    Path(path): Path<MembersOfPoolPath>,
) -> Result<Json<Vec<PoolMembershipWithMemberDetails>>, (StatusCode, Json<serde_json::Value>)> {
    authorize_pool(path.pool_id, member_id, PoolAccess::Member).await?;

    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("list_members_of_pool_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    let pool_id = path.pool_id;

    span.set_attribute(KeyValue::new("pool_id", pool_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let members = tokio::task::spawn_blocking(move || PoolMembership::list(&mut conn, pool_id))
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Task panicked"})),
            )
        })?
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to list members of pool"})),
            )
        })?;

    span.end();

    Ok(Json(
        members
            .into_iter()
            .map(
                |(pool_membership, member)| PoolMembershipWithMemberDetails {
                    member,
                    pool_membership,
                },
            )
            .collect(),
    ))
}

#[utoipa::path(
    get,
    path = "/api/pools",
    responses(
        (status = 200, description = "List pools for member", body = Vec<models::Pool>),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn list_pools_for_member_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
) -> Result<Json<Vec<models::Pool>>, (StatusCode, Json<serde_json::Value>)> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("list_pools_for_member_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let pools =
        tokio::task::spawn_blocking(move || models::Pool::find_by_member_id(&mut conn, member_id))
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "Task panicked"})),
                )
            })?
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "Failed to list pools for member"})),
                )
            })?;

    span.end();

    Ok(Json(pools))
}

#[utoipa::path(
    patch,
    path = "/api/members/me",
    request_body = MemberChangeset,
    responses(
        (status = 200, description = "Updated member", body = Member),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn update_member_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
    Json(mut json): Json<MemberChangeset>,
) -> Result<Json<Member>, (StatusCode, Json<serde_json::Value>)> {
    json.email = json.email.as_deref().map(server::normalize_email);

    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("update_member_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let membership =
        tokio::task::spawn_blocking(move || Member::update(&mut conn, member_id, &json))
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "Task panicked"})),
                )
            })?
            .map_err(|e| match e {
                diesel::result::Error::DatabaseError(
                    diesel::result::DatabaseErrorKind::UniqueViolation,
                    _,
                ) => api_error(
                    StatusCode::CONFLICT,
                    "An account with that email already exists",
                ),
                _ => api_error(StatusCode::INTERNAL_SERVER_ERROR, "Failed to update member"),
            })?;

    span.end();

    Ok(Json(membership))
}

#[utoipa::path(
    get,
    path = "/api/rules",
    responses(
        (status = 200, description = "Got rules", body = Vec<ExpenseCategoryRule>),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn list_expense_category_rules_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
) -> Result<Json<Vec<ExpenseCategoryRule>>, (StatusCode, Json<serde_json::Value>)> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("list_expense_category_rules_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let rules = tokio::task::spawn_blocking(move || {
        ExpenseCategoryRule::find_for_member(&mut conn, member_id)
    })
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Task panicked"})),
        )
    })?
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to list expense category rules"})),
        )
    })?;

    span.end();

    Ok(Json(rules))
}

#[utoipa::path(
    post,
    path = "/api/rules",
    request_body = NewExpenseCategoryRule,
    responses(
        (status = 200, description = "Successfully created rule", body = ExpenseCategoryRule),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn create_expense_category_rule_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
    Json(rule): Json<NewExpenseCategoryRule>,
) -> Result<Json<ExpenseCategoryRule>, (StatusCode, Json<serde_json::Value>)> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("list_expense_category_rules_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let rule = tokio::task::spawn_blocking(move || {
        ExpenseCategoryRule::create(&mut conn, &member_id, &rule)
    })
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Task panicked"})),
        )
    })?
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to create expense category rule"})),
        )
    })?;

    span.end();

    Ok(Json(rule))
}

#[derive(Deserialize, ToSchema)]
pub struct DeleteExpenseCategoryRuleQuery {
    rule: String,
    category: ExpenseCategory,
}

#[utoipa::path(
    delete,
    path = "/api/rules",
    params(
        ("rule" = String, Query, description = "The rule to delete"),
        ("category" = ExpenseCategory, Query, description = "The category of the rule to delete"),
    ),
    responses(
        (status = 200, description = "Successfully deleted rule", body = ExpenseCategoryRule),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn delete_expense_category_rule_handler(
    AuthenticatedUser(member_id): AuthenticatedUser,
    Query(query): Query<DeleteExpenseCategoryRuleQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let tracer = get_tracer();

    let mut span = tracer
        .span_builder("list_expense_category_rules_handler")
        .with_kind(SpanKind::Server)
        .start(tracer);

    span.set_attribute(KeyValue::new("member_id", member_id.to_string()));

    let mut conn = get_db_connection().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get database connection"})),
        )
    })?;

    let count = tokio::task::spawn_blocking(move || {
        ExpenseCategoryRule::delete(&mut conn, &member_id, &query.rule, query.category)
    })
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Task panicked"})),
        )
    })?
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to delete expense category rule"})),
        )
    })?;

    span.end();

    Ok(Json(serde_json::json!({"deleted": count})))
}

#[derive(Serialize, ToSchema)]
pub struct PasswordResetConfig {
    /// Whether "Forgot password?" should be offered (email is configured).
    enabled: bool,
}

#[utoipa::path(
    get,
    path = "/api/password-reset/config",
    responses(
        (status = 200, description = "Whether password reset by email is available", body = PasswordResetConfig)
    )
)]
pub async fn password_reset_config_handler() -> Json<PasswordResetConfig> {
    Json(PasswordResetConfig {
        enabled: crate::email::config().is_some(),
    })
}

#[derive(Deserialize, ToSchema)]
pub struct PasswordResetRequestInput {
    email: String,
}

#[utoipa::path(
    post,
    path = "/api/password-reset/request",
    request_body = PasswordResetRequestInput,
    responses(
        (status = 200, description = "Accepted. The response is the same whether or not the email has an account", body = GenericPostSuccessResponse),
        (status = 503, description = "Password reset by email isn't configured on this server")
    )
)]
pub async fn request_password_reset_handler(
    Json(input): Json<PasswordResetRequestInput>,
) -> Result<Json<GenericPostSuccessResponse>, ApiError> {
    let Some(config) = crate::email::config() else {
        return Err(api_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Password reset by email isn't set up on this server",
        ));
    };

    // Do the work in the background and answer right away, so neither the
    // response nor its timing reveals whether the email has an account.
    tokio::spawn(async move {
        let Ok(mut conn) = get_db_connection().await else {
            tracing::error!("Password reset: failed to get database connection");
            return;
        };

        let issued = tokio::task::spawn_blocking(move || {
            models::PasswordResetToken::issue(&mut conn, &input.email, true)
        })
        .await;

        let (member, token) = match issued {
            Ok(Ok(Some(issued))) => issued,
            Ok(Ok(None)) => return,
            Ok(Err(e)) => {
                tracing::error!("Password reset: failed to issue token: {}", e);
                return;
            }
            Err(_) => {
                tracing::error!("Password reset: task panicked");
                return;
            }
        };

        let link = crate::email::password_reset_link(config.app_url(), &token);
        let name = format!("{} {}", member.first_name, member.last_name);

        match crate::email::send_password_reset(config, &name, &member.email, &link).await {
            Ok(()) => tracing::info!("Password reset email sent for member {}", member.id),
            Err(e) => tracing::error!(
                "Password reset: failed to send email for member {}: {}",
                member.id,
                e
            ),
        }
    });

    Ok(Json(GenericPostSuccessResponse { success: true }))
}

#[derive(Deserialize, ToSchema)]
pub struct PasswordResetConfirmInput {
    token: String,
    new_password: String,
}

#[utoipa::path(
    post,
    path = "/api/password-reset/confirm",
    request_body = PasswordResetConfirmInput,
    responses(
        (status = 200, description = "Password changed; logged in with a new session", body = AuthResult),
        (status = 400, description = "Link invalid or expired, or password too weak")
    )
)]
pub async fn confirm_password_reset_handler(
    Json(input): Json<PasswordResetConfirmInput>,
) -> Result<Json<AuthResult>, ApiError> {
    server::validate_new_password(&input.new_password)
        .map_err(|msg| api_error(StatusCode::BAD_REQUEST, &msg))?;

    let mut conn = get_db_connection().await.map_err(|_| {
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to get database connection",
        )
    })?;

    let result = tokio::task::spawn_blocking(move || -> anyhow::Result<Option<uuid::Uuid>> {
        let password_hash = hash_password(&input.new_password)?;
        Ok(models::PasswordResetToken::consume(
            &mut conn,
            &input.token,
            &password_hash,
        )?)
    })
    .await
    .map_err(|_| api_error(StatusCode::INTERNAL_SERVER_ERROR, "Task panicked"))?
    .map_err(|e| {
        tracing::error!("Password reset: failed to set new password: {}", e);
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to reset password",
        )
    })?;

    let Some(member_id) = result else {
        return Err(api_error(
            StatusCode::BAD_REQUEST,
            "This reset link is invalid or has expired. Request a new one.",
        ));
    };

    let token = generate_jwt(member_id).map_err(|_| {
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to generate token",
        )
    })?;

    Ok(Json(AuthResult::Authenticated {
        id: member_id,
        token,
        is_authenticated: true,
        expires_at: Utc::now() + Duration::days(SESSION_DURATION_DAYS),
    }))
}

/// For `server reset-link <email>`: issue a reset link without sending email,
/// so the person running the server can pass it on by hand.
pub fn issue_reset_link_for_cli(email: &str) -> anyhow::Result<String> {
    let app_url = crate::email::app_url()
        .ok_or_else(|| anyhow::anyhow!("APP_URL must be set to build the link"))?;

    let mut conn = DB_POOL.get()?;
    let (_, token) = models::PasswordResetToken::issue(&mut conn, email, false)?
        .ok_or_else(|| anyhow::anyhow!("No account uses that email"))?;

    Ok(crate::email::password_reset_link(&app_url, &token))
}

pub fn handlers_routes() -> OpenApiRouter {
    let public_routes = OpenApiRouter::new()
        .routes(routes!(signup_handler))
        .routes(routes!(login_handler))
        .routes(routes!(authenticate_handler))
        .routes(routes!(password_reset_config_handler))
        .routes(routes!(request_password_reset_handler))
        .routes(routes!(confirm_password_reset_handler));

    let protected_routes = OpenApiRouter::new()
        .routes(routes!(get_member_handler))
        .routes(routes!(create_pool_handler))
        .routes(routes!(add_friend_to_pool_handler))
        .routes(routes!(remove_friend_from_pool_handler))
        .routes(routes!(list_friends_handler))
        .routes(routes!(list_inbound_friend_requests_handler))
        .routes(routes!(create_friend_request_handler))
        .routes(routes!(lookup_member_handler))
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
        .routes(routes!(update_expense_handler))
        .routes(routes!(list_expense_category_rules_handler))
        .routes(routes!(create_expense_category_rule_handler))
        .routes(routes!(delete_expense_category_rule_handler))
        .routes(routes!(toggle_pool_hidden_handler))
        .route_layer(middleware::from_fn(trace_middleware));

    public_routes.merge(protected_routes)
}
