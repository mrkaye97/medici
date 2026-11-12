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

/// The level of access a request needs to a pool.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PoolAccess {
    Member,
    Admin,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PoolAccessError {
    /// The caller is not in the pool. Handlers report this as "not found" so
    /// non-members can't probe which pool IDs exist.
    NotMember,
    /// The caller is in the pool but the action needs an admin.
    NotAdmin,
}

/// Decide whether a caller with `role` in a pool (`None` = not a member) may
/// perform an action that needs `required` access.
pub fn check_pool_access(
    role: Option<models::PoolRole>,
    required: PoolAccess,
) -> Result<models::PoolRole, PoolAccessError> {
    match (role, required) {
        (None, _) => Err(PoolAccessError::NotMember),
        (Some(models::PoolRole::PARTICIPANT), PoolAccess::Admin) => Err(PoolAccessError::NotAdmin),
        (Some(role), _) => Ok(role),
    }
}

/// An expense may only reference people who are in the pool: both the payer
/// and every debtor on its line items.
pub fn expense_participants_are_pool_members(
    pool_member_ids: &HashSet<uuid::Uuid>,
    paid_by_member_id: Option<uuid::Uuid>,
    debtor_member_ids: &[uuid::Uuid],
) -> bool {
    paid_by_member_id.map_or(true, |id| pool_member_ids.contains(&id))
        && debtor_member_ids
            .iter()
            .all(|id| pool_member_ids.contains(id))
}

/// Default splits must add up to 100% within this many hundredths of a
/// percent, so 33.33 x 3 = 99.99 is accepted. Stored splits are then rounded
/// to exactly 100.00. The database trigger allows 0.015 so float noise in an
/// exact 100.00 can't trip it.
pub const SPLIT_TOTAL_TOLERANCE_HUNDREDTHS: i64 = 1;

/// Below this, a balance counts as settled (a fraction of a cent).
pub const BALANCE_EPSILON: f64 = 0.005;

fn to_hundredths(percent: f64) -> i64 {
    (percent * 100.0).round() as i64
}

fn from_hundredths(hundredths: i64) -> f64 {
    hundredths as f64 / 100.0
}

#[derive(Debug, Clone, PartialEq)]
pub enum SplitValidationError {
    /// A pool member was left out of the update.
    MissingMember(uuid::Uuid),
    /// The update names someone who isn't in the pool.
    UnknownMember(uuid::Uuid),
    /// The same member appears more than once.
    DuplicateMember(uuid::Uuid),
    /// A percentage is negative, over 100, or not a number.
    OutOfRange(uuid::Uuid),
    /// The percentages don't add up to 100. Holds the actual total.
    BadTotal(f64),
}

impl std::fmt::Display for SplitValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::MissingMember(_) => write!(f, "Every pool member needs a split percentage"),
            Self::UnknownMember(_) => write!(f, "Splits can only include members of this pool"),
            Self::DuplicateMember(_) => write!(f, "Each member can only appear once"),
            Self::OutOfRange(_) => write!(f, "Split percentages must be between 0 and 100"),
            Self::BadTotal(total) => {
                write!(
                    f,
                    "Split percentages must add up to 100% (got {:.2}%)",
                    total
                )
            }
        }
    }
}

/// Validate a full set of default splits for a pool and round each to two
/// decimal places. Every member must appear exactly once.
pub fn validate_default_splits(
    pool_member_ids: &HashSet<uuid::Uuid>,
    splits: &[(uuid::Uuid, f64)],
) -> Result<Vec<(uuid::Uuid, f64)>, SplitValidationError> {
    let mut seen = HashSet::new();
    let mut rounded = Vec::with_capacity(splits.len());

    for &(member_id, percent) in splits {
        if !pool_member_ids.contains(&member_id) {
            return Err(SplitValidationError::UnknownMember(member_id));
        }
        if !seen.insert(member_id) {
            return Err(SplitValidationError::DuplicateMember(member_id));
        }
        if !percent.is_finite() || percent < 0.0 || percent > 100.0 {
            return Err(SplitValidationError::OutOfRange(member_id));
        }
        rounded.push((member_id, percent));
    }

    if let Some(missing) = pool_member_ids.iter().find(|id| !seen.contains(id)) {
        return Err(SplitValidationError::MissingMember(*missing));
    }

    let total: f64 = rounded.iter().map(|(_, p)| p).sum();
    if (to_hundredths(total) - 10_000).abs() > SPLIT_TOTAL_TOLERANCE_HUNDREDTHS {
        return Err(SplitValidationError::BadTotal(total));
    }

    Ok(round_to_exact_hundred(&rounded))
}

/// Round percentages to two decimals so they add up to exactly 100.00, using
/// the largest-remainder method: floor everything to hundredths, then give
/// the missing hundredths to the values that lost the most in rounding.
/// Rounding each value on its own can drift (33.333 x 3 -> 99.99).
fn round_to_exact_hundred(splits: &[(uuid::Uuid, f64)]) -> Vec<(uuid::Uuid, f64)> {
    let total: f64 = splits.iter().map(|(_, p)| p).sum();
    if total <= 0.0 {
        return splits.to_vec();
    }

    // Scale to exactly 10,000 hundredths first so small input noise is absorbed.
    let scaled: Vec<f64> = splits.iter().map(|(_, p)| p / total * 10_000.0).collect();
    let mut hundredths: Vec<i64> = scaled.iter().map(|x| x.floor() as i64).collect();

    let mut order: Vec<usize> = (0..splits.len()).collect();
    order.sort_by(|&a, &b| {
        let ra = scaled[a] - scaled[a].floor();
        let rb = scaled[b] - scaled[b].floor();
        rb.partial_cmp(&ra)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(a.cmp(&b))
    });

    let missing = 10_000 - hundredths.iter().sum::<i64>();
    for &i in order.iter().take(missing.max(0) as usize) {
        hundredths[i] += 1;
    }

    splits
        .iter()
        .zip(hundredths)
        .map(|(&(id, _), h)| (id, from_hundredths(h)))
        .collect()
}

/// After a member leaves, share out whatever is missing from 100% evenly
/// among the remaining members. The math is done in whole hundredths of a
/// percent, so the result adds up to exactly 100.00. Any leftover hundredths
/// that don't divide evenly go to `remainder_to` (the admin doing the removal).
pub fn redistribute_splits(
    remaining: &[(uuid::Uuid, f64)],
    remainder_to: uuid::Uuid,
) -> Vec<(uuid::Uuid, f64)> {
    if remaining.is_empty() {
        return Vec::new();
    }

    let current: Vec<(uuid::Uuid, i64)> = remaining
        .iter()
        .map(|&(id, p)| (id, to_hundredths(p)))
        .collect();

    let to_assign = 10_000 - current.iter().map(|(_, h)| h).sum::<i64>();
    let n = current.len() as i64;
    let per_member = to_assign.div_euclid(n);
    let leftover = to_assign.rem_euclid(n);

    let has_remainder_target = current.iter().any(|(id, _)| *id == remainder_to);

    current
        .iter()
        .enumerate()
        .map(|(i, &(id, h))| {
            let gets_leftover = if has_remainder_target {
                id == remainder_to
            } else {
                i == 0
            };
            let extra = if gets_leftover { leftover } else { 0 };
            (id, from_hundredths(h + per_member + extra))
        })
        .collect()
}

/// Whether `member_id` still owes or is owed anything in the pool, given the
/// pool's unsettled debts.
pub fn has_outstanding_balance(member_id: uuid::Uuid, debts: Vec<models::DebtPair>) -> bool {
    compute_balances_for_member(member_id, debts)
        .iter()
        .any(|b| b.amount > BALANCE_EPSILON)
}

/// A payment to record when settling up: `payer` paid `receiver` `amount`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SettlementPayment {
    pub payer: uuid::Uuid,
    pub receiver: uuid::Uuid,
    pub amount: f64,
}

/// The payments that clear `me`'s balances, given those balances (as from
/// `compute_balances_for_member(me, ..)`). With `with`, only the balance with
/// that one person is cleared. Amounts are rounded to cents; anything under
/// half a cent is treated as already settled.
pub fn settlement_payments(
    me: uuid::Uuid,
    balances: &[models::Balance],
    with: Option<uuid::Uuid>,
) -> Vec<SettlementPayment> {
    balances
        .iter()
        .filter(|b| with.map_or(true, |other| b.member_id == other))
        .filter(|b| b.member_id != me)
        .map(|b| {
            let amount = (b.amount * 100.0).round() / 100.0;
            match b.direction {
                // I owe them: I pay them.
                models::PaymentDirection::Outbound => SettlementPayment {
                    payer: me,
                    receiver: b.member_id,
                    amount,
                },
                // They owe me: they paid me.
                models::PaymentDirection::Inbound => SettlementPayment {
                    payer: b.member_id,
                    receiver: me,
                    amount,
                },
            }
        })
        .filter(|p| p.amount > BALANCE_EPSILON)
        .collect()
}

/// Checks an expense's total against its split. The database trigger only
/// runs on insert, so edits were never checked. Same 5-cent tolerance as the
/// trigger, to allow for splits that don't divide evenly.
pub fn validate_expense_amounts(
    amount: f64,
    line_items: &[(uuid::Uuid, f64)],
) -> Result<(), String> {
    if !amount.is_finite() || amount <= 0.0 {
        return Err("The amount must be more than zero".to_string());
    }
    if line_items.is_empty() {
        return Err("Split the expense between at least one person".to_string());
    }

    let mut seen = HashSet::new();
    for &(member_id, share) in line_items {
        if !share.is_finite() || share < 0.0 {
            return Err("Each person's share must be zero or more".to_string());
        }
        if !seen.insert(member_id) {
            return Err("Each person can only appear once in the split".to_string());
        }
    }

    let total: f64 = line_items.iter().map(|(_, s)| s).sum();
    if (total - amount).abs() > 0.05 {
        return Err(format!(
            "The split adds up to {:.2}, but the amount is {:.2}",
            total, amount
        ));
    }

    Ok(())
}

/// Venmo usernames are 5-30 letters, digits, dashes or underscores. Accepts
/// a leading "@" and surrounding spaces, and returns the bare handle. An
/// empty handle clears it.
pub fn normalize_venmo_handle(handle: &str) -> Result<String, String> {
    let handle = handle.trim().trim_start_matches('@');
    if handle.is_empty() {
        return Ok(String::new());
    }

    let valid_length = (5..=30).contains(&handle.chars().count());
    let valid_chars = handle
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');

    if valid_length && valid_chars {
        Ok(handle.to_string())
    } else {
        Err("Venmo handles are 5-30 letters, numbers, dashes or underscores".to_string())
    }
}

/// Failed logins allowed per account within `LOGIN_THROTTLE_WINDOW_SECONDS`.
pub const LOGIN_MAX_FAILURES: u32 = 10;
pub const LOGIN_THROTTLE_WINDOW_SECONDS: i64 = 15 * 60;

/// Counts failed logins per (normalized) email, so a public server can't be
/// used to guess passwords without limit. Kept in memory: a restart clears
/// it, which is fine for slowing down guessing. Unknown emails are counted
/// the same as real ones so the limit doesn't reveal which accounts exist.
#[derive(Default)]
pub struct LoginThrottle {
    failures: HashMap<String, (u32, i64)>,
}

impl LoginThrottle {
    /// `Err(seconds)` until the account may try again, if it's locked out.
    pub fn check(&mut self, email: &str, now: i64) -> Result<(), i64> {
        let key = normalize_email(email);
        match self.failures.get(&key) {
            Some(&(count, window_start)) => {
                let window_end = window_start + LOGIN_THROTTLE_WINDOW_SECONDS;
                if now >= window_end {
                    self.failures.remove(&key);
                    Ok(())
                } else if count >= LOGIN_MAX_FAILURES {
                    Err(window_end - now)
                } else {
                    Ok(())
                }
            }
            None => Ok(()),
        }
    }

    pub fn record_failure(&mut self, email: &str, now: i64) {
        // Keep memory bounded: drop windows that have already ended.
        if self.failures.len() > 10_000 {
            self.failures
                .retain(|_, &mut (_, start)| now < start + LOGIN_THROTTLE_WINDOW_SECONDS);
        }

        let entry = self
            .failures
            .entry(normalize_email(email))
            .or_insert((0, now));
        if now >= entry.1 + LOGIN_THROTTLE_WINDOW_SECONDS {
            *entry = (0, now);
        }
        entry.0 += 1;
    }

    pub fn record_success(&mut self, email: &str) {
        self.failures.remove(&normalize_email(email));
    }
}

/// Emails are matched case-insensitively and without surrounding spaces, so
/// "Anna@Example.com " finds the account for "anna@example.com".
pub fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

pub const MIN_PASSWORD_LENGTH: usize = 8;
/// bcrypt ignores everything after 72 bytes, so longer passwords would give
/// a false sense of strength.
pub const MAX_PASSWORD_BYTES: usize = 72;

pub fn validate_new_password(password: &str) -> Result<(), String> {
    if password.chars().count() < MIN_PASSWORD_LENGTH {
        return Err(format!(
            "Password must be at least {} characters",
            MIN_PASSWORD_LENGTH
        ));
    }
    if password.len() > MAX_PASSWORD_BYTES {
        return Err(format!(
            "Password must be at most {} bytes",
            MAX_PASSWORD_BYTES
        ));
    }
    Ok(())
}

/// How the current user relates to someone they looked up by email.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum Relationship {
    /// The email is the caller's own.
    Yourself,
    /// No friendship in either direction yet; a request can be sent.
    NotFriends,
    AlreadyFriends,
    /// The caller already sent a request that's still pending.
    RequestSent,
    /// The other person already sent the caller a request.
    RequestReceived,
}

/// Work out the relationship from the friendship row between the two members,
/// if any, given as `(inviting_member_id, status)`.
pub fn relationship_between(
    me: uuid::Uuid,
    other: uuid::Uuid,
    friendship: Option<(uuid::Uuid, models::FriendshipStatus)>,
) -> Relationship {
    if me == other {
        return Relationship::Yourself;
    }
    match friendship {
        None => Relationship::NotFriends,
        Some((_, models::FriendshipStatus::Accepted)) => Relationship::AlreadyFriends,
        Some((inviter, models::FriendshipStatus::Pending)) if inviter == me => {
            Relationship::RequestSent
        }
        Some((_, models::FriendshipStatus::Pending)) => Relationship::RequestReceived,
    }
}

/// How long a password reset link works.
pub const PASSWORD_RESET_TTL_MINUTES: i64 = 30;
/// At most one reset email per account in this window, so the endpoint can't
/// be used to flood someone's inbox.
pub const PASSWORD_RESET_THROTTLE_SECONDS: i64 = 60;

/// A new reset token: 32 bytes from the OS's secure random generator, as hex.
pub fn generate_reset_token() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    to_hex(&bytes)
}

/// What gets stored for a reset token. Tokens are long and random, so a
/// plain SHA-256 is enough (no need for a slow hash like bcrypt).
pub fn hash_reset_token(token: &str) -> String {
    use sha2::{Digest, Sha256};
    to_hex(&Sha256::digest(token.trim().as_bytes()))
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// A session token is only valid if it was issued no earlier than the last
/// password change. JWT `iat` is whole seconds, so compare at that precision;
/// otherwise a session issued right after a reset would be rejected.
pub fn session_is_current(
    issued_at_seconds: i64,
    password_changed_at: chrono::DateTime<chrono::Utc>,
) -> bool {
    issued_at_seconds >= password_changed_at.timestamp()
}

/// A real bcrypt hash of a throwaway value. Login checks against it when the
/// email doesn't exist, so a failed login takes the same time whether or not
/// the account exists.
static DUMMY_PASSWORD_HASH: once_cell::sync::Lazy<String> = once_cell::sync::Lazy::new(|| {
    bcrypt::hash("medici-dummy-password", bcrypt::DEFAULT_COST).expect("bcrypt hash")
});

/// Check a login attempt against the stored `(member_id, bcrypt_hash)`, if
/// any. Returns the member ID when the password is correct. Works for both
/// new random-salt hashes and the older fixed-salt hashes, because bcrypt
/// stores the salt inside the hash.
pub fn verify_login(password: &str, stored: Option<(uuid::Uuid, String)>) -> Option<uuid::Uuid> {
    match stored {
        Some((id, hash)) => matches!(bcrypt::verify(password, &hash), Ok(true)).then_some(id),
        None => {
            let _ = bcrypt::verify(password, DUMMY_PASSWORD_HASH.as_str());
            None
        }
    }
}

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
    tracing::info!("Computing simplified balances for member: {}", member_id);

    if expenses.is_empty() {
        return Vec::new();
    }

    let (mut graph, net_payers, net_receivers) = debt_pairs_to_graph(member_id, &expenses);

    for payer_member_id in net_payers {
        for receiver_member_id in net_receivers.iter() {
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
