use chrono::{DateTime, Utc};
use diesel::pg::PgConnection;
use diesel::prelude::*;
use diesel::sql_types::{Double, Uuid as SqlUuid};
use diesel::sql_types::{Numeric, Uuid};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::schema::{
    expense, expense_line_item, friendship, member, member_password, pool, pool_membership,
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
#[diesel(table_name = member)]
pub struct MemberChangeset {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub bio: Option<String>,
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

    pub fn find(conn: &mut PgConnection, id: uuid::Uuid) -> QueryResult<Self> {
        member::table.find(id).get_result(conn)
    }

    pub fn authenticate(
        conn: &mut PgConnection,
        email_query: &str,
        password_hash: &str,
    ) -> QueryResult<(uuid::Uuid, bool)> {
        let result: QueryResult<(uuid::Uuid, String)> = member::table
            .inner_join(member_password::table.on(member::id.eq(member_password::member_id)))
            .filter(member::email.eq(email_query))
            .select((member::id, member_password::password_hash))
            .first(conn);

        match result {
            Ok((id, stored_hash)) => Ok((id, stored_hash == password_hash)),
            Err(e) => Err(e),
        }
    }
}

impl MemberPassword {
    pub fn create(conn: &mut PgConnection, new_password: &NewMemberPassword) -> QueryResult<Self> {
        diesel::insert_into(member_password::table)
            .values(new_password)
            .get_result(conn)
    }
}

impl Pool {
    pub fn create(conn: &mut PgConnection, new_pool: &NewPool) -> QueryResult<Self> {
        diesel::insert_into(pool::table)
            .values(new_pool)
            .get_result(conn)
    }

    pub fn find_by_member_id(
        conn: &mut PgConnection,
        member_id_query: uuid::Uuid,
    ) -> QueryResult<Vec<Self>> {
        pool::table
            .inner_join(pool_membership::table.on(pool::id.eq(pool_membership::pool_id)))
            .filter(pool_membership::member_id.eq(member_id_query))
            .select(pool::all_columns)
            .get_results(conn)
    }

    pub fn get_with_debt_for_member(
        conn: &mut PgConnection,
        pool_id_query: uuid::Uuid,
        member_id_query: uuid::Uuid,
    ) -> QueryResult<(Self, PoolRole, f64)> {
        let pool = pool::table
            .inner_join(pool_membership::table.on(pool::id.eq(pool_membership::pool_id)))
            .filter(pool::id.eq(pool_id_query))
            .filter(pool_membership::member_id.eq(member_id_query))
            .select((pool::all_columns, pool_membership::role))
            .load::<(Pool, PoolRole)>(conn)?;

        let debts = expense_line_item::table
            .inner_join(
                expense::table.on(expense_line_item::expense_id
                    .eq(expense::id)
                    .and(expense_line_item::is_settled.eq(false))),
            )
            .filter(expense_line_item::debtor_member_id.eq(member_id_query))
            .filter(expense::pool_id.eq(pool_id_query))
            .select((
                expense::paid_by_member_id,
                expense_line_item::amount,
                expense::amount,
            ))
            .load::<(uuid::Uuid, f64, f64)>(conn)?;

        let mut total_debt = f64::from(0);
        for (paid_by_id, line_amount, expense_amount) in debts {
            if paid_by_id == member_id_query {
                total_debt += &line_amount - &expense_amount;
            } else {
                total_debt += line_amount;
            }
        }

        let (p, role) = pool.into_iter().next().unwrap();

        Ok((p, role, total_debt))
    }

    pub fn settle_up(
        conn: &mut PgConnection,
        pool_id: uuid::Uuid,
        confirming_member_id: uuid::Uuid,
    ) -> () {
        let _ = diesel::sql_query(
            "
            WITH expense_ids AS (
                SELECT e.id
                FROM expense e
                JOIN pool_membership pm ON e.pool_id = pm.pool_id
                JOIN member m ON pm.member_id = m.id
                WHERE
                    pm.pool_id = $1
                    AND pm.member_id = $2
                    AND e.is_settled = false
            ), line_items AS (
                UPDATE expense_line_item
                SET is_settled = true
                WHERE expense_id IN (SELECT id FROM expense_ids)
            )

            UPDATE expense
            SET is_settled = true
            WHERE id IN (SELECT id FROM expense_ids)
            ;
            ",
        )
        .bind::<Uuid, _>(pool_id)
        .bind::<Uuid, _>(confirming_member_id)
        .execute(conn);
    }
}

#[derive(Deserialize, ToSchema)]
pub struct MemberIdSplitPercentage {
    pub member_id: uuid::Uuid,
    pub split_percentage: f64,
}

impl PoolMembership {
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
        pool_id_query: uuid::Uuid,
        member_id_query: uuid::Uuid,
    ) -> QueryResult<Self> {
        let new_membership = NewPoolMembership {
            pool_id: pool_id_query,
            member_id: member_id_query,
            role: PoolRole::PARTICIPANT,
            default_split_percentage: 0.0,
        };

        Self::create(conn, &new_membership)
    }

    pub fn remove_member(
        conn: &mut PgConnection,
        pool_id_query: uuid::Uuid,
        member_id_query: uuid::Uuid,
    ) -> QueryResult<usize> {
        diesel::delete(
            pool_membership::table
                .filter(pool_membership::pool_id.eq(pool_id_query))
                .filter(pool_membership::member_id.eq(member_id_query)),
        )
        .execute(conn)
    }

    pub fn update_default_split_percentage(
        conn: &mut PgConnection,
        pool_id: uuid::Uuid,
        inputs: Vec<MemberIdSplitPercentage>,
    ) -> QueryResult<usize> {
        let total: f64 = inputs
            .iter()
            .map(|item| item.split_percentage)
            .collect::<Vec<f64>>()
            .into_iter()
            .sum();

        if total != 100.0 {
            return Ok(0);
        }

        conn.transaction::<_, diesel::result::Error, _>(|conn| {
            for input in inputs {
                diesel::update(pool_membership::table)
                    .filter(
                        pool_membership::member_id
                            .eq(input.member_id)
                            .and(pool_membership::pool_id.eq(pool_id)),
                    )
                    .set(pool_membership::default_split_percentage.eq(input.split_percentage))
                    .execute(conn)?;
            }
            Ok(())
        })?;

        return Ok(1);
    }
}

pub struct ExpenseForBalanceCalculation {
    pub payer_member_id: uuid::Uuid,
    pub debtor_member_id: uuid::Uuid,
    pub amount: f64,
}

#[derive(QueryableByName, Debug)]
pub struct DebtPair {
    #[sql_type = "SqlUuid"]
    pub from_member_id: uuid::Uuid,

    #[sql_type = "SqlUuid"]
    pub to_member_id: uuid::Uuid,

    #[sql_type = "Double"]
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
        is_settled_query: bool,
    ) -> QueryResult<Self> {
        expense::table
            .filter(
                expense::id
                    .eq(expense_id)
                    .and(expense::pool_id.eq(pool_id))
                    .and(expense::paid_by_member_id.eq(member_id))
                    .and(expense::is_settled.eq(is_settled_query)),
            )
            .get_result(conn)
    }

    pub fn get_recent_for_member_in_pool(
        conn: &mut PgConnection,
        pool_id_query: uuid::Uuid,
        member_id_query: uuid::Uuid,
        limit: i64,
    ) -> QueryResult<Vec<(Self, f64)>> {
        let results = expense::table
            .inner_join(
                expense_line_item::table.on(expense::id
                    .eq(expense_line_item::expense_id)
                    .and(expense::is_settled.eq(false)) // <-- fix here
                    .and(expense_line_item::debtor_member_id.eq(member_id_query))),
            )
            .filter(expense::pool_id.eq(pool_id_query))
            .filter(expense::is_settled.eq(false))
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
            let amount_owed = if paid_by_id == member_id_query {
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

    pub fn find_for_expense(
        conn: &mut PgConnection,
        expense_id_query: uuid::Uuid,
    ) -> QueryResult<Vec<Self>> {
        expense_line_item::table
            .filter(expense_line_item::expense_id.eq(expense_id_query))
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

    pub fn get_friends(
        conn: &mut PgConnection,
        member_id_query: uuid::Uuid,
    ) -> QueryResult<Vec<Member>> {
        let inviter_friends = friendship::table
            .filter(friendship::inviting_member_id.eq(member_id_query))
            .filter(friendship::status.eq(FriendshipStatus::Accepted))
            .select(friendship::friend_member_id);

        let invitee_friends = friendship::table
            .filter(friendship::friend_member_id.eq(member_id_query))
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
        member_id_query: uuid::Uuid,
    ) -> QueryResult<Vec<(Member, bool)>> {
        let inbound_requests = friendship::table
            .inner_join(member::table.on(friendship::inviting_member_id.eq(member::id)))
            .filter(friendship::friend_member_id.eq(member_id_query))
            .filter(friendship::status.eq(FriendshipStatus::Pending))
            .select((
                member::all_columns,
                diesel::dsl::sql::<diesel::sql_types::Bool>("true"),
            ));

        let outbound_requests = friendship::table
            .inner_join(member::table.on(friendship::friend_member_id.eq(member::id)))
            .filter(friendship::inviting_member_id.eq(member_id_query))
            .filter(friendship::status.eq(FriendshipStatus::Pending))
            .select((
                member::all_columns,
                diesel::dsl::sql::<diesel::sql_types::Bool>("false"),
            ));

        inbound_requests
            .union_all(outbound_requests)
            .get_results(conn)
    }

    pub fn get_friends_with_pool_status(
        conn: &mut PgConnection,
        member_id_query: uuid::Uuid,
        pool_id_query: uuid::Uuid,
    ) -> QueryResult<Vec<(Member, bool, f64)>> {
        let inviter_friends = friendship::table
            .filter(friendship::inviting_member_id.eq(member_id_query))
            .filter(friendship::status.eq(FriendshipStatus::Accepted))
            .select(friendship::friend_member_id);

        let invitee_friends = friendship::table
            .filter(friendship::friend_member_id.eq(member_id_query))
            .filter(friendship::status.eq(FriendshipStatus::Accepted))
            .select(friendship::inviting_member_id);

        let mut friend_ids: Vec<uuid::Uuid> = inviter_friends.union(invitee_friends).load(conn)?;
        friend_ids.push(member_id_query);

        let pool_member_ids = pool_membership::table
            .filter(pool_membership::pool_id.eq(pool_id_query))
            .select(pool_membership::member_id)
            .load::<uuid::Uuid>(conn)?;

        let friends = member::table
            .inner_join(pool_membership::table.on(member::id.eq(pool_membership::member_id)))
            .filter(
                member::id
                    .eq_any(friend_ids)
                    .and(pool_membership::pool_id.eq(pool_id_query)),
            )
            .select((
                member::all_columns,
                pool_membership::default_split_percentage,
            ))
            .load::<(Member, f64)>(conn)?;

        let result = friends
            .into_iter()
            .map(|(friend, default_split_pct)| {
                let is_pool_member = pool_member_ids.contains(&friend.id);
                (friend, is_pool_member, default_split_pct)
            })
            .collect();

        Ok(result)
    }

    pub fn send_request_by_email(
        conn: &mut PgConnection,
        inviting_id: uuid::Uuid,
        friend_email: &str,
    ) -> QueryResult<Option<Self>> {
        let potential_friend = member::table
            .filter(member::email.eq(friend_email))
            .filter(member::id.ne(inviting_id))
            .select(member::id)
            .first::<uuid::Uuid>(conn);

        match potential_friend {
            Ok(friend_id) => {
                let new_friendship = NewFriendship {
                    inviting_member_id: inviting_id,
                    friend_member_id: friend_id,
                    status: FriendshipStatus::Pending,
                };

                match Self::find(conn, inviting_id, friend_id) {
                    Ok(_) => Ok(None),
                    Err(_) => Self::create(conn, &new_friendship).map(Some),
                }
            }
            Err(e) => Err(e),
        }
    }
}

#[derive(Serialize, ToSchema, Debug)]
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
