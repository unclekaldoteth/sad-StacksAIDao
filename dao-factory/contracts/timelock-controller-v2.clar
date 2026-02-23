;; timelock-controller-v2.clar
;; Generic timelock queue for governance actions.

(define-constant ERR-UNAUTHORIZED (err u11100))
(define-constant ERR-ACTION-EXISTS (err u11101))
(define-constant ERR-ACTION-NOT-FOUND (err u11102))
(define-constant ERR-TOO-EARLY (err u11103))
(define-constant ERR-ALREADY-EXECUTED (err u11104))
(define-constant ERR-DELAY-TOO-SHORT (err u11105))
(define-constant ERR-INVALID-NAME (err u11106))

(define-data-var min-delay uint u144)

(define-map queued-actions
  uint
  {
    target: principal,
    function-name: (string-ascii 64),
    eta: uint,
    queued-at: uint,
    queued-by: principal,
    executed: bool,
    canceled: bool
  }
)

(define-read-only (get-min-delay)
  (var-get min-delay)
)

(define-read-only (get-action (action-id uint))
  (map-get? queued-actions action-id)
)

(define-private (is-dao-or-extension)
  (contract-call? .dao-core-v2 is-dao-or-extension)
)

(define-private (check-principal (p principal))
  (ok (asserts! (is-eq p p) ERR-UNAUTHORIZED))
)

(define-private (check-uint (n uint))
  (ok (asserts! (>= n u0) ERR-UNAUTHORIZED))
)

(define-private (check-name (name (string-ascii 64)))
  (ok (asserts! (> (len name) u0) ERR-INVALID-NAME))
)

(define-public (set-min-delay (delay uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint delay))
    (asserts! (>= delay u10) ERR-DELAY-TOO-SHORT)
    (var-set min-delay delay)
    (print {event: "timelock-delay-updated", min-delay: delay})
    (ok true)
  )
)

(define-public (queue-action (action-id uint) (target principal) (function-name (string-ascii 64)) (eta uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint action-id))
    (try! (check-principal target))
    (try! (check-name function-name))
    (try! (check-uint eta))
    (asserts! (is-none (map-get? queued-actions action-id)) ERR-ACTION-EXISTS)
    (asserts! (>= eta (+ stacks-block-height (var-get min-delay))) ERR-DELAY-TOO-SHORT)
    (map-set queued-actions action-id {
      target: target,
      function-name: function-name,
      eta: eta,
      queued-at: stacks-block-height,
      queued-by: tx-sender,
      executed: false,
      canceled: false
    })
    (print {event: "timelock-queued", action-id: action-id, eta: eta, target: target, function-name: function-name})
    (ok true)
  )
)

(define-public (cancel-action (action-id uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint action-id))
    (match (map-get? queued-actions action-id)
      action (begin
        (asserts! (not (get executed action)) ERR-ALREADY-EXECUTED)
        (map-set queued-actions action-id (merge action {canceled: true}))
        (print {event: "timelock-canceled", action-id: action-id})
        (ok true)
      )
      ERR-ACTION-NOT-FOUND
    )
  )
)

(define-public (mark-executed (action-id uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint action-id))
    (match (map-get? queued-actions action-id)
      action (begin
        (asserts! (not (get canceled action)) ERR-ACTION-NOT-FOUND)
        (asserts! (not (get executed action)) ERR-ALREADY-EXECUTED)
        (asserts! (>= stacks-block-height (get eta action)) ERR-TOO-EARLY)
        (map-set queued-actions action-id (merge action {executed: true}))
        (print {event: "timelock-executed", action-id: action-id})
        (ok true)
      )
      ERR-ACTION-NOT-FOUND
    )
  )
)

(define-public (callback (sender principal) (memo (buff 34)))
  (begin
    sender
    memo
    (ok true)
  )
)
