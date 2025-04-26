use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::Double;
use diesel::{pg::PgConnection, sql_types::Numeric};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::schema::{
    expense, expense_line_item, friendship, member, member_password, pool, pool_membership,
};

// Enums

#[derive(
    diesel_derive_enum::DbEnum, Debug, Clone, Serialize, Deserialize, PartialEq, Eq, ToSchema,
)]
#[db_enum(existing_type_path = "crate::schema::sql_types::PoolRole")]
pub enum PoolRole {
    PARTICIPANT,
    ADMIN,
}

#[derive(
    diesel_derive_enum::DbEnum, Debug, Clone, Serialize, Deserialize, PartialEq, Eq, ToSchema,
)]
#[db_enum(existing_type_path = "crate::schema::sql_types::FriendshipStatus")]
pub enum FriendshipStatus {
    Pending,
    Accepted,
}

#[derive(
    diesel_derive_enum::DbEnum, Debug, Clone, Serialize, Deserialize, PartialEq, Eq, ToSchema,
)]
#[db_enum(existing_type_path = "crate::schema::sql_types::ExpenseCategory")]
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

// Member models

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

// Member password models

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

// Pool models

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

// Pool membership models

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
}

#[derive(Debug, Insertable, Deserialize, Selectable, ToSchema)]
#[diesel(table_name = pool_membership)]
pub struct NewPoolMembership {
    pub pool_id: uuid::Uuid,
    pub member_id: uuid::Uuid,
    pub role: PoolRole,
}

// Expense models

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

// Expense line item models

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

// Friendship models

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

// Implementations

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

    pub fn find_by_email(conn: &mut PgConnection, email_query: &str) -> QueryResult<Self> {
        member::table
            .filter(member::email.eq(email_query))
            .first(conn)
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

    pub fn delete(conn: &mut PgConnection, id: uuid::Uuid) -> QueryResult<usize> {
        diesel::delete(member::table.find(id)).execute(conn)
    }

    pub fn get_with_password(
        conn: &mut PgConnection,
        member_id: uuid::Uuid,
    ) -> QueryResult<(Self, String)> {
        member::table
            .inner_join(member_password::table.on(member::id.eq(member_password::member_id)))
            .filter(member::id.eq(member_id))
            .select((member::all_columns, member_password::password_hash))
            .first(conn)
    }

    pub fn list_all(conn: &mut PgConnection) -> QueryResult<Vec<Self>> {
        member::table.load(conn)
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

    pub fn find_by_member_id(
        conn: &mut PgConnection,
        member_id_query: uuid::Uuid,
    ) -> QueryResult<Self> {
        member_password::table
            .filter(member_password::member_id.eq(member_id_query))
            .first(conn)
    }

    pub fn update_password(
        conn: &mut PgConnection,
        member_id_query: uuid::Uuid,
        new_hash: &str,
    ) -> QueryResult<Self> {
        diesel::update(
            member_password::table.filter(member_password::member_id.eq(member_id_query)),
        )
        .set(member_password::password_hash.eq(new_hash))
        .get_result(conn)
    }

    pub fn verify_password(
        conn: &mut PgConnection,
        member_id: uuid::Uuid,
        password_hash: &str,
    ) -> QueryResult<bool> {
        let result: QueryResult<String> = member_password::table
            .filter(member_password::member_id.eq(member_id))
            .select(member_password::password_hash)
            .first(conn);

        match result {
            Ok(stored_hash) => Ok(stored_hash == password_hash),
            Err(e) => Err(e),
        }
    }
}

impl Pool {
    pub fn create(conn: &mut PgConnection, new_pool: &NewPool) -> QueryResult<Self> {
        diesel::insert_into(pool::table)
            .values(new_pool)
            .get_result(conn)
    }

    pub fn find(conn: &mut PgConnection, id: uuid::Uuid) -> QueryResult<Self> {
        pool::table.find(id).get_result(conn)
    }

    pub fn update(
        conn: &mut PgConnection,
        id: uuid::Uuid,
        changeset: &PoolChangeset,
    ) -> QueryResult<Self> {
        diesel::update(pool::table.find(id))
            .set(changeset)
            .get_result(conn)
    }

    pub fn delete(conn: &mut PgConnection, id: uuid::Uuid) -> QueryResult<usize> {
        diesel::delete(pool::table.find(id)).execute(conn)
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
    ) -> QueryResult<(Self, Option<f64>)> {
        // First ensure the member belongs to the pool
        let pool = pool::table
            .inner_join(pool_membership::table.on(pool::id.eq(pool_membership::pool_id)))
            .filter(pool::id.eq(pool_id_query))
            .filter(pool_membership::member_id.eq(member_id_query))
            .select(pool::all_columns)
            .first::<Pool>(conn)?;

        // Calculate debts owed
        let debts = expense_line_item::table
            .inner_join(
                expense::table.on(expense_line_item::expense_id
                    .eq(expense::id)
                    .and(expense_line_item::is_settled.eq(false))),
            )
            .filter(expense_line_item::debtor_member_id.eq(member_id_query))
            .select((
                expense::paid_by_member_id,
                expense_line_item::amount,
                expense::amount,
            ))
            .load::<(uuid::Uuid, f64, f64)>(conn)?;

        // Calculate total debt
        let mut total_debt = f64::from(0);
        for (paid_by_id, line_amount, expense_amount) in debts {
            if paid_by_id == member_id_query {
                // If I paid, I owe (line_amount - expense_amount)
                // This typically would be negative as I'm owed money
                total_debt += &line_amount - &expense_amount;
            } else {
                // If someone else paid, I owe the line amount
                total_debt += line_amount;
            }
        }

        Ok((
            pool,
            if total_debt == f64::from(0) {
                None
            } else {
                Some(total_debt)
            },
        ))
    }
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

    pub fn find(conn: &mut PgConnection, id: uuid::Uuid) -> QueryResult<Self> {
        pool_membership::table.find(id).get_result(conn)
    }

    pub fn find_by_pool_and_member(
        conn: &mut PgConnection,
        pool_id_query: uuid::Uuid,
        member_id_query: uuid::Uuid,
    ) -> QueryResult<Self> {
        pool_membership::table
            .filter(pool_membership::pool_id.eq(pool_id_query))
            .filter(pool_membership::member_id.eq(member_id_query))
            .first(conn)
    }

    pub fn get_members_in_pool(
        conn: &mut PgConnection,
        pool_id_query: uuid::Uuid,
    ) -> QueryResult<Vec<Member>> {
        member::table
            .inner_join(pool_membership::table.on(member::id.eq(pool_membership::member_id)))
            .filter(pool_membership::pool_id.eq(pool_id_query))
            .select(member::all_columns)
            .get_results(conn)
    }

    pub fn delete(conn: &mut PgConnection, id: uuid::Uuid) -> QueryResult<usize> {
        diesel::delete(pool_membership::table.find(id)).execute(conn)
    }

    pub fn add_member(
        conn: &mut PgConnection,
        pool_id_query: uuid::Uuid,
        member_id_query: uuid::Uuid,
    ) -> QueryResult<Self> {
        let new_membership = NewPoolMembership {
            pool_id: pool_id_query,
            member_id: member_id_query,
            role: PoolRole::PARTICIPANT, // Default role
        };

        Self::create(conn, &new_membership)
    }

    // remove_friend_from_pool
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
}

impl Expense {
    pub fn create(conn: &mut PgConnection, new_expense: &NewExpense) -> QueryResult<Self> {
        diesel::insert_into(expense::table)
            .values(new_expense)
            .get_result(conn)
    }

    pub fn find(
        conn: &mut PgConnection,
        id: uuid::Uuid,
        is_settled_query: bool,
    ) -> QueryResult<Self> {
        expense::table.find((id, is_settled_query)).get_result(conn)
    }

    pub fn find_for_pool(
        conn: &mut PgConnection,
        pool_id_query: uuid::Uuid,
    ) -> QueryResult<Vec<Self>> {
        expense::table
            .filter(expense::pool_id.eq(pool_id_query))
            .get_results(conn)
    }

    pub fn update(
        conn: &mut PgConnection,
        id: uuid::Uuid,
        is_settled_query: bool,
        changeset: &ExpenseChangeset,
    ) -> QueryResult<Self> {
        diesel::update(expense::table.find((id, is_settled_query)))
            .set(changeset)
            .get_result(conn)
    }

    pub fn delete(
        conn: &mut PgConnection,
        id: uuid::Uuid,
        is_settled_query: bool,
    ) -> QueryResult<usize> {
        diesel::delete(expense::table.find((id, is_settled_query))).execute(conn)
    }

    pub fn get_recent_for_member_in_pool(
        conn: &mut PgConnection,
        pool_id_query: uuid::Uuid,
        member_id_query: uuid::Uuid,
        limit: i64,
    ) -> QueryResult<Vec<(Self, f64)>> {
        // Join expenses with line items to get amounts owed by this member
        let results = expense::table
            .inner_join(
                expense_line_item::table.on(expense::id
                    .eq(expense_line_item::expense_id)
                    .and(expense_line_item::debtor_member_id.eq(member_id_query))
                    .and(expense_line_item::is_settled.eq(false))),
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

        // Calculate the amount owed for each expense
        let mut formatted_results = Vec::new();
        for (expense, paid_by_id, line_amount) in results {
            let amount_owed = if paid_by_id == member_id_query {
                // I paid for it, so I'm owed (line_amount - total_amount)
                &line_amount - &expense.amount
            } else {
                // Someone else paid, I owe the line item amount
                line_amount
            };

            formatted_results.push((expense, amount_owed));
        }

        Ok(formatted_results)
    }

    // create_expense with line items
    pub fn create_with_line_items(
        conn: &mut PgConnection,
        new_expense: &NewExpense,
        debtor_member_ids: &[uuid::Uuid],
        amounts: &[f64],
    ) -> QueryResult<(Self, Vec<ExpenseLineItem>)> {
        // Create the expense
        let expense = Self::create(conn, new_expense)?;

        // Create line items
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

    pub fn find(conn: &mut PgConnection, id: uuid::Uuid) -> QueryResult<Self> {
        expense_line_item::table.find(id).get_result(conn)
    }

    pub fn find_for_expense(
        conn: &mut PgConnection,
        expense_id_query: uuid::Uuid,
    ) -> QueryResult<Vec<Self>> {
        expense_line_item::table
            .filter(expense_line_item::expense_id.eq(expense_id_query))
            .get_results(conn)
    }

    pub fn update(
        conn: &mut PgConnection,
        id: uuid::Uuid,
        changeset: &ExpenseLineItemChangeset,
    ) -> QueryResult<Self> {
        diesel::update(expense_line_item::table.find(id))
            .set(changeset)
            .get_result(conn)
    }

    pub fn delete(conn: &mut PgConnection, id: uuid::Uuid) -> QueryResult<usize> {
        diesel::delete(expense_line_item::table.find(id)).execute(conn)
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
        // Find all friendships where this member is involved and status is accepted
        let inviter_friends = friendship::table
            .filter(friendship::inviting_member_id.eq(member_id_query))
            .filter(friendship::status.eq(FriendshipStatus::Accepted))
            .select(friendship::friend_member_id);

        let invitee_friends = friendship::table
            .filter(friendship::friend_member_id.eq(member_id_query))
            .filter(friendship::status.eq(FriendshipStatus::Accepted))
            .select(friendship::inviting_member_id);

        // Get all members who are friends with this member
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
    ) -> QueryResult<Vec<Member>> {
        // Get pending friendship requests for this member
        let pending_inviters = friendship::table
            .filter(friendship::friend_member_id.eq(member_id_query))
            .filter(friendship::status.eq(FriendshipStatus::Pending))
            .select(friendship::inviting_member_id);

        member::table
            .filter(member::id.eq_any(pending_inviters))
            .get_results(conn)
    }

    pub fn get_friends_with_pool_status(
        conn: &mut PgConnection,
        member_id_query: uuid::Uuid,
        pool_id_query: uuid::Uuid,
    ) -> QueryResult<Vec<(Member, bool)>> {
        // First get all friend IDs
        let inviter_friends = friendship::table
            .filter(friendship::inviting_member_id.eq(member_id_query))
            .filter(friendship::status.eq(FriendshipStatus::Accepted))
            .select(friendship::friend_member_id);

        let invitee_friends = friendship::table
            .filter(friendship::friend_member_id.eq(member_id_query))
            .filter(friendship::status.eq(FriendshipStatus::Accepted))
            .select(friendship::inviting_member_id);

        // Also include the requesting member
        let mut friend_ids: Vec<uuid::Uuid> = inviter_friends.union(invitee_friends).load(conn)?;
        friend_ids.push(member_id_query);

        // Get pool membership info
        let pool_member_ids = pool_membership::table
            .filter(pool_membership::pool_id.eq(pool_id_query))
            .select(pool_membership::member_id)
            .load::<uuid::Uuid>(conn)?;

        // Get all friends with membership status
        let friends = member::table
            .filter(member::id.eq_any(friend_ids))
            .load::<Member>(conn)?;

        let result = friends
            .into_iter()
            .map(|friend| {
                let is_pool_member = pool_member_ids.contains(&friend.id);
                (friend, is_pool_member)
            })
            .collect();

        Ok(result)
    }

    // create_friend_request
    pub fn send_request_by_email(
        conn: &mut PgConnection,
        inviting_id: uuid::Uuid,
        friend_email: &str,
    ) -> QueryResult<Option<Self>> {
        // Find potential friend by email
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

                // Handle conflict (do nothing if already exists)
                match Self::find(conn, inviting_id, friend_id) {
                    Ok(_) => Ok(None), // Friendship already exists
                    Err(_) => Self::create(conn, &new_friendship).map(Some),
                }
            }
            Err(e) => Err(e),
        }
    }
}
