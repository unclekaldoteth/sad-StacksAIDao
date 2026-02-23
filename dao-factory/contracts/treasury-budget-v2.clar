;; treasury-budget-v2.clar
;; Budget caps per period for treasury spending.

(define-constant ERR-UNAUTHORIZED (err u12600))
(define-constant ERR-BUDGET-NOT-FOUND (err u12601))
(define-constant ERR-BUDGET-EXCEEDED (err u12602))
(define-constant ERR-INVALID-BLOCK-SPAN (err u12603))

(define-data-var blocks-per-period uint u1008)

(define-map budgets
  uint
  {
    limit: uint,
    spent: uint,
    updated-at: uint
  }
)

(define-read-only (get-budget (period uint))
  (map-get? budgets period)
)

(define-read-only (get-period-index)
  (/ stacks-block-height (var-get blocks-per-period))
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

(define-public (set-blocks-per-period (new-blocks uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-positive new-blocks))
    (var-set blocks-per-period new-blocks)
    (print {event: "budget-period-updated", blocks-per-period: new-blocks})
    (ok true)
  )
)

(define-public (set-budget (period uint) (limit uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint period))
    (try! (check-uint limit))
    (map-set budgets period {
      limit: limit,
      spent: u0,
      updated-at: stacks-block-height
    })
    (print {event: "budget-set", period: period, limit: limit})
    (ok true)
  )
)

(define-public (record-budget-spend (period uint) (amount uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint period))
    (try! (check-uint amount))
    (match (map-get? budgets period)
      budget (begin
        (asserts! (<= (+ (get spent budget) amount) (get limit budget)) ERR-BUDGET-EXCEEDED)
        (map-set budgets period (merge budget {spent: (+ (get spent budget) amount), updated-at: stacks-block-height}))
        (print {event: "budget-spend-recorded", period: period, amount: amount})
        (ok true)
      )
      ERR-BUDGET-NOT-FOUND
    )
  )
)

(define-public (record-current-period-spend (amount uint))
  (record-budget-spend (get-period-index) amount)
)

(define-public (callback (sender principal) (memo (buff 34)))
  (begin
    sender
    memo
    (ok true)
  )
)
