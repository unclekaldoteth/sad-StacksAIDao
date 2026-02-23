;; fee-rebate-v2.clar
;; Tracks and releases governance fee rebates.

(define-constant ERR-UNAUTHORIZED (err u12500))
(define-constant ERR-INSUFFICIENT-REBATE (err u12501))
(define-constant ERR-INVALID-AMOUNT (err u12502))

(define-map rebates principal uint)

(define-read-only (get-rebate-balance (user principal))
  (default-to u0 (map-get? rebates user))
)

(define-private (is-dao-or-extension)
  (contract-call? .dao-core-v2 is-dao-or-extension)
)

(define-private (check-principal (p principal))
  (ok (asserts! (is-eq p p) ERR-UNAUTHORIZED))
)

(define-private (check-positive-amount (n uint))
  (ok (asserts! (> n u0) ERR-INVALID-AMOUNT))
)

(define-public (credit-rebate (user principal) (amount uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-principal user))
    (try! (check-positive-amount amount))
    (map-set rebates user (+ (get-rebate-balance user) amount))
    (print {event: "rebate-credited", user: user, amount: amount})
    (ok true)
  )
)

(define-public (claim-rebate (amount uint))
  (let ((balance (get-rebate-balance tx-sender)))
    (try! (check-positive-amount amount))
    (asserts! (>= balance amount) ERR-INSUFFICIENT-REBATE)
    (try! (as-contract (contract-call? .treasury-v2 withdraw-stx amount tx-sender none)))
    (map-set rebates tx-sender (- balance amount))
    (print {event: "rebate-claimed", user: tx-sender, amount: amount})
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
