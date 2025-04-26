use axum::http::StatusCode;
use axum::{Json, extract::Path};
use bcrypt::{DEFAULT_COST, hash_with_salt};
use bigdecimal::{BigDecimal, FromPrimitive};
use chrono::{DateTime, Duration, Utc};
use diesel::pg::PgConnection;
use diesel::r2d2::{ConnectionManager, Pool, PooledConnection};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use server::models::{self, Friendship, Member, MemberPassword, NewPool, PoolMembership};

pub async fn list_members_handler() -> Json<Vec<Member>> {
    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let members = tokio::task::spawn_blocking(move || {
        Member::list_all(&mut conn).expect("Failed to list members")
    })
    .await
    .expect("Task panicked");

    Json(members)
}

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

const PASSWORD_SALT: [u8; 16] = *b"MediciSalt123456"; // 16-byte salt
const DAYS: i64 = 60 * 60 * 24;

// Helper function to hash passwords
fn hash_password(password: &str) -> String {
    hash_with_salt(password, DEFAULT_COST, PASSWORD_SALT)
        .expect("Failed to hash password")
        .to_string()
}

// Auth result types
#[derive(Serialize)]
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

// Input types
#[derive(Deserialize)]
pub struct PoolInput {
    name: String,
    description: Option<String>,
}

#[derive(Deserialize)]
pub struct PoolMembershipInput {
    pool_id: uuid::Uuid,
    member_id: uuid::Uuid,
}

#[derive(Deserialize)]
pub struct PoolDetailsInput {
    pool_id: uuid::Uuid,
    member_id: uuid::Uuid,
}

#[derive(Deserialize)]
pub struct ExpenseLineItem {
    debtor_member_id: uuid::Uuid,
    amount: f64,
}

#[derive(Deserialize)]
pub struct ExpenseInput {
    paid_by_member_id: uuid::Uuid,
    pool_id: uuid::Uuid,
    name: String,
    amount: f64,
    line_items: Vec<ExpenseLineItem>,
    category: String,
    description: Option<String>,
}

#[derive(Deserialize)]
pub struct SignupInput {
    first_name: String,
    last_name: String,
    email: String,
    password: String,
}

#[derive(Deserialize)]
pub struct LoginInput {
    email: String,
    password: String,
}

#[derive(Deserialize)]
pub struct AuthInput {
    id: uuid::Uuid,
    token: String,
    expires_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct FriendRequestInput {
    member_id: uuid::Uuid,
    friend_email: String,
}

#[derive(Deserialize)]
pub struct AcceptFriendRequestInput {
    member_id: uuid::Uuid,
    friend_member_id: uuid::Uuid,
}

// Handler implementations

pub async fn health_check() -> &'static str {
    "OK"
}

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

pub async fn add_friend_to_pool_handler(
    Json(input): Json<PoolMembershipInput>,
) -> Json<PoolMembership> {
    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let result = tokio::task::spawn_blocking(move || {
        PoolMembership::add_member(&mut conn, input.pool_id, input.member_id)
            .expect("Failed to add friend to pool")
    })
    .await
    .expect("Task panicked");

    Json(result)
}

pub async fn remove_friend_from_pool_handler(
    Json(input): Json<PoolMembershipInput>,
) -> Json<serde_json::Value> {
    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let result = tokio::task::spawn_blocking(move || {
        PoolMembership::remove_member(&mut conn, input.pool_id, input.member_id)
            .expect("Failed to remove friend from pool")
    })
    .await
    .expect("Task panicked");

    Json(serde_json::json!({"success": result > 0}))
}

// Continue converting other handlers similarly...
// I'll show a few more key examples:

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

pub async fn authenticate_handler(Json(input): Json<AuthInput>) -> Json<AuthResult> {
    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");
    let id = input.id;
    let token = input.token.clone();

    let result: AuthResult = tokio::task::spawn_blocking(move || {
        match MemberPassword::verify_password(&mut conn, id, &token) {
            Ok(is_authenticated) => {
                if is_authenticated {
                    AuthResult::Authenticated {
                        id,
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

pub async fn create_friend_request_handler(
    Json(input): Json<FriendRequestInput>,
) -> Json<serde_json::Value> {
    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");
    let member_id = input.member_id;
    let friend_email = input.friend_email.clone();

    let result = tokio::task::spawn_blocking(move || {
        Friendship::send_request_by_email(&mut conn, member_id, &friend_email)
            .expect("Failed to create friend request")
    })
    .await
    .expect("Task panicked");

    Json(serde_json::json!({"success": true, "request": result}))
}

pub async fn accept_friend_request_handler(
    Json(input): Json<AcceptFriendRequestInput>,
) -> Json<serde_json::Value> {
    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");
    let member_id = input.member_id;
    let friend_member_id = input.friend_member_id;

    let result = tokio::task::spawn_blocking(move || {
        Friendship::update_status(
            &mut conn,
            friend_member_id, // inviting_member_id
            member_id,        // friend_member_id
            models::FriendshipStatus::Accepted,
        )
        .expect("Failed to accept friend request")
    })
    .await
    .expect("Task panicked");

    Json(serde_json::json!({"success": true, "friendship": result}))
}
pub async fn get_expense_handler(
    Path(expense_id): Path<uuid::Uuid>,
) -> Result<Json<models::Expense>, (StatusCode, Json<serde_json::Value>)> {
    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let expense = tokio::task::spawn_blocking(move || {
        // Try both settled and unsettled possibilities
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

pub async fn signup_handler(
    Json(input): Json<SignupInput>,
) -> Result<Json<Member>, (StatusCode, Json<serde_json::Value>)> {
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

        // Create password
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
        Ok(m) => Ok(Json(m)),
        Err(_) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to create member"})),
        )),
    }
}

pub async fn add_expense_handler(Json(input): Json<ExpenseInput>) -> Json<models::Expense> {
    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let new_expense = models::NewExpense {
        name: input.name,
        amount: BigDecimal::from_f64(input.amount).expect("Failed to convert amount to BigDecimal"),
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

    let amounts: Vec<BigDecimal> = input
        .line_items
        .iter()
        .map(|item| BigDecimal::from_f64(item.amount).unwrap_or_default())
        .collect();

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

#[derive(Serialize)]
pub struct PoolDetails {
    #[serde(flatten)]
    pool: models::Pool,
    total_debt: Option<BigDecimal>,
}

pub async fn get_pool_details_handler(Json(input): Json<PoolDetailsInput>) -> Json<PoolDetails> {
    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let pool_details = tokio::task::spawn_blocking(move || {
        models::Pool::get_with_debt_for_member(&mut conn, input.pool_id, input.member_id)
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

#[derive(Serialize)]
pub struct RecentExpenseDetails {
    #[serde(flatten)]
    expense: models::Expense,
    line_amount: BigDecimal,
}

#[derive(Deserialize)]
pub struct GetPoolExpensesInput {
    pool_id: uuid::Uuid,
    member_id: uuid::Uuid,
    limit: Option<i64>,
}

pub async fn get_pool_recent_expenses_handler(
    Json(input): Json<GetPoolExpensesInput>,
) -> Json<Vec<RecentExpenseDetails>> {
    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");
    let limit = input.limit.unwrap_or(5);

    let expenses = tokio::task::spawn_blocking(move || {
        models::Expense::get_recent_for_member_in_pool(
            &mut conn,
            input.pool_id,
            input.member_id,
            limit,
        )
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

#[derive(Deserialize, Serialize)]
pub struct MembersWithPoolStatus {
    member: models::Member,
    is_pool_member: bool,
}

pub async fn list_members_of_pool_handler(
    Json(input): Json<PoolDetailsInput>,
) -> Json<Vec<MembersWithPoolStatus>> {
    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let members = tokio::task::spawn_blocking(move || {
        Friendship::get_friends_with_pool_status(&mut conn, input.member_id, input.pool_id)
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

pub async fn create_pool_membership_handler(
    Json(input): Json<PoolMembershipInput>,
) -> Json<PoolMembership> {
    let mut conn = get_db_connection()
        .await
        .expect("Failed to get database connection");

    let new_membership = models::NewPoolMembership {
        pool_id: input.pool_id,
        member_id: input.member_id,
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
