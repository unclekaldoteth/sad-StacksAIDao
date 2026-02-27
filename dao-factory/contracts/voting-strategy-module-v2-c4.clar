;; voting-strategy-module-v2.clar
;; Configurable voting strategy module.

(define-constant ERR-UNAUTHORIZED (err u11500))
(define-constant ERR-INVALID-STRATEGY (err u11501))
(define-constant ERR-INVALID-THRESHOLD (err u11502))

(define-constant STRATEGY-LINEAR u1)
(define-constant STRATEGY-QUADRATIC-MOCK u2)
(define-constant STRATEGY-CONVICTION-MOCK u3)

(define-data-var active-strategy uint STRATEGY-LINEAR)
(define-data-var quorum-bps uint u1000)
(define-data-var approval-bps uint u5100)

(define-read-only (get-strategy)
  {
    active-strategy: (var-get active-strategy),
    quorum-bps: (var-get quorum-bps),
    approval-bps: (var-get approval-bps)
  }
)

(define-read-only (evaluate (proposal-id uint))
  {
    strategy: (var-get active-strategy),
    quorum-reached: (contract-call? .proposal-voting-v2-c4 is-quorum-reached proposal-id),
    approval-bps: (contract-call? .proposal-voting-v2-c4 get-approval-percentage proposal-id),
    threshold-bps: (var-get approval-bps)
  }
)

(define-private (is-dao-or-extension)
  (contract-call? .dao-core-v2-c4 is-dao-or-extension)
)

(define-private (check-uint (n uint))
  (ok (asserts! (>= n u0) ERR-UNAUTHORIZED))
)

(define-public (set-strategy (strategy uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint strategy))
    (asserts!
      (or
        (is-eq strategy STRATEGY-LINEAR)
        (is-eq strategy STRATEGY-QUADRATIC-MOCK)
        (is-eq strategy STRATEGY-CONVICTION-MOCK)
      )
      ERR-INVALID-STRATEGY
    )
    (var-set active-strategy strategy)
    (print {event: "strategy-updated", strategy: strategy})
    (ok true)
  )
)

(define-public (set-thresholds (new-quorum-bps uint) (new-approval-bps uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint new-quorum-bps))
    (try! (check-uint new-approval-bps))
    (asserts! (and (> new-quorum-bps u0) (<= new-quorum-bps u10000) (> new-approval-bps u0) (<= new-approval-bps u10000)) ERR-INVALID-THRESHOLD)
    (var-set quorum-bps new-quorum-bps)
    (var-set approval-bps new-approval-bps)
    (print {event: "thresholds-updated", quorum-bps: new-quorum-bps, approval-bps: new-approval-bps})
    (ok true)
  )
)

(define-public (callback (sender principal) (memo (buff 34)))
  (begin
    sender
    memo
    (ok true)
  )
)
