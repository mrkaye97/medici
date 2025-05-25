use crate::compute_balances_for_member;
use crate::models::{Balance, DebtPair, PaymentDirection};
use std::collections::HashSet;
use uuid::Uuid;

#[cfg(test)]
mod tests {
    use super::*;

    fn uuid_from_u128(n: u128) -> Uuid {
        Uuid::from_u128(n)
    }

    fn assert_balances_correct(
        balances: &[Balance],
        expected_total: f64,
        expected_directions: &HashSet<PaymentDirection>,
    ) {
        let actual_total: f64 = balances.iter().map(|b| b.amount).sum();

        assert!(
            (actual_total - expected_total).abs() < 0.001,
            "Total balance amount {} does not match expected {}",
            actual_total,
            expected_total
        );

        let actual_directions: HashSet<PaymentDirection> =
            balances.iter().map(|b| b.direction.clone()).collect();

        assert_eq!(
            actual_directions, *expected_directions,
            "Balance directions do not match expected directions"
        );
    }

    #[test]
    fn test_empty_expenses() {
        let member_id = uuid_from_u128(1);
        let expenses = vec![];

        let balances = compute_balances_for_member(member_id, expenses);

        assert!(
            balances.is_empty(),
            "Expected empty balances for empty expenses"
        );
    }

    #[test]
    fn test_simple_two_person_debt() {
        let member_1 = uuid_from_u128(1);
        let member_2 = uuid_from_u128(2);

        let expenses = vec![DebtPair {
            from_member_id: member_1,
            to_member_id: member_2,
            amount: 100.0,
        }];

        let balances_1 = compute_balances_for_member(member_1, expenses.clone());
        let expected_directions_1: HashSet<PaymentDirection> = [PaymentDirection::Outbound].into();
        assert_balances_correct(&balances_1, 100.0, &expected_directions_1);
        assert_eq!(balances_1.len(), 1);
        assert_eq!(balances_1[0].member_id, member_2);

        let balances_2 = compute_balances_for_member(member_2, expenses);
        let expected_directions_2: HashSet<PaymentDirection> = [PaymentDirection::Inbound].into();
        assert_balances_correct(&balances_2, 100.0, &expected_directions_2);
        assert_eq!(balances_2.len(), 1);
        assert_eq!(balances_2[0].member_id, member_1);
    }

    #[test]
    fn test_cancellation_of_equal_debts() {
        let member_1 = uuid_from_u128(1);
        let member_2 = uuid_from_u128(2);

        let expenses = vec![
            DebtPair {
                from_member_id: member_1,
                to_member_id: member_2,
                amount: 50.0,
            },
            DebtPair {
                from_member_id: member_2,
                to_member_id: member_1,
                amount: 50.0,
            },
        ];

        let balances_1 = compute_balances_for_member(member_1, expenses.clone());
        assert!(
            balances_1.is_empty(),
            "Expected empty balances when debts cancel out"
        );

        let balances_2 = compute_balances_for_member(member_2, expenses);
        assert!(
            balances_2.is_empty(),
            "Expected empty balances when debts cancel out"
        );
    }

    #[test]
    fn test_net_debt_after_partial_cancellation() {
        let member_1 = uuid_from_u128(1);
        let member_2 = uuid_from_u128(2);

        let expenses = vec![
            DebtPair {
                from_member_id: member_1,
                to_member_id: member_2,
                amount: 100.0,
            },
            DebtPair {
                from_member_id: member_2,
                to_member_id: member_1,
                amount: 40.0,
            },
        ];

        let balances_1 = compute_balances_for_member(member_1, expenses.clone());
        let expected_directions_1: HashSet<PaymentDirection> = [PaymentDirection::Outbound].into();
        assert_balances_correct(&balances_1, 60.0, &expected_directions_1);
        assert_eq!(balances_1.len(), 1);
        assert_eq!(balances_1[0].member_id, member_2);
        assert!((balances_1[0].amount - 60.0).abs() < 0.001);

        let balances_2 = compute_balances_for_member(member_2, expenses);
        let expected_directions_2: HashSet<PaymentDirection> = [PaymentDirection::Inbound].into();
        assert_balances_correct(&balances_2, 60.0, &expected_directions_2);
        assert_eq!(balances_2.len(), 1);
        assert_eq!(balances_2[0].member_id, member_1);
        assert!((balances_2[0].amount - 60.0).abs() < 0.001);
    }

    #[test]
    fn test_simplification_of_circular_debt() {
        let member_1 = uuid_from_u128(1);
        let member_2 = uuid_from_u128(2);
        let member_3 = uuid_from_u128(3);

        let expenses = vec![
            DebtPair {
                from_member_id: member_1,
                to_member_id: member_2,
                amount: 100.0,
            },
            DebtPair {
                from_member_id: member_2,
                to_member_id: member_3,
                amount: 100.0,
            },
            DebtPair {
                from_member_id: member_3,
                to_member_id: member_1,
                amount: 100.0,
            },
        ];

        let balances_1 = compute_balances_for_member(member_1, expenses.clone());
        assert!(
            balances_1.is_empty(),
            "Expected empty balances for circular debt"
        );

        let balances_2 = compute_balances_for_member(member_2, expenses.clone());
        assert!(
            balances_2.is_empty(),
            "Expected empty balances for circular debt"
        );

        let balances_3 = compute_balances_for_member(member_3, expenses);
        assert!(
            balances_3.is_empty(),
            "Expected empty balances for circular debt"
        );
    }

    #[test]
    fn test_complex_debt_network() {
        let member_1 = uuid_from_u128(1);
        let member_2 = uuid_from_u128(2);
        let member_3 = uuid_from_u128(3);
        let member_4 = uuid_from_u128(4);

        let expenses = vec![
            DebtPair {
                from_member_id: member_1,
                to_member_id: member_2,
                amount: 100.0,
            },
            DebtPair {
                from_member_id: member_2,
                to_member_id: member_3,
                amount: 150.0,
            },
            DebtPair {
                from_member_id: member_3,
                to_member_id: member_4,
                amount: 75.0,
            },
            DebtPair {
                from_member_id: member_4,
                to_member_id: member_1,
                amount: 50.0,
            },
        ];

        let balances_1 = compute_balances_for_member(member_1, expenses.clone());

        assert_eq!(balances_1.len(), 1);
        assert_eq!(balances_1[0].direction, PaymentDirection::Outbound);
        assert!((balances_1[0].amount - 50.0).abs() < 0.001);

        let balances_3 = compute_balances_for_member(member_3, expenses.clone());

        let net_balance: f64 = balances_3
            .iter()
            .map(|b| match b.direction {
                PaymentDirection::Inbound => b.amount,
                PaymentDirection::Outbound => -b.amount,
            })
            .sum();
        assert!((net_balance - 75.0).abs() < 0.001);
    }

    #[test]
    fn test_simple_travel_through_graph() {
        let member_1 = uuid_from_u128(1);
        let member_2 = uuid_from_u128(2);
        let member_3 = uuid_from_u128(3);
        let member_4 = uuid_from_u128(4);

        let expenses = vec![
            DebtPair {
                from_member_id: member_1,
                to_member_id: member_4,
                amount: 100.0,
            },
            DebtPair {
                from_member_id: member_1,
                to_member_id: member_2,
                amount: 50.0,
            },
            DebtPair {
                from_member_id: member_1,
                to_member_id: member_3,
                amount: 50.0,
            },
            DebtPair {
                from_member_id: member_2,
                to_member_id: member_4,
                amount: 50.0,
            },
            DebtPair {
                from_member_id: member_3,
                to_member_id: member_4,
                amount: 75.0,
            },
        ];

        let balances_1 = compute_balances_for_member(member_1, expenses.clone());

        assert_eq!(balances_1.len(), 1);
        assert_eq!(balances_1[0].direction, PaymentDirection::Outbound);
        assert!((balances_1[0].amount - 200.0).abs() < 0.001);
        assert_eq!(balances_1[0].member_id, member_4);

        let balances_2 = compute_balances_for_member(member_2, expenses.clone());

        assert_eq!(balances_2.len(), 0);

        let balances_3 = compute_balances_for_member(member_3, expenses.clone());

        assert_eq!(balances_3.len(), 1);
        assert_eq!(balances_3[0].direction, PaymentDirection::Outbound);
        assert!((balances_3[0].amount - 25.0).abs() < 0.001);
        assert_eq!(balances_3[0].member_id, member_4);

        let mut balances_4 = compute_balances_for_member(member_4, expenses.clone());

        balances_4.sort_by(|a, b| a.member_id.cmp(&b.member_id));

        assert_eq!(balances_4.len(), 2);
        assert_eq!(balances_4[0].direction, PaymentDirection::Inbound);
        assert_eq!(balances_4[1].direction, PaymentDirection::Inbound);
        assert!((balances_4[0].amount - 200.0).abs() < 0.001);
        assert!((balances_4[1].amount - 25.0).abs() < 0.001);
        assert_eq!(balances_4[0].member_id, member_1);
        assert_eq!(balances_4[1].member_id, member_3);
    }

    #[test]
    fn test_members_with_no_direct_relation() {
        let member_1 = uuid_from_u128(1);
        let member_2 = uuid_from_u128(2);
        let member_3 = uuid_from_u128(3);

        let expenses = vec![
            DebtPair {
                from_member_id: member_1,
                to_member_id: member_2,
                amount: 100.0,
            },
            DebtPair {
                from_member_id: member_2,
                to_member_id: member_3,
                amount: 100.0,
            },
        ];

        let balances_1 = compute_balances_for_member(member_1, expenses.clone());
        assert_eq!(balances_1.len(), 1);
        assert_eq!(balances_1[0].member_id, member_2);
        assert_eq!(balances_1[0].direction, PaymentDirection::Outbound);

        let balances_3 = compute_balances_for_member(member_3, expenses);
        assert_eq!(balances_3.len(), 1);
        assert_eq!(balances_3[0].member_id, member_2);
        assert_eq!(balances_3[0].direction, PaymentDirection::Inbound);
    }

    #[test]
    fn test_decimal_amounts() {
        let member_1 = uuid_from_u128(1);
        let member_2 = uuid_from_u128(2);

        let expenses = vec![
            DebtPair {
                from_member_id: member_1,
                to_member_id: member_2,
                amount: 10.75,
            },
            DebtPair {
                from_member_id: member_2,
                to_member_id: member_1,
                amount: 5.25,
            },
        ];

        let balances_1 = compute_balances_for_member(member_1, expenses.clone());
        assert_eq!(balances_1.len(), 1);
        assert_eq!(balances_1[0].member_id, member_2);
        assert_eq!(balances_1[0].direction, PaymentDirection::Outbound);
        assert!((balances_1[0].amount - 5.50).abs() < 0.001);
    }
}
