pub mod models;
pub mod schema;
use diesel::prelude::*;
use dotenvy::dotenv;
use petgraph::{Graph, algo::ford_fulkerson};
use std::{
    collections::{HashMap, HashSet},
    env,
};

#[cfg(test)]
mod tests;

pub fn establish_connection() -> PgConnection {
    dotenv().ok();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    PgConnection::establish(&database_url)
        .unwrap_or_else(|_| panic!("Error connecting to {}", database_url))
}

fn build_necessary_payments(
    unique_member_ids: &HashSet<uuid::Uuid>,
    pairwise_expenses: &HashMap<(uuid::Uuid, uuid::Uuid), f64>,
) -> HashMap<(uuid::Uuid, uuid::Uuid), f64> {
    unique_member_ids
        .into_iter()
        .fold(HashMap::new(), |mut acc, a| {
            for b in unique_member_ids {
                let a_to_b = pairwise_expenses.get(&(*a, *b)).unwrap_or(&0.0);
                let b_to_a = pairwise_expenses.get(&(*b, *a)).unwrap_or(&0.0);

                if a_to_b > b_to_a {
                    acc.insert((*a, *b), *a_to_b - *b_to_a);
                } else if b_to_a > a_to_b {
                    acc.insert((*b, *a), *b_to_a - *a_to_b);
                }
            }
            acc
        })
}

fn determine_net_payers_and_lenders(
    member_id: uuid::Uuid,
    necessary_payments: &HashMap<(uuid::Uuid, uuid::Uuid), f64>,
) -> (HashSet<uuid::Uuid>, HashSet<uuid::Uuid>) {
    let member_id_to_balance = necessary_payments.iter().fold(
        HashMap::new(),
        |mut acc, ((from_member_id, to_member_id), value)| {
            let amount = *value;

            if *from_member_id == member_id {
                acc.entry(*from_member_id)
                    .and_modify(|e| *e -= amount)
                    .or_insert(-amount);

                acc.entry(*to_member_id)
                    .and_modify(|e| *e += amount)
                    .or_insert(amount);
            } else if *to_member_id == member_id {
                acc.entry(*to_member_id)
                    .and_modify(|e| *e += amount)
                    .or_insert(amount);

                acc.entry(*from_member_id)
                    .and_modify(|e| *e -= amount)
                    .or_insert(-amount);
            }

            acc
        },
    );

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

    (net_payers, net_receivers)
}

fn debt_pairs_to_graph(
    member_id: uuid::Uuid,
    expenses: &[models::DebtPair],
) -> (
    Graph<uuid::Uuid, f64, petgraph::Directed>,
    HashSet<uuid::Uuid>,
    HashSet<uuid::Uuid>,
) {
    let (pairwise_expenses, unique_member_ids) =
        expenses
            .into_iter()
            .fold((HashMap::new(), HashSet::new()), |acc, expense| {
                let (mut m, mut s) = acc;

                let from_member_id = expense.from_member_id;
                let to_member_id = expense.to_member_id;

                m.insert((from_member_id, to_member_id), expense.amount);
                s.insert(from_member_id);
                s.insert(to_member_id);

                (m, s)
            });

    let necessary_payments = build_necessary_payments(&unique_member_ids, &pairwise_expenses);

    let (net_payers, net_receivers) =
        determine_net_payers_and_lenders(member_id, &necessary_payments);

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

    return (graph, net_payers, net_receivers);
}

fn graph_to_payments(
    graph: &Graph<uuid::Uuid, f64, petgraph::Directed>,
    member_id: uuid::Uuid,
) -> Vec<models::Balance> {
    graph
        .edge_indices()
        .into_iter()
        .map(|edge| {
            let (source_node_index, target_node_index) = graph.edge_endpoints(edge).unwrap();
            let source_member_id = graph[source_node_index];
            let target_member_id = graph[target_node_index];
            let amount = *graph.edge_weight(edge).unwrap();

            return (amount, source_member_id, target_member_id);
        })
        .filter(|(amount, source_member_id, target_member_id)| {
            *amount > 0.0 && (*source_member_id == member_id || *target_member_id == member_id)
        })
        .map(|(amount, source_member_id, target_member_id)| {
            if source_member_id == member_id {
                return models::Balance {
                    member_id: target_member_id,
                    amount,
                    direction: models::PaymentDirection::Outbound,
                };
            } else {
                return models::Balance {
                    member_id: source_member_id,
                    amount,
                    direction: models::PaymentDirection::Inbound,
                };
            }
        })
        .collect()
}

pub fn compute_balances_for_member(
    member_id: uuid::Uuid,
    expenses: Vec<models::DebtPair>,
) -> Vec<models::Balance> {
    if expenses.is_empty() {
        return Vec::new();
    }

    let (mut graph, net_payers, net_receivers) = debt_pairs_to_graph(member_id, &expenses);

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

    graph_to_payments(&graph, member_id)
}
