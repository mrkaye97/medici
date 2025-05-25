pub mod models;
pub mod schema;
use diesel::prelude::*;
use dotenvy::dotenv;
use petgraph::{Graph, algo::ford_fulkerson};
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
    let mut payments = Vec::new();

    if expenses.is_empty() {
        return payments;
    }

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

    let mut member_id_to_balance: HashMap<uuid::Uuid, f64> = HashMap::new();

    for ((from_member_id, to_member_id), value) in &necessary_payments {
        let amount = *value;

        if *from_member_id == member_id {
            member_id_to_balance
                .entry(*from_member_id)
                .and_modify(|e| *e -= amount)
                .or_insert(-amount);
            member_id_to_balance
                .entry(*to_member_id)
                .and_modify(|e| *e += amount)
                .or_insert(amount);
        } else if *to_member_id == member_id {
            member_id_to_balance
                .entry(*to_member_id)
                .and_modify(|e| *e += amount)
                .or_insert(amount);
            member_id_to_balance
                .entry(*from_member_id)
                .and_modify(|e| *e -= amount)
                .or_insert(-amount);
        }
    }

    let net_payers: HashSet<uuid::Uuid> = member_id_to_balance
        .iter()
        .filter(|x| *x.1 < 0.0)
        .map(|x| *x.0)
        .collect();

    let net_receivers: HashSet<uuid::Uuid> = member_id_to_balance
        .iter()
        .filter(|x| *x.1 > 0.0)
        .map(|x| *x.0)
        .collect();

    let mut graph = Graph::<uuid::Uuid, f64>::new();

    for ((from_member_id, to_member_id), payment) in &necessary_payments {
        let from_node = graph
            .node_indices()
            .find(|&n| graph[n] == *from_member_id)
            .unwrap_or_else(|| graph.add_node(*from_member_id));

        let to_node = graph
            .node_indices()
            .find(|&n| graph[n] == *to_member_id)
            .unwrap_or_else(|| graph.add_node(*to_member_id));

        graph.add_edge(from_node, to_node, *payment);
    }

    for payer_member_id in net_payers {
        for receiver_member_id in net_receivers.iter().clone() {
            let destination = graph
                .node_indices()
                .find(|&n| graph[n] == *receiver_member_id)
                .unwrap();

            let source = graph
                .node_indices()
                .find(|&n| graph[n] == payer_member_id)
                .unwrap();

            let (max_flow, edge_flows) = ford_fulkerson(&graph, source, destination);

            for edge_index in graph.edge_indices() {
                let flow = edge_flows[edge_index.index()];
                let (source_node_index, target_node_index) =
                    graph.edge_endpoints(edge_index).unwrap();

                if source_node_index == source && target_node_index == destination {
                    if let Some(weight) = graph.edge_weight_mut(edge_index) {
                        *weight = max_flow;
                    }

                    continue;
                }

                if let Some(weight) = graph.edge_weight_mut(edge_index) {
                    *weight = *weight - flow;
                }
            }
        }
    }

    for edge in graph.edge_indices() {
        let (source_node_index, target_node_index) = graph.edge_endpoints(edge).unwrap();
        let source_member_id = graph[source_node_index];
        let target_member_id = graph[target_node_index];
        let amount = *graph.edge_weight(edge).unwrap();

        if source_member_id == member_id && amount > 0.0 {
            payments.push(models::Balance {
                member_id: target_member_id,
                amount,
                direction: models::PaymentDirection::Outbound,
            });
        } else if target_member_id == member_id {
            payments.push(models::Balance {
                member_id: source_member_id,
                amount,
                direction: models::PaymentDirection::Inbound,
            });
        }
    }

    return payments;
}
