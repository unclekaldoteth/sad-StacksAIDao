# 31-Contract Deployment Status (v2-c4)

Status updated on February 27, 2026.

## Summary

- Network: `mainnet`
- Deployer: `SP1MTYHV6K2FNH3QNF4P5QXS9VJ3XZ0GBB5T1SJPK`
- Target stack: `v2-c4` (31 contracts)
- Result: all 31 contracts in the `v2-c4` set are deployed on mainnet

## Clarity Version Notes

- `dao-core-v2-c4` is deployed as Clarity 3 (historical first successful publish under that name).
- Additional Clarity 4 core variant is deployed as:
  - `dao-core-v2-c4-v4`

## Mainnet Plans Used

- Base v2-c4 plan: `/Users/fabiomaulana/sad-StacksAIDAO/dao-factory/deployments/default.mainnet-v2-c4-plan.yaml`
- Remaining 26 as Clarity 4: `/Users/fabiomaulana/sad-StacksAIDAO/dao-factory/deployments/default.mainnet-v2-c4-remaining-plan.yaml`
- Final Clarity 4 core alias: `/Users/fabiomaulana/sad-StacksAIDAO/dao-factory/deployments/default.mainnet-dao-core-v2-c4-v4.yaml`

## Validation

```bash
cd /Users/fabiomaulana/sad-StacksAIDAO/dao-factory
clarinet check -m Clarinet.v2-c4.toml -d
```

## Mainnet Explorer

- https://explorer.hiro.so/address/SP1MTYHV6K2FNH3QNF4P5QXS9VJ3XZ0GBB5T1SJPK?chain=mainnet
