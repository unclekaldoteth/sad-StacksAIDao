;; emergency-guardian-v2.clar
;; Circuit breaker for protocol emergency response.

(define-constant ERR-UNAUTHORIZED (err u11300))

(define-data-var guardian principal tx-sender)
(define-data-var global-paused bool false)

(define-map contract-paused principal bool)

(define-read-only (get-guardian)
  (var-get guardian)
)

(define-read-only (is-globally-paused)
  (var-get global-paused)
)

(define-read-only (is-contract-paused (contract principal))
  (default-to false (map-get? contract-paused contract))
)

(define-private (is-guardian-or-dao)
  (if (is-eq tx-sender (var-get guardian))
    (ok true)
    (contract-call? .dao-core-v2-c4 is-dao-or-extension)
  )
)

(define-private (check-principal (p principal))
  (ok (asserts! (is-eq p p) ERR-UNAUTHORIZED))
)

(define-private (check-bool (b bool))
  (ok (asserts! (or (is-eq b true) (is-eq b false)) ERR-UNAUTHORIZED))
)

(define-public (set-guardian (new-guardian principal))
  (begin
    (try! (is-guardian-or-dao))
    (try! (check-principal new-guardian))
    (var-set guardian new-guardian)
    (print {event: "guardian-updated", guardian: new-guardian})
    (ok true)
  )
)

(define-public (set-global-paused (paused bool))
  (begin
    (try! (is-guardian-or-dao))
    (try! (check-bool paused))
    (var-set global-paused paused)
    (print {event: "global-paused-updated", paused: paused})
    (ok true)
  )
)

(define-public (set-contract-paused (contract principal) (paused bool))
  (begin
    (try! (is-guardian-or-dao))
    (try! (check-principal contract))
    (try! (check-bool paused))
    (map-set contract-paused contract paused)
    (print {event: "contract-paused-updated", contract: contract, paused: paused})
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
