# 31-Contract Deployment Draft (v2)

This draft expands the v2 stack from 13 to 31 contracts.

## Contract Count

- Existing v2 contracts: 13
- New draft contracts: 18
- Total: 31

## Full Contract Set

1. dao-traits-v2
2. dao-core-v2
3. dao-factory-v2
4. extensions-registry-v2
5. governance-token-v2
6. membership-v2
7. proposal-submission-v2
8. proposal-voting-v2
9. treasury-v2
10. treasury-actions-v2
11. template-registry-v2
12. mock-proposal-v2
13. test-executor-v2
14. proposal-executor-v2
15. timelock-controller-v2
16. proposal-canceler-v2
17. emergency-guardian-v2
18. governance-params-v2
19. voting-strategy-module-v2
20. quorum-curve-v2
21. proposal-metadata-v2
22. proposal-tags-v2
23. treasury-guardrails-v2
24. treasury-streaming-v2
25. grants-escrow-v2
26. vesting-manager-v2
27. fee-rebate-v2
28. treasury-budget-v2
29. multisig-adapter-v2
30. automation-registry-v2
31. address-book-v2

## Generated Deployment Plans

- Simnet: `/Users/fabiomaulana/sad-StacksAIDAO/dao-factory/deployments/default.simnet-plan.yaml`
- Testnet: `/Users/fabiomaulana/sad-StacksAIDAO/dao-factory/deployments/default.testnet-plan.yaml`
- Mainnet: `/Users/fabiomaulana/sad-StacksAIDAO/dao-factory/deployments/default.mainnet-plan.yaml`

## Validation Done

- `clarinet check -m Clarinet.v2.toml -d`
- Plan contract counts confirmed at 31 for simnet/testnet/mainnet.

## Deploy Commands

```bash
cd /Users/fabiomaulana/sad-StacksAIDAO/dao-factory
clarinet check -m Clarinet.v2.toml -d
clarinet deployments apply --testnet -d --no-dashboard -m Clarinet.v2.toml
clarinet deployments apply --mainnet -d --no-dashboard -m Clarinet.v2.toml
```

## Notes

- New contracts are deployment-ready drafts and intentionally minimal.
- Clarinet `check_checker` warnings exist for unchecked inputs in draft modules; no hard errors remain.
- Treat this as a governance expansion baseline and harden each module before production treasury usage.
