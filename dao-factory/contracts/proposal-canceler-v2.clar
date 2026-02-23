;; proposal-canceler-v2.clar
;; Emergency cancellation registry for proposals.

(define-constant ERR-UNAUTHORIZED (err u11200))
(define-constant ERR-ALREADY-CANCELED (err u11201))
(define-constant ERR-PROPOSAL-NOT-FOUND (err u11202))

(define-map canceled-proposals
  uint
  {
    reason: (string-utf8 256),
    canceled-at: uint,
    canceled-by: principal
  }
)

(define-read-only (is-canceled (proposal-id uint))
  (is-some (map-get? canceled-proposals proposal-id))
)

(define-read-only (get-cancel-record (proposal-id uint))
  (map-get? canceled-proposals proposal-id)
)

(define-private (is-dao-or-extension)
  (contract-call? .dao-core-v2 is-dao-or-extension)
)

(define-private (check-uint (n uint))
  (ok (asserts! (>= n u0) ERR-UNAUTHORIZED))
)

(define-private (check-reason (reason (string-utf8 256)))
  (ok (asserts! (> (len reason) u0) ERR-UNAUTHORIZED))
)

(define-public (cancel-proposal (proposal-id uint) (reason (string-utf8 256)))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint proposal-id))
    (try! (check-reason reason))
    (asserts! (is-some (contract-call? .proposal-submission-v2 get-proposal proposal-id)) ERR-PROPOSAL-NOT-FOUND)
    (asserts! (not (is-canceled proposal-id)) ERR-ALREADY-CANCELED)

    ;; Keep proposal state aligned with cancellation.
    (try! (as-contract (contract-call? .proposal-submission-v2 set-proposal-status proposal-id u4)))

    (map-set canceled-proposals proposal-id {
      reason: reason,
      canceled-at: stacks-block-height,
      canceled-by: tx-sender
    })
    (print {event: "proposal-canceled", proposal-id: proposal-id, canceled-by: tx-sender})
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
