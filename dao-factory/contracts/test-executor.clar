;; test-executor.clar
;; Test helper to call dao-core.execute as-contract

(use-trait proposal-trait .dao-traits.proposal-trait)

(define-public (execute-proposal (proposal <proposal-trait>) (sender principal))
  (as-contract (contract-call? .dao-core execute proposal sender))
)
