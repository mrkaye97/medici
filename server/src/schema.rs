// @generated automatically by Diesel CLI.

pub mod sql_types {
    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "expense_category"))]
    pub struct ExpenseCategory;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "friendship_status"))]
    pub struct FriendshipStatus;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "pool_role"))]
    pub struct PoolRole;
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::ExpenseCategory;

    expense (id, is_settled) {
        id -> Uuid,
        name -> Text,
        amount -> Float8,
        is_settled -> Bool,
        inserted_at -> Timestamptz,
        updated_at -> Timestamptz,
        pool_id -> Uuid,
        paid_by_member_id -> Uuid,
        description -> Nullable<Text>,
        notes -> Nullable<Text>,
        category -> ExpenseCategory,
    }
}

diesel::table! {
    expense_line_item (id) {
        id -> Uuid,
        expense_id -> Uuid,
        is_settled -> Bool,
        amount -> Float8,
        inserted_at -> Timestamptz,
        updated_at -> Timestamptz,
        debtor_member_id -> Uuid,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::ExpenseCategory;

    expense_p_is_settled_false (id, is_settled) {
        id -> Uuid,
        name -> Text,
        amount -> Float8,
        is_settled -> Bool,
        inserted_at -> Timestamptz,
        updated_at -> Timestamptz,
        pool_id -> Uuid,
        paid_by_member_id -> Uuid,
        description -> Nullable<Text>,
        notes -> Nullable<Text>,
        category -> ExpenseCategory,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::ExpenseCategory;

    expense_p_is_settled_true (id, is_settled) {
        id -> Uuid,
        name -> Text,
        amount -> Float8,
        is_settled -> Bool,
        inserted_at -> Timestamptz,
        updated_at -> Timestamptz,
        pool_id -> Uuid,
        paid_by_member_id -> Uuid,
        description -> Nullable<Text>,
        notes -> Nullable<Text>,
        category -> ExpenseCategory,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::FriendshipStatus;

    friendship (inviting_member_id, friend_member_id) {
        inviting_member_id -> Uuid,
        friend_member_id -> Uuid,
        status -> FriendshipStatus,
        inserted_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    member (id) {
        id -> Uuid,
        first_name -> Text,
        last_name -> Text,
        email -> Text,
        inserted_at -> Timestamptz,
        updated_at -> Timestamptz,
        bio -> Nullable<Text>,
    }
}

diesel::table! {
    member_password (id) {
        id -> Uuid,
        member_id -> Uuid,
        password_hash -> Text,
        inserted_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    pool (id) {
        id -> Uuid,
        name -> Text,
        description -> Nullable<Text>,
        inserted_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::PoolRole;

    pool_membership (id) {
        id -> Uuid,
        pool_id -> Uuid,
        member_id -> Uuid,
        role -> PoolRole,
        inserted_at -> Timestamptz,
        updated_at -> Timestamptz,
        default_split_percentage -> Float8,
    }
}

diesel::joinable!(expense -> member (paid_by_member_id));
diesel::joinable!(expense -> pool (pool_id));
diesel::joinable!(expense_line_item -> member (debtor_member_id));
diesel::joinable!(expense_p_is_settled_false -> member (paid_by_member_id));
diesel::joinable!(expense_p_is_settled_false -> pool (pool_id));
diesel::joinable!(expense_p_is_settled_true -> member (paid_by_member_id));
diesel::joinable!(expense_p_is_settled_true -> pool (pool_id));
diesel::joinable!(member_password -> member (member_id));
diesel::joinable!(pool_membership -> member (member_id));
diesel::joinable!(pool_membership -> pool (pool_id));

diesel::allow_tables_to_appear_in_same_query!(
    expense,
    expense_line_item,
    expense_p_is_settled_false,
    expense_p_is_settled_true,
    friendship,
    member,
    member_password,
    pool,
    pool_membership,
);
