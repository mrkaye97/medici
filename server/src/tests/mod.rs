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

#[cfg(test)]
mod access_tests {
    use crate::models::PoolRole;
    use crate::{
        PoolAccess, PoolAccessError, check_pool_access, expense_participants_are_pool_members,
    };
    use std::collections::HashSet;
    use uuid::Uuid;

    #[test]
    fn non_members_are_rejected_for_any_access() {
        assert_eq!(
            check_pool_access(None, PoolAccess::Member),
            Err(PoolAccessError::NotMember)
        );
        assert_eq!(
            check_pool_access(None, PoolAccess::Admin),
            Err(PoolAccessError::NotMember)
        );
    }

    #[test]
    fn participants_can_do_member_actions_but_not_admin_actions() {
        assert_eq!(
            check_pool_access(Some(PoolRole::PARTICIPANT), PoolAccess::Member),
            Ok(PoolRole::PARTICIPANT)
        );
        assert_eq!(
            check_pool_access(Some(PoolRole::PARTICIPANT), PoolAccess::Admin),
            Err(PoolAccessError::NotAdmin)
        );
    }

    #[test]
    fn admins_can_do_everything() {
        assert_eq!(
            check_pool_access(Some(PoolRole::ADMIN), PoolAccess::Member),
            Ok(PoolRole::ADMIN)
        );
        assert_eq!(
            check_pool_access(Some(PoolRole::ADMIN), PoolAccess::Admin),
            Ok(PoolRole::ADMIN)
        );
    }

    #[test]
    fn expense_participants_must_all_be_in_the_pool() {
        let a = Uuid::from_u128(1);
        let b = Uuid::from_u128(2);
        let outsider = Uuid::from_u128(99);
        let pool: HashSet<Uuid> = [a, b].into();

        assert!(expense_participants_are_pool_members(
            &pool,
            Some(a),
            &[a, b]
        ));
        assert!(expense_participants_are_pool_members(&pool, None, &[b]));
        assert!(!expense_participants_are_pool_members(
            &pool,
            Some(outsider),
            &[a]
        ));
        assert!(!expense_participants_are_pool_members(
            &pool,
            Some(a),
            &[a, outsider]
        ));
        assert!(!expense_participants_are_pool_members(
            &pool,
            None,
            &[outsider]
        ));
    }
}

#[cfg(test)]
mod password_tests {
    use crate::verify_login;
    use uuid::Uuid;

    // Low cost keeps the tests fast; the cost is stored in the hash itself.
    const TEST_COST: u32 = 4;

    #[test]
    fn correct_password_returns_member_id() {
        let id = Uuid::from_u128(7);
        let hash = bcrypt::hash("hunter2", TEST_COST).unwrap();
        assert_eq!(verify_login("hunter2", Some((id, hash))), Some(id));
    }

    #[test]
    fn wrong_password_or_unknown_email_is_rejected() {
        let id = Uuid::from_u128(7);
        let hash = bcrypt::hash("hunter2", TEST_COST).unwrap();
        assert_eq!(verify_login("wrong", Some((id, hash))), None);
        assert_eq!(verify_login("hunter2", None), None);
    }

    #[test]
    fn same_password_gets_different_hashes() {
        let first = bcrypt::hash("hunter2", TEST_COST).unwrap();
        let second = bcrypt::hash("hunter2", TEST_COST).unwrap();
        assert_ne!(first, second);
    }

    #[test]
    fn legacy_fixed_salt_hashes_still_verify() {
        // Existing accounts were hashed with this fixed salt. They must keep
        // working with no migration or forced password reset.
        let legacy_salt: [u8; 16] = *b"MediciSalt123456";
        let legacy_hash = bcrypt::hash_with_salt("hunter2", TEST_COST, legacy_salt)
            .unwrap()
            .to_string();
        let id = Uuid::from_u128(7);

        assert_eq!(
            verify_login("hunter2", Some((id, legacy_hash.clone()))),
            Some(id)
        );
        assert_eq!(verify_login("wrong", Some((id, legacy_hash))), None);
    }
}

#[cfg(test)]
mod split_tests {
    use crate::models::DebtPair;
    use crate::{
        SplitValidationError, has_outstanding_balance, redistribute_splits, validate_default_splits,
    };
    use std::collections::HashSet;
    use uuid::Uuid;

    fn id(n: u128) -> Uuid {
        Uuid::from_u128(n)
    }

    fn total(splits: &[(Uuid, f64)]) -> f64 {
        splits.iter().map(|(_, p)| p).sum()
    }

    #[test]
    fn valid_splits_are_accepted_and_rounded() {
        let pool: HashSet<Uuid> = [id(1), id(2), id(3)].into();
        let result =
            validate_default_splits(&pool, &[(id(1), 33.333), (id(2), 33.333), (id(3), 33.334)])
                .unwrap();
        // The largest remainder (33.334) gets the extra hundredth.
        assert_eq!(result, vec![(id(1), 33.33), (id(2), 33.33), (id(3), 33.34)]);
        assert!((total(&result) - 100.0).abs() < 1e-9);
    }

    #[test]
    fn thirds_entered_as_two_decimals_are_accepted() {
        let pool: HashSet<Uuid> = [id(1), id(2), id(3)].into();
        let result =
            validate_default_splits(&pool, &[(id(1), 33.33), (id(2), 33.33), (id(3), 33.33)])
                .unwrap();
        assert!((total(&result) - 100.0).abs() < 1e-9);
    }

    #[test]
    fn zero_percent_is_allowed() {
        let pool: HashSet<Uuid> = [id(1), id(2)].into();
        assert!(validate_default_splits(&pool, &[(id(1), 100.0), (id(2), 0.0)]).is_ok());
    }

    #[test]
    fn invalid_splits_are_rejected_with_a_reason() {
        let pool: HashSet<Uuid> = [id(1), id(2)].into();

        assert_eq!(
            validate_default_splits(&pool, &[(id(1), 50.0), (id(2), 40.0)]),
            Err(SplitValidationError::BadTotal(90.0))
        );
        assert_eq!(
            validate_default_splits(&pool, &[(id(1), 100.0)]),
            Err(SplitValidationError::MissingMember(id(2)))
        );
        assert_eq!(
            validate_default_splits(&pool, &[(id(1), 50.0), (id(2), 25.0), (id(9), 25.0)]),
            Err(SplitValidationError::UnknownMember(id(9)))
        );
        assert_eq!(
            validate_default_splits(&pool, &[(id(1), 50.0), (id(1), 50.0)]),
            Err(SplitValidationError::DuplicateMember(id(1)))
        );
        assert_eq!(
            validate_default_splits(&pool, &[(id(1), 150.0), (id(2), -50.0)]),
            Err(SplitValidationError::OutOfRange(id(1)))
        );
        assert_eq!(
            validate_default_splits(&pool, &[(id(1), f64::NAN), (id(2), 100.0)]),
            Err(SplitValidationError::OutOfRange(id(1)))
        );
    }

    #[test]
    fn removed_share_is_split_evenly_and_totals_exactly_100() {
        // A 4-way even split loses one member: 25 is shared among 3.
        let remaining = [(id(1), 25.0), (id(2), 25.0), (id(3), 25.0)];
        let result = redistribute_splits(&remaining, id(1));

        // 2500 hundredths / 3 = 833 each, with 1 left over for the admin.
        assert_eq!(result, vec![(id(1), 33.34), (id(2), 33.33), (id(3), 33.33)]);
        assert!((total(&result) - 100.0).abs() < 1e-9);
    }

    #[test]
    fn redistribution_keeps_uneven_existing_splits() {
        // Removed member had 30%; the others keep their proportions plus 15 each.
        let remaining = [(id(1), 50.0), (id(2), 20.0)];
        let result = redistribute_splits(&remaining, id(1));
        assert_eq!(result, vec![(id(1), 65.0), (id(2), 35.0)]);
    }

    #[test]
    fn redistribution_absorbs_float_noise_from_old_data() {
        let remaining = [(id(1), 33.333333), (id(2), 33.333333)];
        let result = redistribute_splits(&remaining, id(2));
        assert!((total(&result) - 100.0).abs() < 1e-9);
    }

    #[test]
    fn redistribution_with_no_one_left_is_empty() {
        assert!(redistribute_splits(&[], id(1)).is_empty());
    }

    #[test]
    fn outstanding_balance_detection() {
        let debts = vec![DebtPair {
            from_member_id: id(2),
            to_member_id: id(1),
            amount: 12.5,
        }];

        assert!(has_outstanding_balance(id(2), debts.clone()));
        assert!(has_outstanding_balance(id(1), debts.clone()));
        assert!(!has_outstanding_balance(id(3), debts));
        assert!(!has_outstanding_balance(id(2), vec![]));
    }

    #[test]
    fn debts_that_cancel_out_are_not_outstanding() {
        let debts = vec![
            DebtPair {
                from_member_id: id(1),
                to_member_id: id(2),
                amount: 20.0,
            },
            DebtPair {
                from_member_id: id(2),
                to_member_id: id(1),
                amount: 20.0,
            },
        ];
        assert!(!has_outstanding_balance(id(1), debts));
    }
}

#[cfg(test)]
mod friend_tests {
    use crate::models::FriendshipStatus;
    use crate::{Relationship, normalize_email, relationship_between, validate_new_password};
    use uuid::Uuid;

    fn id(n: u128) -> Uuid {
        Uuid::from_u128(n)
    }

    #[test]
    fn emails_are_trimmed_and_lowercased() {
        assert_eq!(normalize_email("  Anna@Example.COM "), "anna@example.com");
    }

    #[test]
    fn relationship_covers_every_case() {
        let me = id(1);
        let them = id(2);

        assert_eq!(relationship_between(me, me, None), Relationship::Yourself);
        assert_eq!(
            relationship_between(me, them, None),
            Relationship::NotFriends
        );
        assert_eq!(
            relationship_between(me, them, Some((me, FriendshipStatus::Accepted))),
            Relationship::AlreadyFriends
        );
        assert_eq!(
            relationship_between(me, them, Some((them, FriendshipStatus::Accepted))),
            Relationship::AlreadyFriends
        );
        assert_eq!(
            relationship_between(me, them, Some((me, FriendshipStatus::Pending))),
            Relationship::RequestSent
        );
        assert_eq!(
            relationship_between(me, them, Some((them, FriendshipStatus::Pending))),
            Relationship::RequestReceived
        );
    }

    #[test]
    fn password_rules() {
        assert!(validate_new_password("short").is_err());
        assert!(validate_new_password("long enough").is_ok());
        assert!(validate_new_password(&"x".repeat(73)).is_err());
        // Counted in characters for the minimum, so 8 accented letters pass.
        assert!(validate_new_password("éééééééé").is_ok());
    }
}

#[cfg(test)]
mod reset_token_tests {
    use crate::{generate_reset_token, hash_reset_token, session_is_current};
    use chrono::{TimeZone, Utc};

    #[test]
    fn tokens_are_long_random_hex() {
        let a = generate_reset_token();
        let b = generate_reset_token();
        assert_eq!(a.len(), 64);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(a, b);
    }

    #[test]
    fn stored_hash_is_not_the_token_and_is_stable() {
        let token = generate_reset_token();
        let hash = hash_reset_token(&token);
        assert_ne!(hash, token);
        assert_eq!(hash, hash_reset_token(&token));
        assert_ne!(hash, hash_reset_token(&generate_reset_token()));
        // Stray whitespace from copy-pasting a link still matches.
        assert_eq!(hash, hash_reset_token(&format!(" {}\n", token)));
    }

    #[test]
    fn sessions_from_before_a_password_change_are_rejected() {
        let changed = Utc.timestamp_opt(1_000, 500_000_000).unwrap(); // 1000.5s

        assert!(!session_is_current(999, changed));
        // Issued in the same second as the change (iat is whole seconds).
        assert!(session_is_current(1_000, changed));
        assert!(session_is_current(1_001, changed));
        // Accounts that never reset have the epoch, so every session is fine.
        assert!(session_is_current(0, Utc.timestamp_opt(0, 0).unwrap()));
    }
}

#[cfg(test)]
mod tighten_up_tests {
    use crate::models::{Balance, DebtPair, PaymentDirection};
    use crate::{
        LOGIN_MAX_FAILURES, LOGIN_THROTTLE_WINDOW_SECONDS, LoginThrottle, SettlementPayment,
        compute_balances_for_member, normalize_venmo_handle, settlement_payments,
        validate_expense_amounts,
    };
    use uuid::Uuid;

    fn id(n: u128) -> Uuid {
        Uuid::from_u128(n)
    }

    fn balance(member: u128, amount: f64, direction: PaymentDirection) -> Balance {
        Balance {
            member_id: id(member),
            amount,
            direction,
        }
    }

    #[test]
    fn settling_records_payments_in_the_right_direction() {
        let me = id(1);
        let balances = vec![
            balance(2, 10.0, PaymentDirection::Outbound), // I owe 2
            balance(3, 4.255, PaymentDirection::Inbound), // 3 owes me
        ];

        assert_eq!(
            settlement_payments(me, &balances, None),
            vec![
                SettlementPayment {
                    payer: me,
                    receiver: id(2),
                    amount: 10.0
                },
                SettlementPayment {
                    payer: id(3),
                    receiver: me,
                    amount: 4.26
                },
            ]
        );
    }

    #[test]
    fn settling_with_one_person_leaves_others_alone() {
        let me = id(1);
        let balances = vec![
            balance(2, 10.0, PaymentDirection::Outbound),
            balance(3, 5.0, PaymentDirection::Inbound),
        ];
        assert_eq!(
            settlement_payments(me, &balances, Some(id(3))),
            vec![SettlementPayment {
                payer: id(3),
                receiver: me,
                amount: 5.0
            }]
        );
        assert!(settlement_payments(me, &balances, Some(id(9))).is_empty());
    }

    #[test]
    fn fractions_of_a_cent_are_already_settled() {
        let balances = vec![balance(2, 0.004, PaymentDirection::Outbound)];
        assert!(settlement_payments(id(1), &balances, None).is_empty());
    }

    #[test]
    fn a_recorded_payment_clears_the_balance_between_the_two() {
        // Bob owes Alice 30 (her dinner) and Carol owes Alice 30.
        let (alice, bob, carol) = (id(1), id(2), id(3));
        let mut debts = vec![
            DebtPair {
                from_member_id: bob,
                to_member_id: alice,
                amount: 30.0,
            },
            DebtPair {
                from_member_id: carol,
                to_member_id: alice,
                amount: 30.0,
            },
        ];

        let payments =
            settlement_payments(bob, &compute_balances_for_member(bob, debts.clone()), None);
        assert_eq!(
            payments,
            vec![SettlementPayment {
                payer: bob,
                receiver: alice,
                amount: 30.0
            }]
        );

        // Recording it adds "alice owes bob 30", which cancels his debt.
        debts.push(DebtPair {
            from_member_id: alice,
            to_member_id: bob,
            amount: 30.0,
        });

        assert!(compute_balances_for_member(bob, debts.clone()).is_empty());
        // Carol still owes Alice: settling up between two people touches no one else.
        let carol_balances = compute_balances_for_member(carol, debts);
        assert_eq!(carol_balances.len(), 1);
        assert_eq!(carol_balances[0].member_id, alice);
        assert!((carol_balances[0].amount - 30.0).abs() < 1e-9);
    }

    #[test]
    fn expense_amounts_must_match_the_split() {
        let (a, b) = (id(1), id(2));
        assert!(validate_expense_amounts(30.0, &[(a, 15.0), (b, 15.0)]).is_ok());
        // Within the 5 cent tolerance for uneven splits.
        assert!(validate_expense_amounts(10.0, &[(a, 3.33), (b, 6.66)]).is_ok());
        assert!(validate_expense_amounts(30.0, &[(a, 15.0), (b, 10.0)]).is_err());
        assert!(validate_expense_amounts(0.0, &[(a, 0.0)]).is_err());
        assert!(validate_expense_amounts(f64::NAN, &[(a, 1.0)]).is_err());
        assert!(validate_expense_amounts(10.0, &[]).is_err());
        assert!(validate_expense_amounts(10.0, &[(a, 15.0), (b, -5.0)]).is_err());
        assert!(validate_expense_amounts(10.0, &[(a, 5.0), (a, 5.0)]).is_err());
    }

    #[test]
    fn venmo_handles_are_validated_and_normalized() {
        assert_eq!(
            normalize_venmo_handle(" @Anna-Karenina_1 "),
            Ok("Anna-Karenina_1".to_string())
        );
        assert_eq!(normalize_venmo_handle(""), Ok(String::new()));
        assert_eq!(normalize_venmo_handle("  @ "), Ok(String::new()));
        assert!(normalize_venmo_handle("bob&amount=500").is_err());
        assert!(normalize_venmo_handle("abc").is_err());
        assert!(normalize_venmo_handle(&"a".repeat(31)).is_err());
        assert!(normalize_venmo_handle("anna karenina").is_err());
    }

    #[test]
    fn logins_lock_after_too_many_failures_then_recover() {
        let mut throttle = LoginThrottle::default();
        let t0 = 1_000_000;

        for _ in 0..LOGIN_MAX_FAILURES {
            assert!(throttle.check("Anna@Example.com", t0).is_ok());
            throttle.record_failure("anna@example.com", t0);
        }

        // Locked, whatever case the email is typed in.
        let wait = throttle.check(" ANNA@example.com", t0 + 60).unwrap_err();
        assert_eq!(wait, LOGIN_THROTTLE_WINDOW_SECONDS - 60);
        // Other accounts aren't affected.
        assert!(throttle.check("bob@example.com", t0 + 60).is_ok());
        // The window ends.
        assert!(
            throttle
                .check("anna@example.com", t0 + LOGIN_THROTTLE_WINDOW_SECONDS)
                .is_ok()
        );
    }

    #[test]
    fn a_successful_login_clears_failures() {
        let mut throttle = LoginThrottle::default();
        for _ in 0..(LOGIN_MAX_FAILURES - 1) {
            throttle.record_failure("anna@example.com", 0);
        }
        throttle.record_success("anna@example.com");
        throttle.record_failure("anna@example.com", 0);
        assert!(throttle.check("anna@example.com", 0).is_ok());
    }
}
