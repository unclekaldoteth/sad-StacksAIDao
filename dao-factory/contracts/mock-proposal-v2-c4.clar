;; mock-proposal.clar
;; Test helper implementing proposal-trait

(define-data-var should-fail bool false)

(define-read-only (get-should-fail)
  (var-get should-fail)
)

(define-public (set-should-fail (fail bool))
  (begin
    (var-set should-fail fail)
    (ok true)
  )
)

(define-public (execute (sender principal))
  (begin
    sender
    (if (var-get should-fail)
      (err u1)
      (ok true)
    )
  )
)
