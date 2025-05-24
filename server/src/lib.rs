pub mod models;
pub mod schema;
use diesel::prelude::*;
use dotenvy::dotenv;
use std::{
    collections::{HashMap, HashSet},
    env,
};

pub fn establish_connection() -> PgConnection {
    dotenv().ok();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    PgConnection::establish(&database_url)
        .unwrap_or_else(|_| panic!("Error connecting to {}", database_url))
}

pub fn compute_balances_for_member(
    member_id: uuid::Uuid,
    expenses: Vec<models::DebtPair>,
) -> Vec<models::Balance> {
    let mut pairwise_expenses: HashMap<(uuid::Uuid, uuid::Uuid), f64> = HashMap::new();
    let mut necessary_payments: HashMap<(uuid::Uuid, uuid::Uuid), f64> = HashMap::new();

    for expense in &expenses {
        let from_member_id = expense.from_member_id;
        let to_member_id = expense.to_member_id;

        pairwise_expenses.insert((from_member_id, to_member_id), expense.amount);
    }

    let mut unique_member_ids = HashSet::new();
    for expense in &expenses {
        unique_member_ids.insert(expense.from_member_id);
        unique_member_ids.insert(expense.to_member_id);
    }

    for member_a in &unique_member_ids {
        for member_b in &unique_member_ids {
            let a_to_b = pairwise_expenses
                .get(&(*member_a, *member_b))
                .unwrap_or(&0.0);
            let b_to_a = pairwise_expenses
                .get(&(*member_b, *member_a))
                .unwrap_or(&0.0);

            if a_to_b > b_to_a {
                necessary_payments.insert((*member_a, *member_b), *a_to_b - *b_to_a);
            } else if b_to_a > a_to_b {
                necessary_payments.insert((*member_b, *member_a), *b_to_a - *a_to_b);
            }
        }
    }

    let mut payments = Vec::new();

    for (key, value) in &necessary_payments {
        let (from_member_id, to_member_id) = key;
        let amount = *value;

        if *from_member_id == member_id {
            payments.push(models::Balance {
                member_id: *to_member_id,
                amount,
                direction: models::PaymentDirection::Outbound,
            })
        } else if *to_member_id == member_id {
            payments.push(models::Balance {
                member_id: *from_member_id,
                amount,
                direction: models::PaymentDirection::Inbound,
            })
        }
    }

    return payments;
}
