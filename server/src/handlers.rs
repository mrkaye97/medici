use axum::extract::Query;
use axum::http::StatusCode;
use axum::{Json, extract::Path};
use bcrypt::{DEFAULT_COST, hash_with_salt};
use chrono::{DateTime, Duration, Utc};
use diesel::pg::PgConnection;
use diesel::r2d2::{ConnectionManager, Pool, PooledConnection};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use server::models::{self, Expense, Friendship, Member, MemberPassword, NewPool, PoolMembership};
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

fn hash_password(password: &str) -> String {
    hash_with_salt(password, DEFAULT_COST, PASSWORD_SALT)
        .expect("Failed to hash password")
        .to_string()
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
    path = "/api/pools",
    request_body = PoolInput,
    responses(
        (status = 200, description = "Create a pool successfully", body = models::Pool),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn create_pool_handler(Json(pool_input): Json<PoolInput>) -> Json<models::Pool> {
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
    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let result = tokio::task::spawn_blocking(move || {
        PoolMembership::add_member(&mut conn, pool_id, input.member_id)
            .expect("Failed to add friend to pool")
    })
    .await
    .expect("Task panicked");

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
    let pool_id = path.pool_id;
    let member_id = path.member_id;

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let result = tokio::task::spawn_blocking(move || {
        PoolMembership::remove_member(&mut conn, pool_id, member_id)
            .expect("Failed to remove friend from pool")
    })
    .await
    .expect("Task panicked");

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
    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let member = tokio::task::spawn_blocking(move || Member::find(&mut conn, member_id))
        .await
        .expect("Task panicked");

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
        (status = 500, description = "Internal server error")
    )
)]
pub async fn login_handler(Json(input): Json<LoginInput>) -> Json<AuthResult> {
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
                    AuthResult::Authenticated {
                        id,
                        token: password_hash,
                        is_authenticated: true,
                        expires_at: Utc::now() + Duration::days(7),
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

    Json(result)
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
    let token = query.token;

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let result: AuthResult = tokio::task::spawn_blocking(move || {
        match MemberPassword::verify_password(&mut conn, member_id, &token) {
            Ok(is_authenticated) => {
                if is_authenticated {
                    AuthResult::Authenticated {
                        id: member_id,
                        token,
                        is_authenticated: true,
                        expires_at: Utc::now() + Duration::days(7),
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

    Json(result)
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
    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let friends = tokio::task::spawn_blocking(move || {
        Friendship::get_friends(&mut conn, member_id).expect("Failed to list friends")
    })
    .await
    .expect("Task panicked");

    Json(friends)
}

#[utoipa::path(
    get,
    path = "/api/members/{member_id}/friend-requests",
    params(
        ("member_id" = uuid::Uuid, Path, description = "ID of the member to fetch friend requests for")
    ),
    responses(
        (status = 200, description = "List inbound friend requests of a member successfully", body = Vec<Member>),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn list_inbound_friend_requests_handler(
    Path(member_id): Path<uuid::Uuid>,
) -> Json<Vec<Member>> {
    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let requests = tokio::task::spawn_blocking(move || {
        Friendship::get_pending_requests(&mut conn, member_id)
            .expect("Failed to list friend requests")
    })
    .await
    .expect("Task panicked");

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

    Json(serde_json::json!({"success": true, "request": result}))
}

#[derive(Deserialize, ToSchema)]
pub struct AcceptFriendRequestPath {
    member_id: uuid::Uuid,
    friend_member_id: uuid::Uuid,
}

#[utoipa::path(
    post,
    path = "/api/members/{member_id}/friend-requests/{friend_member_id}/accept",
    params(
        ("member_id" = uuid::Uuid, Path, description = "ID of the member accepting the request"),
        ("friend_member_id" = uuid::Uuid, Path, description = "ID of the friend request to accept")
    ),
    responses(
        (status = 200, description = "Accept a friend request successfully", body = serde_json::Value),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn accept_friend_request_handler(
    Path(path): Path<AcceptFriendRequestPath>,
) -> Json<serde_json::Value> {
    let member_id = path.member_id;
    let friend_member_id = path.friend_member_id;

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");
    let result = tokio::task::spawn_blocking(move || {
        Friendship::update_status(
            &mut conn,
            friend_member_id,
            member_id,
            models::FriendshipStatus::Accepted,
        )
        .expect("Failed to accept friend request")
    })
    .await
    .expect("Task panicked");

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
    let expense_id = path.expense_id;

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let expense = tokio::task::spawn_blocking(move || {
        models::Expense::find(&mut conn, expense_id, false)
            .or_else(|_| models::Expense::find(&mut conn, expense_id, true))
    })
    .await
    .expect("Task panicked");

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

    let password_hash_clone = password_hash.clone();

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

    match member {
        Ok(m) => Ok(Json(AuthResult::Authenticated {
            id: m.id,
            token: password_hash_clone,
            is_authenticated: true,
            expires_at: Utc::now() + Duration::days(7),
        })),
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

    Json(expense)
}

#[derive(Serialize, ToSchema)]
pub struct PoolDetails {
    #[serde(flatten)]
    pool: models::Pool,
    total_debt: f64,
}

#[derive(Deserialize, ToSchema)]
pub struct PoolDetailsQuery {
    member_id: uuid::Uuid,
}

#[utoipa::path(
    get,
    path = "/api/pools/{pool_id}",
    params(
        ("pool_id" = uuid::Uuid, Path, description = "ID of the pool to fetch details for"),
        ("member_id" = uuid::Uuid, Query, description = "ID of the member to fetch details for")
    ),
    responses(
        (status = 200, description = "Create expense", body = PoolDetails),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_pool_details_handler(
    Path(pool_id): Path<uuid::Uuid>,
    Query(query): Query<PoolDetailsQuery>,
) -> Json<PoolDetails> {
    let member_id = query.member_id;
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
        total_debt: pool_details.1,
    };

    Json(details)
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
        ("limit" = Option<i64>, Query, description = "Limit the number of expenses returned")
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
    let limit = query.limit;
    let pool_id = path.pool_id;
    let member_id = path.member_id;

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");
    let limit = limit.unwrap_or(5);

    let expenses = tokio::task::spawn_blocking(move || {
        models::Expense::get_recent_for_member_in_pool(&mut conn, pool_id, member_id, limit)
            .expect("Failed to get recent expenses")
    })
    .await
    .expect("Task panicked");
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

#[derive(Deserialize, Serialize, ToSchema)]
pub struct MembersWithPoolStatus {
    member: models::Member,
    is_pool_member: bool,
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
        (status = 200, description = "List all members of a pool successfully", body = Vec<MembersWithPoolStatus>),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn list_members_of_pool_handler(
    Path(path): Path<MembersOfPoolPath>,
) -> Json<Vec<MembersWithPoolStatus>> {
    let pool_id = path.pool_id;
    let member_id = path.member_id;

    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let members = tokio::task::spawn_blocking(move || {
        Friendship::get_friends_with_pool_status(&mut conn, member_id, pool_id)
            .expect("Failed to list members of pool")
    })
    .await
    .expect("Task panicked");

    Json(
        members
            .into_iter()
            .map(|(member, is_pool_member)| MembersWithPoolStatus {
                member,
                is_pool_member,
            })
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
    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let pools = tokio::task::spawn_blocking(move || {
        models::Pool::find_by_member_id(&mut conn, member_id)
            .expect("Failed to list pools for member")
    })
    .await
    .expect("Task panicked");

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
    let member_id = query.member_id;
    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let new_membership = models::NewPoolMembership {
        pool_id: pool_id,
        member_id: member_id,
        role: models::PoolRole::PARTICIPANT,
    };

    let membership = tokio::task::spawn_blocking(move || {
        PoolMembership::create(&mut conn, &new_membership)
            .expect("Failed to create pool membership")
    })
    .await
    .expect("Task panicked");

    Json(membership)
}

pub fn handlers_routes() -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(get_member_handler))
        .routes(routes!(signup_handler))
        .routes(routes!(login_handler))
        .routes(routes!(authenticate_handler))
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
}
