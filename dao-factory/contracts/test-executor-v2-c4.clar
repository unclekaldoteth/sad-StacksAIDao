;; test-executor.clar
;; Test helper to call dao-core.execute as-contract
;; Note: uses plain principal param (no use-trait) for Clarity 4 compatibility

(define-public (execute-proposal (proposal principal) (sender principal))
  (as-contract? ()
    (try! (contract-call? .dao-core-v2-c4 execute proposal sender))
    true
  )
)
