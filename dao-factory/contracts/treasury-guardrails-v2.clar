;; treasury-guardrails-v2.clar
;; Treasury spend policy checks.

(define-constant ERR-UNAUTHORIZED (err u11600))
(define-constant ERR-OVER-PCT-LIMIT (err u11601))
(define-constant ERR-OVER-PERIOD-LIMIT (err u11602))
(define-constant ERR-INVALID-BLOCK-SPAN (err u11603))

(define-data-var max-spend-bps uint u2000)
(define-data-var blocks-per-period uint u144)
(define-data-var period-limit uint u2000000000)

(define-map period-spent uint uint)

(define-read-only (get-policy)
  {
    max-spend-bps: (var-get max-spend-bps),
    blocks-per-period: (var-get blocks-per-period),
    period-limit: (var-get period-limit)
  }
)

(define-read-only (get-period-index)
  (/ stacks-block-height (var-get blocks-per-period))
)

(define-read-only (get-period-spent (period uint))
  (default-to u0 (map-get? period-spent period))
)

(define-read-only (get-current-treasury-balance)
  (contract-call? .treasury-v2 get-stx-balance)
)

(define-read-only (can-spend (amount uint))
  (let
    (
      (period (get-period-index))
      (spent (get-period-spent period))
      (treasury-balance (get-current-treasury-balance))
      (pct-ok (if (is-eq treasury-balance u0)
        false
        (<= (* amount u10000) (* treasury-balance (var-get max-spend-bps)))
      ))
      (period-ok (<= (+ spent amount) (var-get period-limit)))
    )
    (and pct-ok period-ok)
  )
)

(define-private (is-dao-or-extension)
  (contract-call? .dao-core-v2 is-dao-or-extension)
)

(define-private (check-uint (n uint))
  (ok (asserts! (>= n u0) ERR-UNAUTHORIZED))
)

(define-private (check-positive (n uint))
  (ok (asserts! (> n u0) ERR-INVALID-BLOCK-SPAN))
)

(define-public (set-policy (new-max-spend-bps uint) (new-blocks-per-period uint) (new-period-limit uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint new-max-spend-bps))
    (try! (check-positive new-blocks-per-period))
    (try! (check-uint new-period-limit))
    (asserts! (<= new-max-spend-bps u10000) ERR-OVER-PCT-LIMIT)
    (var-set max-spend-bps new-max-spend-bps)
    (var-set blocks-per-period new-blocks-per-period)
    (var-set period-limit new-period-limit)
    (print {event: "guardrails-updated", max-spend-bps: new-max-spend-bps, blocks-per-period: new-blocks-per-period, period-limit: new-period-limit})
    (ok true)
  )
)

(define-public (record-spend (amount uint))
  (let
    (
      (period (get-period-index))
      (spent (get-period-spent period))
      (treasury-balance (get-current-treasury-balance))
    )
    (try! (is-dao-or-extension))
    (try! (check-uint amount))
    (asserts! (if (is-eq treasury-balance u0)
      false
      (<= (* amount u10000) (* treasury-balance (var-get max-spend-bps)))
    ) ERR-OVER-PCT-LIMIT)
    (asserts! (<= (+ spent amount) (var-get period-limit)) ERR-OVER-PERIOD-LIMIT)
    (map-set period-spent period (+ spent amount))
    (print {event: "guardrails-spend-recorded", period: period, amount: amount})
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
