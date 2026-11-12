use chrono::{DateTime, Utc};
use diesel::pg::PgConnection;
use diesel::prelude::*;
use diesel::sql_types::Uuid;
use diesel::sql_types::{Double, Uuid as SqlUuid};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

diesel::define_sql_function!(fn lower(x: diesel::sql_types::Text) -> diesel::sql_types::Text);

use crate::schema::{
    expense, expense_category_rule, expense_line_item, friendship, member, member_password,
    password_reset_token, pool, pool_membership,
};

#[derive(
    diesel_derive_enum::DbEnum, Debug, Clone, Serialize, Deserialize, PartialEq, Eq, ToSchema,
)]
#[db_enum(
    existing_type_path = "crate::schema::sql_types::PoolRole",
    value_style = "UPPERCASE"
)]
pub enum PoolRole {
    PARTICIPANT,
    ADMIN,
}

#[derive(
    diesel_derive_enum::DbEnum, Debug, Clone, Serialize, Deserialize, PartialEq, Eq, ToSchema,
)]
#[db_enum(
    existing_type_path = "crate::schema::sql_types::FriendshipStatus",
    value_style = "snake_case"
)]
pub enum FriendshipStatus {
    Pending,
    Accepted,
}

#[derive(
    diesel_derive_enum::DbEnum, Debug, Clone, Serialize, Deserialize, PartialEq, Eq, ToSchema,
)]
#[db_enum(
    existing_type_path = "crate::schema::sql_types::SplitMethod",
    value_style = "snake_case"
)]
pub enum SplitMethod {
    Percentage,
    Amount,
    Default,
}

#[derive(
    diesel_derive_enum::DbEnum, Debug, Clone, Serialize, Deserialize, PartialEq, Eq, ToSchema, Hash,
)]
#[db_enum(
    existing_type_path = "crate::schema::sql_types::ExpenseCategory",
    value_style = "snake_case"
)]
pub enum ExpenseCategory {
    FoodDining,
    Groceries,
    Transportation,
    HousingRent,
    Utilities,
    Healthcare,
    Entertainment,
    Shopping,
    Education,
    Travel,
    PersonalCare,
    Fitness,
    Subscriptions,
    BillsPayments,
    BusinessExpenses,
    Investments,
    Insurance,
    Gifts,
    Charity,
    Miscellaneous,
    HomeHouseholdSupplies,
    Pets,
    Taxes,
    Childcare,
    ProfessionalServices,
}

#[derive(Debug, Queryable, Identifiable, Serialize, Deserialize, ToSchema)]
#[diesel(table_name = member)]
pub struct Member {
    pub id: uuid::Uuid,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub inserted_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub bio: Option<String>,
    pub venmo_handle: Option<String>,
}

#[derive(Debug, Insertable, Deserialize, ToSchema)]
#[diesel(table_name = member)]
pub struct NewMember {
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub bio: Option<String>,
}

#[derive(Debug, AsChangeset, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
#[diesel(table_name = member)]
/// What a member can change about themselves. Email is deliberately not
/// here: it's the login and where password reset links go, so it can't be
/// changed.
pub struct MemberChangeset {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub bio: Option<String>,
    pub venmo_handle: Option<String>,
}

#[derive(Debug, Queryable, Identifiable, Associations, Serialize, Deserialize, ToSchema)]
#[diesel(table_name = member_password)]
#[diesel(belongs_to(Member))]
pub struct MemberPassword {
    pub id: uuid::Uuid,
    pub member_id: uuid::Uuid,
    pub password_hash: String,
    pub inserted_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub password_changed_at: DateTime<Utc>,
}

#[derive(Debug, Insertable, Deserialize, ToSchema)]
#[diesel(table_name = member_password)]
pub struct NewMemberPassword {
    pub member_id: uuid::Uuid,
    pub password_hash: String,
}

#[derive(Debug, Queryable, Identifiable, Serialize, Deserialize, ToSchema)]
#[diesel(table_name = pool)]
pub struct Pool {
    pub id: uuid::Uuid,
    pub name: String,
    pub description: Option<String>,
    pub inserted_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Insertable, Deserialize, ToSchema)]
#[diesel(table_name = pool)]
pub struct NewPool {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, AsChangeset, Deserialize, ToSchema)]
#[diesel(table_name = pool)]
pub struct PoolChangeset {
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Queryable, Identifiable, Associations, Serialize, Deserialize, ToSchema)]
#[diesel(table_name = pool_membership)]
#[diesel(belongs_to(Pool))]
#[diesel(belongs_to(Member))]
pub struct PoolMembership {
    pub id: uuid::Uuid,
    pub pool_id: uuid::Uuid,
    pub member_id: uuid::Uuid,
    pub role: PoolRole,
    pub inserted_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub default_split_percentage: f64,
    /// Whether this member has hidden the pool from their own list.
    pub is_hidden: bool,
}

#[derive(Debug, Insertable, Deserialize, Selectable, ToSchema)]
#[diesel(table_name = pool_membership)]
pub struct NewPoolMembership {
    pub pool_id: uuid::Uuid,
    pub member_id: uuid::Uuid,
    pub role: PoolRole,
    pub default_split_percentage: f64,
}

#[derive(Debug, Queryable, Identifiable, Associations, Serialize, Deserialize, ToSchema)]
#[diesel(table_name = expense)]
#[diesel(belongs_to(Pool))]
#[diesel(belongs_to(Member, foreign_key = paid_by_member_id))]
#[diesel(primary_key(id, is_settled))]
pub struct Expense {
    pub id: uuid::Uuid,
    pub name: String,
    pub amount: f64,
    pub is_settled: bool,
    pub inserted_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub pool_id: uuid::Uuid,
    pub paid_by_member_id: uuid::Uuid,
    pub description: Option<String>,
    pub notes: Option<String>,
    pub category: ExpenseCategory,
    pub split_method: SplitMethod,
    /// A recorded payment between two members (from settling up), not a
    /// shared expense.
    pub is_payment: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ExpenseWithLineItems {
    pub id: uuid::Uuid,
    pub name: String,
    pub amount: f64,
    pub is_settled: bool,
    pub inserted_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub pool_id: uuid::Uuid,
    pub paid_by_member_id: uuid::Uuid,
    pub description: Option<String>,
    pub notes: Option<String>,
    pub category: ExpenseCategory,
    pub split_method: SplitMethod,
    pub is_payment: bool,
    pub line_items: Vec<ExpenseLineItem>,
}

#[derive(Debug, Insertable, Deserialize, ToSchema)]
#[diesel(table_name = expense)]
pub struct NewExpense {
    pub name: String,
    pub amount: f64,
    pub is_settled: bool,
    pub pool_id: uuid::Uuid,
    pub paid_by_member_id: uuid::Uuid,
    pub description: Option<String>,
    pub notes: Option<String>,
    pub category: ExpenseCategory,
    pub split_method: SplitMethod,
    pub is_payment: bool,
}

#[derive(Debug, AsChangeset, Deserialize, ToSchema)]
#[diesel(table_name = expense)]
pub struct ExpenseChangeset {
    pub name: Option<String>,
    pub amount: Option<f64>,
    pub is_settled: Option<bool>,
    pub description: Option<String>,
    pub notes: Option<String>,
    pub category: Option<ExpenseCategory>,
    pub split_method: Option<SplitMethod>,
}

#[derive(Debug, Queryable, Identifiable, Associations, Serialize, Deserialize, ToSchema)]
#[diesel(table_name = expense_line_item)]
#[diesel(belongs_to(Expense, foreign_key = expense_id))]
#[diesel(belongs_to(Member, foreign_key = debtor_member_id))]
pub struct ExpenseLineItem {
    pub id: uuid::Uuid,
    pub expense_id: uuid::Uuid,
    pub is_settled: bool,
    pub amount: f64,
    pub inserted_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub debtor_member_id: uuid::Uuid,
}

#[derive(Debug, Insertable, Deserialize, ToSchema)]
#[diesel(table_name = expense_line_item)]
pub struct NewExpenseLineItem {
    pub expense_id: uuid::Uuid,
    pub is_settled: bool,
    pub amount: f64,
    pub debtor_member_id: uuid::Uuid,
}

#[derive(Debug, AsChangeset, Deserialize, ToSchema)]
#[diesel(table_name = expense_line_item)]
pub struct ExpenseLineItemChangeset {
    pub is_settled: Option<bool>,
    pub amount: Option<f64>,
}

pub struct DummyMember(Member);

#[derive(Debug, Queryable, Identifiable, Associations, Serialize, Deserialize, ToSchema)]
#[diesel(table_name = friendship)]
#[diesel(belongs_to(Member, foreign_key = inviting_member_id))]
#[diesel(belongs_to(DummyMember, foreign_key = friend_member_id))]
#[diesel(primary_key(inviting_member_id, friend_member_id))]
pub struct Friendship {
    pub inviting_member_id: uuid::Uuid,
    pub friend_member_id: uuid::Uuid,
    pub status: FriendshipStatus,
    pub inserted_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Insertable, Deserialize, ToSchema)]
#[diesel(table_name = friendship)]
pub struct NewFriendship {
    pub inviting_member_id: uuid::Uuid,
    pub friend_member_id: uuid::Uuid,
    pub status: FriendshipStatus,
}

#[derive(Debug, AsChangeset, Deserialize, ToSchema)]
#[diesel(table_name = friendship)]
pub struct FriendshipChangeset {
    pub status: Option<FriendshipStatus>,
}

#[derive(Debug, Queryable, Identifiable, Associations, Serialize, Deserialize, ToSchema)]
#[diesel(table_name = expense_category_rule)]
#[diesel(belongs_to(Member, foreign_key = member_id))]
#[diesel(primary_key(member_id, rule, category))]
pub struct ExpenseCategoryRule {
    pub member_id: uuid::Uuid,
    pub rule: String,
    pub category: ExpenseCategory,
    pub inserted_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Insertable, Deserialize, ToSchema)]
#[diesel(table_name = expense_category_rule)]
pub struct NewExpenseCategoryRule {
    pub rule: String,
    pub category: ExpenseCategory,
}

impl Member {
    pub fn create(conn: &mut PgConnection, new_member: &NewMember) -> QueryResult<Self> {
        diesel::insert_into(member::table)
            .values(new_member)
            .get_result(conn)
            .map_err(|e| {
                eprintln!("Error creating member: {:?}", e);
                e
            })
    }

    pub fn update(
        conn: &mut PgConnection,
        id: uuid::Uuid,
        changeset: &MemberChangeset,
    ) -> QueryResult<Self> {
        diesel::update(member::table.find(id))
            .set(changeset)
            .get_result(conn)
    }

    pub fn find(conn: &mut PgConnection, id: uuid::Uuid) -> QueryResult<Self> {
        member::table.find(id).get_result(conn)
    }

    /// Find a member by email, ignoring case and surrounding spaces.
    pub fn find_by_email(conn: &mut PgConnection, email: &str) -> QueryResult<Option<Self>> {
        member::table
            .filter(lower(member::email).eq(crate::normalize_email(email)))
            .first(conn)
            .optional()
    }

    /// Look up the member ID and stored bcrypt hash for an email, if any.
    /// Verifying the password against the hash is the caller's job.
    pub fn find_password_hash_by_email(
        conn: &mut PgConnection,
        email: &str,
    ) -> QueryResult<Option<(uuid::Uuid, String)>> {
        member::table
            .inner_join(member_password::table.on(member::id.eq(member_password::member_id)))
            .filter(lower(member::email).eq(crate::normalize_email(email)))
            .select((member::id, member_password::password_hash))
            .first(conn)
            .optional()
    }
}

impl ExpenseCategoryRule {
    pub fn create(
        conn: &mut PgConnection,
        member_id: &uuid::Uuid,
        rule: &NewExpenseCategoryRule,
    ) -> QueryResult<Self> {
        diesel::insert_into(expense_category_rule::table)
            .values((
                expense_category_rule::member_id.eq(&member_id),
                expense_category_rule::rule.eq(&rule.rule),
                expense_category_rule::category.eq(&rule.category),
            ))
            .get_result(conn)
    }

    pub fn find_for_member(
        conn: &mut PgConnection,
        member_id: uuid::Uuid,
    ) -> QueryResult<Vec<Self>> {
        expense_category_rule::table
            .filter(expense_category_rule::member_id.eq(member_id))
            .get_results(conn)
    }

    pub fn delete(
        conn: &mut PgConnection,
        member_id: &uuid::Uuid,
        rule: &str,
        expense_category: ExpenseCategory,
    ) -> QueryResult<usize> {
        diesel::delete(
            expense_category_rule::table.filter(
                expense_category_rule::member_id
                    .eq(member_id)
                    .and(expense_category_rule::rule.eq(rule))
                    .and(expense_category_rule::category.eq(expense_category)),
            ),
        )
        .execute(conn)
    }
}

impl MemberPassword {
    pub fn create(conn: &mut PgConnection, new_password: &NewMemberPassword) -> QueryResult<Self> {
        diesel::insert_into(member_password::table)
            .values(new_password)
            .get_result(conn)
    }
    /// When the member last changed their password, or `None` if the member
    /// doesn't exist. Sessions issued before this are rejected.
    pub fn password_changed_at(
        conn: &mut PgConnection,
        member_id: uuid::Uuid,
    ) -> QueryResult<Option<DateTime<Utc>>> {
        member_password::table
            .filter(member_password::member_id.eq(member_id))
            .select(member_password::password_changed_at)
            .first(conn)
            .optional()
    }
}

pub struct PasswordResetToken;

impl PasswordResetToken {
    /// Create a reset token for the account with this email. Returns the
    /// member and the raw token (only its hash is stored), or `None` if no
    /// account uses the email or, when `throttle` is set, one was issued
    /// within the last minute. Any older tokens for the member stop working.
    pub fn issue(
        conn: &mut PgConnection,
        email: &str,
        throttle: bool,
    ) -> QueryResult<Option<(Member, String)>> {
        conn.transaction(|conn| {
            let now = Utc::now();

            // Housekeeping: expired tokens are useless, so drop them.
            diesel::delete(
                password_reset_token::table.filter(password_reset_token::expires_at.lt(now)),
            )
            .execute(conn)?;

            let Some(member) = Member::find_by_email(conn, email)? else {
                return Ok(None);
            };

            if throttle {
                let cutoff =
                    now - chrono::Duration::seconds(crate::PASSWORD_RESET_THROTTLE_SECONDS);
                let recently_issued: bool = diesel::select(diesel::dsl::exists(
                    password_reset_token::table
                        .filter(password_reset_token::member_id.eq(member.id))
                        .filter(password_reset_token::inserted_at.gt(cutoff)),
                ))
                .get_result(conn)?;

                if recently_issued {
                    return Ok(None);
                }
            }

            diesel::delete(
                password_reset_token::table.filter(password_reset_token::member_id.eq(member.id)),
            )
            .execute(conn)?;

            let token = crate::generate_reset_token();
            diesel::insert_into(password_reset_token::table)
                .values((
                    password_reset_token::member_id.eq(member.id),
                    password_reset_token::token_hash.eq(crate::hash_reset_token(&token)),
                    password_reset_token::expires_at
                        .eq(now + chrono::Duration::minutes(crate::PASSWORD_RESET_TTL_MINUTES)),
                    password_reset_token::inserted_at.eq(now),
                ))
                .execute(conn)?;

            Ok(Some((member, token)))
        })
    }

    /// Use a reset token to set a new password. The token is deleted in the
    /// same statement that checks it, so it works at most once even if two
    /// requests race. Returns the member ID, or `None` if the token is
    /// unknown, already used, or expired.
    pub fn consume(
        conn: &mut PgConnection,
        token: &str,
        new_password_hash: &str,
    ) -> QueryResult<Option<uuid::Uuid>> {
        conn.transaction(|conn| {
            let now = Utc::now();

            let member_id: Option<uuid::Uuid> = diesel::delete(
                password_reset_token::table
                    .filter(password_reset_token::token_hash.eq(crate::hash_reset_token(token)))
                    .filter(password_reset_token::expires_at.gt(now)),
            )
            .returning(password_reset_token::member_id)
            .get_result(conn)
            .optional()?;

            let Some(member_id) = member_id else {
                return Ok(None);
            };

            let updated = diesel::update(
                member_password::table.filter(member_password::member_id.eq(member_id)),
            )
            .set((
                member_password::password_hash.eq(new_password_hash),
                member_password::password_changed_at.eq(now),
            ))
            .execute(conn)?;

            if updated != 1 {
                return Err(diesel::result::Error::NotFound);
            }

            diesel::delete(
                password_reset_token::table.filter(password_reset_token::member_id.eq(member_id)),
            )
            .execute(conn)?;

            Ok(Some(member_id))
        })
    }
}

impl Pool {
    pub fn create(conn: &mut PgConnection, new_pool: &NewPool) -> QueryResult<Self> {
        diesel::insert_into(pool::table)
            .values(new_pool)
            .get_result(conn)
    }

    /// The member's pools, each with whether this member has hidden it.
    pub fn find_by_member_id(
        conn: &mut PgConnection,
        member_id: uuid::Uuid,
    ) -> QueryResult<Vec<(Self, bool)>> {
        pool::table
            .inner_join(pool_membership::table.on(pool::id.eq(pool_membership::pool_id)))
            .filter(pool_membership::member_id.eq(member_id))
            .select((pool::all_columns, pool_membership::is_hidden))
            .get_results(conn)
    }

    pub fn get_with_debt_for_member(
        conn: &mut PgConnection,
        pool_id: uuid::Uuid,
        member_id: uuid::Uuid,
    ) -> QueryResult<(Self, PoolRole, bool, f64)> {
        let pool = pool::table
            .inner_join(pool_membership::table.on(pool::id.eq(pool_membership::pool_id)))
            .filter(pool::id.eq(pool_id))
            .filter(pool_membership::member_id.eq(member_id))
            .select((
                pool::all_columns,
                pool_membership::role,
                pool_membership::is_hidden,
            ))
            .load::<(Pool, PoolRole, bool)>(conn)?;

        let (p, role, is_hidden) = pool
            .into_iter()
            .next()
            .ok_or(diesel::result::Error::NotFound)?;

        let debts = expense_line_item::table
            .inner_join(
                expense::table.on(expense_line_item::expense_id
                    .eq(expense::id)
                    .and(expense_line_item::is_settled.eq(false))),
            )
            .filter(expense_line_item::debtor_member_id.eq(member_id))
            .filter(expense::pool_id.eq(pool_id))
            .select((
                expense::paid_by_member_id,
                expense_line_item::amount,
                expense::amount,
            ))
            .load::<(uuid::Uuid, f64, f64)>(conn)?;

        let mut total_debt = f64::from(0);
        for (paid_by_id, line_amount, expense_amount) in debts {
            if paid_by_id == member_id {
                total_debt += &line_amount - &expense_amount;
            } else {
                total_debt += line_amount;
            }
        }

        Ok((p, role, is_hidden, total_debt))
    }
}

#[derive(Debug)]
pub enum RemoveMemberError {
    NotAMember,
    OutstandingBalance,
    Database(diesel::result::Error),
}

impl From<diesel::result::Error> for RemoveMemberError {
    fn from(e: diesel::result::Error) -> Self {
        Self::Database(e)
    }
}

#[derive(Debug)]
pub enum UpdateSplitsError {
    Invalid(crate::SplitValidationError),
    Database(diesel::result::Error),
}

impl From<diesel::result::Error> for UpdateSplitsError {
    fn from(e: diesel::result::Error) -> Self {
        Self::Database(e)
    }
}

#[derive(Deserialize, ToSchema)]
pub struct MemberIdSplitPercentage {
    pub member_id: uuid::Uuid,
    pub split_percentage: f64,
}

impl PoolMembership {
    /// Hide or unhide the pool for this one member only.
    pub fn set_hidden(
        conn: &mut PgConnection,
        pool_id: uuid::Uuid,
        member_id: uuid::Uuid,
        is_hidden: bool,
    ) -> QueryResult<usize> {
        diesel::update(
            pool_membership::table
                .filter(pool_membership::pool_id.eq(pool_id))
                .filter(pool_membership::member_id.eq(member_id)),
        )
        .set(pool_membership::is_hidden.eq(is_hidden))
        .execute(conn)
    }

    /// The member's role in the pool, or `None` if they aren't in it.
    pub fn find_role(
        conn: &mut PgConnection,
        pool_id: uuid::Uuid,
        member_id: uuid::Uuid,
    ) -> QueryResult<Option<PoolRole>> {
        pool_membership::table
            .filter(pool_membership::pool_id.eq(pool_id))
            .filter(pool_membership::member_id.eq(member_id))
            .select(pool_membership::role)
            .first(conn)
            .optional()
    }

    pub fn member_ids(
        conn: &mut PgConnection,
        pool_id: uuid::Uuid,
    ) -> QueryResult<Vec<uuid::Uuid>> {
        pool_membership::table
            .filter(pool_membership::pool_id.eq(pool_id))
            .select(pool_membership::member_id)
            .load(conn)
    }

    pub fn create(
        conn: &mut PgConnection,
        new_membership: &NewPoolMembership,
    ) -> QueryResult<Self> {
        diesel::insert_into(pool_membership::table)
            .values(new_membership)
            .get_result(conn)
    }

    pub fn add_member(
        conn: &mut PgConnection,
        pool_id: uuid::Uuid,
        member_id: uuid::Uuid,
    ) -> QueryResult<Self> {
        let new_membership = NewPoolMembership {
            pool_id: pool_id,
            member_id: member_id,
            role: PoolRole::PARTICIPANT,
            default_split_percentage: 0.0,
        };

        Self::create(conn, &new_membership)
    }

    /// Remove a member from a pool and share their default split among the
    /// remaining members. Refuses if the member still has an unsettled
    /// balance, since removing them would hide money that's owed.
    pub fn remove_member(
        conn: &mut PgConnection,
        pool_id: uuid::Uuid,
        member_id: uuid::Uuid,
        remainder_to: uuid::Uuid,
    ) -> Result<(), RemoveMemberError> {
        conn.transaction::<_, RemoveMemberError, _>(|conn| {
            if Self::find_role(conn, pool_id, member_id)?.is_none() {
                return Err(RemoveMemberError::NotAMember);
            }

            let debts = Expense::list_unpaid_for_balance_computation(conn, pool_id)?;
            if crate::has_outstanding_balance(member_id, debts) {
                return Err(RemoveMemberError::OutstandingBalance);
            }

            diesel::delete(
                pool_membership::table
                    .filter(pool_membership::pool_id.eq(pool_id))
                    .filter(pool_membership::member_id.eq(member_id)),
            )
            .execute(conn)?;

            let remaining: Vec<(uuid::Uuid, f64)> = pool_membership::table
                .filter(pool_membership::pool_id.eq(pool_id))
                .order(pool_membership::inserted_at.asc())
                .select((
                    pool_membership::member_id,
                    pool_membership::default_split_percentage,
                ))
                .load(conn)?;

            Self::write_splits(
                conn,
                pool_id,
                &crate::redistribute_splits(&remaining, remainder_to),
            )?;

            Ok(())
        })
    }

    /// Replace every member's default split. The whole set is validated first
    /// (everyone included once, 0-100 each, total of 100%).
    pub fn update_default_split_percentage(
        conn: &mut PgConnection,
        pool_id: uuid::Uuid,
        inputs: Vec<MemberIdSplitPercentage>,
    ) -> Result<(), UpdateSplitsError> {
        conn.transaction::<_, UpdateSplitsError, _>(|conn| {
            let member_ids: std::collections::HashSet<uuid::Uuid> =
                Self::member_ids(conn, pool_id)?.into_iter().collect();

            let splits: Vec<(uuid::Uuid, f64)> = inputs
                .iter()
                .map(|i| (i.member_id, i.split_percentage))
                .collect();

            let validated = crate::validate_default_splits(&member_ids, &splits)
                .map_err(UpdateSplitsError::Invalid)?;

            Self::write_splits(conn, pool_id, &validated)?;
            Ok(())
        })
    }

    fn write_splits(
        conn: &mut PgConnection,
        pool_id: uuid::Uuid,
        splits: &[(uuid::Uuid, f64)],
    ) -> QueryResult<()> {
        for &(member_id, percent) in splits {
            diesel::update(pool_membership::table)
                .filter(pool_membership::member_id.eq(member_id))
                .filter(pool_membership::pool_id.eq(pool_id))
                .set(pool_membership::default_split_percentage.eq(percent))
                .execute(conn)?;
        }
        Ok(())
    }

    pub fn list(conn: &mut PgConnection, pool_id: uuid::Uuid) -> QueryResult<Vec<(Self, Member)>> {
        pool_membership::table
            .inner_join(member::table.on(pool_membership::member_id.eq(member::id)))
            .filter(pool_membership::pool_id.eq(pool_id))
            .get_results(conn)
    }
}

pub struct ExpenseForBalanceCalculation {
    pub payer_member_id: uuid::Uuid,
    pub debtor_member_id: uuid::Uuid,
    pub amount: f64,
}

#[derive(QueryableByName, Debug, Clone)]
pub struct DebtPair {
    #[diesel(sql_type = SqlUuid)]
    pub from_member_id: uuid::Uuid,

    #[diesel(sql_type = SqlUuid)]
    pub to_member_id: uuid::Uuid,

    #[diesel(sql_type = Double)]
    pub amount: f64,
}

impl Expense {
    pub fn create(conn: &mut PgConnection, new_expense: &NewExpense) -> QueryResult<Self> {
        diesel::insert_into(expense::table)
            .values(new_expense)
            .get_result(conn)
    }

    pub fn find(
        conn: &mut PgConnection,
        expense_id: uuid::Uuid,
        member_id: uuid::Uuid,
        pool_id: uuid::Uuid,
        is_settled: bool,
    ) -> QueryResult<Self> {
        expense::table
            .filter(
                expense::id
                    .eq(expense_id)
                    .and(expense::pool_id.eq(pool_id))
                    .and(expense::paid_by_member_id.eq(member_id))
                    .and(expense::is_settled.eq(is_settled)),
            )
            .get_result(conn)
    }

    pub fn delete(
        conn: &mut PgConnection,
        expense_id: uuid::Uuid,
        pool_id: uuid::Uuid,
        is_settled: bool,
    ) -> QueryResult<Self> {
        diesel::delete(
            expense::table.filter(
                expense::id
                    .eq(expense_id)
                    .and(expense::pool_id.eq(pool_id))
                    .and(expense::is_settled.eq(is_settled)),
            ),
        )
        .returning(expense::all_columns)
        .get_result(conn)
    }

    pub fn find_with_line_items(
        conn: &mut PgConnection,
        expense_id: uuid::Uuid,
        member_id: uuid::Uuid,
        pool_id: uuid::Uuid,
        is_settled: bool,
    ) -> QueryResult<ExpenseWithLineItems> {
        let expense = Self::find(conn, expense_id, member_id, pool_id, is_settled)?;
        let line_items = ExpenseLineItem::find_for_expense(conn, expense_id)?;

        Ok(ExpenseWithLineItems {
            id: expense.id,
            name: expense.name,
            amount: expense.amount,
            is_settled: expense.is_settled,
            inserted_at: expense.inserted_at,
            updated_at: expense.updated_at,
            pool_id: expense.pool_id,
            paid_by_member_id: expense.paid_by_member_id,
            description: expense.description,
            notes: expense.notes,
            category: expense.category,
            split_method: expense.split_method,
            is_payment: expense.is_payment,
            line_items,
        })
    }

    pub fn get_recent_for_member_in_pool(
        conn: &mut PgConnection,
        pool_id: uuid::Uuid,
        member_id: uuid::Uuid,
        limit: i64,
        expense_category: Option<ExpenseCategory>,
        paying_member_id: Option<uuid::Uuid>,
        is_settled: bool,
        since: DateTime<Utc>,
        until: DateTime<Utc>,
    ) -> QueryResult<Vec<(Self, f64)>> {
        let mut query = expense::table
            .inner_join(
                expense_line_item::table.on(expense::id
                    .eq(expense_line_item::expense_id)
                    .and(expense::is_settled.eq(is_settled))
                    .and(expense_line_item::debtor_member_id.eq(member_id))),
            )
            .filter(expense::pool_id.eq(pool_id))
            .filter(expense::is_settled.eq(is_settled))
            .filter(expense::inserted_at.le(until))
            .filter(expense::inserted_at.ge(since))
            .into_boxed();

        if let Some(value) = expense_category {
            query = query.filter(expense::category.eq(value));
        }

        if let Some(paid_by_member_id_filter) = paying_member_id {
            query = query.filter(expense::paid_by_member_id.eq(paid_by_member_id_filter));
        }

        let results = query
            .order_by(expense::inserted_at.desc())
            .limit(limit)
            .select((
                expense::all_columns,
                expense::paid_by_member_id,
                expense_line_item::amount,
            ))
            .load::<(Expense, uuid::Uuid, f64)>(conn)?;

        let mut formatted_results = Vec::new();
        for (expense, paid_by_id, line_amount) in results {
            let amount_owed = if paid_by_id == member_id {
                &line_amount - &expense.amount
            } else {
                line_amount
            };

            formatted_results.push((expense, amount_owed));
        }

        Ok(formatted_results)
    }

    pub fn create_with_line_items(
        conn: &mut PgConnection,
        new_expense: &NewExpense,
        debtor_member_ids: &[uuid::Uuid],
        amounts: &[f64],
    ) -> QueryResult<(Self, Vec<ExpenseLineItem>)> {
        let result = conn.transaction::<_, diesel::result::Error, _>(|conn| {
            let expense = Self::create(conn, new_expense)?;

            let mut line_items = Vec::new();
            for (i, &debtor_id) in debtor_member_ids.iter().enumerate() {
                if i < amounts.len() {
                    let line_item = NewExpenseLineItem {
                        expense_id: expense.id,
                        is_settled: false,
                        amount: amounts[i].clone(),
                        debtor_member_id: debtor_id,
                    };

                    let created_item = ExpenseLineItem::create(conn, &line_item)?;
                    line_items.push(created_item);
                }
            }

            Ok((expense, line_items))
        })?;

        return Ok(result);
    }

    /// Who paid an expense in this pool and whether it's a payment, or
    /// `None` if there's no such expense in the pool.
    pub fn payer_and_kind(
        conn: &mut PgConnection,
        expense_id: uuid::Uuid,
        pool_id: uuid::Uuid,
    ) -> QueryResult<Option<(uuid::Uuid, bool)>> {
        expense::table
            .filter(expense::id.eq(expense_id))
            .filter(expense::pool_id.eq(pool_id))
            .select((expense::paid_by_member_id, expense::is_payment))
            .first(conn)
            .optional()
    }

    /// Record settle-up payments. Each is an expense paid by the payer with a
    /// single share owed by the receiver, which cancels the payer's debt to
    /// the receiver. The payer also gets a zero share so the payment shows up
    /// in their own expense list.
    pub fn record_payments(
        conn: &mut PgConnection,
        pool_id: uuid::Uuid,
        payments: &[crate::SettlementPayment],
    ) -> QueryResult<()> {
        conn.transaction(|conn| {
            for payment in payments {
                let first_name = |conn: &mut PgConnection, id| -> QueryResult<String> {
                    member::table
                        .find(id)
                        .select(member::first_name)
                        .first::<String>(conn)
                };
                // Named for both people ("Erin paid Frank") so it reads right
                // in either person's expense list.
                let name = format!(
                    "{} paid {}",
                    first_name(conn, payment.payer)?,
                    first_name(conn, payment.receiver)?
                );

                let new_expense = NewExpense {
                    name,
                    amount: payment.amount,
                    is_settled: false,
                    pool_id,
                    paid_by_member_id: payment.payer,
                    description: None,
                    notes: None,
                    category: ExpenseCategory::Miscellaneous,
                    split_method: SplitMethod::Amount,
                    is_payment: true,
                };

                Self::create_with_line_items(
                    conn,
                    &new_expense,
                    &[payment.payer, payment.receiver],
                    &[0.0, payment.amount],
                )?;
            }
            Ok(())
        })
    }

    pub fn update(
        conn: &mut PgConnection,
        expense_id: &uuid::Uuid,
        pool_id: &uuid::Uuid,
        new_expense: &ExpenseChangeset,
    ) -> QueryResult<Self> {
        let expense = diesel::update(expense::table)
            .filter(expense::id.eq(expense_id))
            .filter(expense::pool_id.eq(pool_id))
            .set(new_expense)
            .get_result(conn)?;

        return Ok(expense);
    }

    pub fn list_unpaid_for_balance_computation(
        conn: &mut PgConnection,
        pool_id: uuid::Uuid,
    ) -> QueryResult<Vec<DebtPair>> {
        diesel::sql_query(
            "
            SELECT
                eli.debtor_member_id AS from_member_id,
                e.paid_by_member_id AS to_member_id,
                SUM(
                    CASE
                        WHEN e.paid_by_member_id = eli.debtor_member_id THEN eli.amount - e.amount
                        ELSE eli.amount
                    END
                ) AS amount
            FROM expense e
            JOIN expense_line_item eli ON e.id = eli.expense_id AND NOT e.is_settled
            WHERE
                e.pool_id = $1
                AND eli.debtor_member_id <> e.paid_by_member_id
            GROUP BY eli.debtor_member_id, e.paid_by_member_id
            ",
        )
        .bind::<Uuid, _>(pool_id)
        .load::<DebtPair>(conn)
    }
}

impl ExpenseLineItem {
    pub fn create(
        conn: &mut PgConnection,
        new_line_item: &NewExpenseLineItem,
    ) -> QueryResult<Self> {
        diesel::insert_into(expense_line_item::table)
            .values(new_line_item)
            .get_result(conn)
    }

    pub fn bulk_create(
        conn: &mut PgConnection,
        new_line_items: &[NewExpenseLineItem],
    ) -> QueryResult<Vec<Self>> {
        conn.transaction::<_, diesel::result::Error, _>(|conn| {
            let mut line_items = Vec::new();
            for line_item in new_line_items {
                let line_item = NewExpenseLineItem {
                    expense_id: line_item.expense_id,
                    is_settled: false,
                    amount: line_item.amount,
                    debtor_member_id: line_item.debtor_member_id,
                };

                let created_item = ExpenseLineItem::create(conn, &line_item)?;
                line_items.push(created_item);
            }

            Ok(line_items)
        })
    }

    pub fn delete_by_expense_id(
        conn: &mut PgConnection,
        expense_id: uuid::Uuid,
    ) -> QueryResult<usize> {
        diesel::delete(
            expense_line_item::table.filter(expense_line_item::expense_id.eq(expense_id)),
        )
        .execute(conn)
    }

    pub fn find_for_expense(
        conn: &mut PgConnection,
        expense_id: uuid::Uuid,
    ) -> QueryResult<Vec<Self>> {
        expense_line_item::table
            .filter(expense_line_item::expense_id.eq(expense_id))
            .get_results(conn)
    }
}

impl Friendship {
    pub fn create(conn: &mut PgConnection, new_friendship: &NewFriendship) -> QueryResult<Self> {
        diesel::insert_into(friendship::table)
            .values(new_friendship)
            .get_result(conn)
    }

    pub fn find(
        conn: &mut PgConnection,
        inviting_id: uuid::Uuid,
        friend_id: uuid::Uuid,
    ) -> QueryResult<Self> {
        friendship::table
            .find((inviting_id, friend_id))
            .get_result(conn)
    }

    pub fn update_status(
        conn: &mut PgConnection,
        inviting_id: uuid::Uuid,
        friend_id: uuid::Uuid,
        new_status: FriendshipStatus,
    ) -> QueryResult<Self> {
        diesel::update(friendship::table.find((inviting_id, friend_id)))
            .set(friendship::status.eq(new_status))
            .get_result(conn)
    }

    pub fn delete(
        conn: &mut PgConnection,
        inviting_id: uuid::Uuid,
        friend_id: uuid::Uuid,
    ) -> QueryResult<usize> {
        diesel::delete(friendship::table.find((inviting_id, friend_id))).execute(conn)
    }

    /// Whether the two members have an accepted friendship, in either direction.
    pub fn are_friends(conn: &mut PgConnection, a: uuid::Uuid, b: uuid::Uuid) -> QueryResult<bool> {
        diesel::select(diesel::dsl::exists(
            friendship::table
                .filter(friendship::status.eq(FriendshipStatus::Accepted))
                .filter(
                    (friendship::inviting_member_id
                        .eq(a)
                        .and(friendship::friend_member_id.eq(b)))
                    .or(friendship::inviting_member_id
                        .eq(b)
                        .and(friendship::friend_member_id.eq(a))),
                ),
        ))
        .get_result(conn)
    }

    pub fn get_friends(conn: &mut PgConnection, member_id: uuid::Uuid) -> QueryResult<Vec<Member>> {
        let inviter_friends = friendship::table
            .filter(friendship::inviting_member_id.eq(member_id))
            .filter(friendship::status.eq(FriendshipStatus::Accepted))
            .select(friendship::friend_member_id);

        let invitee_friends = friendship::table
            .filter(friendship::friend_member_id.eq(member_id))
            .filter(friendship::status.eq(FriendshipStatus::Accepted))
            .select(friendship::inviting_member_id);

        member::table
            .filter(
                member::id
                    .eq_any(inviter_friends)
                    .or(member::id.eq_any(invitee_friends)),
            )
            .get_results(conn)
    }

    pub fn get_pending_requests(
        conn: &mut PgConnection,
        member_id: uuid::Uuid,
    ) -> QueryResult<Vec<(Member, bool)>> {
        let inbound_requests = friendship::table
            .inner_join(member::table.on(friendship::inviting_member_id.eq(member::id)))
            .filter(friendship::friend_member_id.eq(member_id))
            .filter(friendship::status.eq(FriendshipStatus::Pending))
            .select((
                member::all_columns,
                diesel::dsl::sql::<diesel::sql_types::Bool>("true"),
            ));

        let outbound_requests = friendship::table
            .inner_join(member::table.on(friendship::friend_member_id.eq(member::id)))
            .filter(friendship::inviting_member_id.eq(member_id))
            .filter(friendship::status.eq(FriendshipStatus::Pending))
            .select((
                member::all_columns,
                diesel::dsl::sql::<diesel::sql_types::Bool>("false"),
            ));

        inbound_requests
            .union_all(outbound_requests)
            .get_results(conn)
    }

    /// The friendship row between two members, whichever of them sent it.
    pub fn find_between(
        conn: &mut PgConnection,
        a: uuid::Uuid,
        b: uuid::Uuid,
    ) -> QueryResult<Option<Self>> {
        friendship::table
            .filter(
                (friendship::inviting_member_id
                    .eq(a)
                    .and(friendship::friend_member_id.eq(b)))
                .or(friendship::inviting_member_id
                    .eq(b)
                    .and(friendship::friend_member_id.eq(a))),
            )
            .first(conn)
            .optional()
    }

    /// Send a friend request by email and report what happened. If the other
    /// person had already sent the caller a request, this accepts it rather
    /// than failing on the one-friendship-per-pair index.
    pub fn send_request_by_email(
        conn: &mut PgConnection,
        inviting_id: uuid::Uuid,
        friend_email: &str,
    ) -> Result<(Member, FriendRequestOutcome), SendFriendRequestError> {
        conn.transaction(|conn| {
            let friend = Member::find_by_email(conn, friend_email)?
                .ok_or(SendFriendRequestError::NotFound)?;

            let existing = Self::find_between(conn, inviting_id, friend.id)?;
            let relationship = crate::relationship_between(
                inviting_id,
                friend.id,
                existing.map(|f| (f.inviting_member_id, f.status)),
            );

            let outcome = match relationship {
                crate::Relationship::Yourself => return Err(SendFriendRequestError::Yourself),
                crate::Relationship::AlreadyFriends => FriendRequestOutcome::AlreadyFriends,
                crate::Relationship::RequestSent => FriendRequestOutcome::AlreadySent,
                crate::Relationship::RequestReceived => {
                    Self::update_status(conn, friend.id, inviting_id, FriendshipStatus::Accepted)?;
                    FriendRequestOutcome::Accepted
                }
                crate::Relationship::NotFriends => {
                    Self::create(
                        conn,
                        &NewFriendship {
                            inviting_member_id: inviting_id,
                            friend_member_id: friend.id,
                            status: FriendshipStatus::Pending,
                        },
                    )?;
                    FriendRequestOutcome::Sent
                }
            };

            Ok((friend, outcome))
        })
    }

    /// Delete a pending request between the two members, in either direction:
    /// declining one you received or cancelling one you sent. Accepted
    /// friendships are left alone. Returns how many rows were deleted.
    pub fn delete_pending_between(
        conn: &mut PgConnection,
        a: uuid::Uuid,
        b: uuid::Uuid,
    ) -> QueryResult<usize> {
        diesel::delete(
            friendship::table
                .filter(friendship::status.eq(FriendshipStatus::Pending))
                .filter(
                    (friendship::inviting_member_id
                        .eq(a)
                        .and(friendship::friend_member_id.eq(b)))
                    .or(friendship::inviting_member_id
                        .eq(b)
                        .and(friendship::friend_member_id.eq(a))),
                ),
        )
        .execute(conn)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum FriendRequestOutcome {
    /// A new request was sent.
    Sent,
    /// They had already invited you, so you're now friends.
    Accepted,
    AlreadyFriends,
    AlreadySent,
}

#[derive(Debug)]
pub enum SendFriendRequestError {
    NotFound,
    Yourself,
    Database(diesel::result::Error),
}

impl From<diesel::result::Error> for SendFriendRequestError {
    fn from(e: diesel::result::Error) -> Self {
        Self::Database(e)
    }
}

#[derive(Serialize, ToSchema, Debug, Eq, Hash, PartialEq, Clone)]
#[serde(rename_all = "lowercase")]
pub enum PaymentDirection {
    Inbound,
    Outbound,
}

#[derive(Serialize, ToSchema, Debug)]
pub struct Balance {
    pub member_id: uuid::Uuid,
    pub amount: f64,
    pub direction: PaymentDirection,
}
