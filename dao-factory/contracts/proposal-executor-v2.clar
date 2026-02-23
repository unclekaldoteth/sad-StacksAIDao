;; proposal-executor-v2.clar
;; Queue and execute passed proposal contracts through dao-core.

(use-trait proposal-trait .dao-traits-v2.proposal-trait)

(define-constant ERR-UNAUTHORIZED (err u11000))
(define-constant ERR-NOT-PASSED (err u11002))
(define-constant ERR-ALREADY-QUEUED (err u11003))
(define-constant ERR-QUEUE-NOT-FOUND (err u11004))
(define-constant ERR-TOO-EARLY (err u11005))
(define-constant ERR-ALREADY-EXECUTED (err u11006))
(define-constant ERR-PROPOSAL-MISMATCH (err u11007))
(define-constant ERR-NOT-EXECUTABLE (err u11008))

(define-data-var min-delay uint u10)

(define-map execution-queue
  uint
  {
    proposal: principal,
    ready-at: uint,
    queued-at: uint,
    queued-by: principal,
    executed: bool,
    canceled: bool
  }
)

(define-read-only (get-min-delay)
  (var-get min-delay)
)

(define-read-only (get-queued (proposal-id uint))
  (map-get? execution-queue proposal-id)
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

(define-private (check-delay (delay uint))
  (ok (asserts! (>= delay u10) ERR-TOO-EARLY))
)

(define-private (is-proposal-passed (proposal-id uint))
  (begin
    (unwrap-panic (check-uint proposal-id))
    (match (contract-call? .proposal-submission-v2 get-proposal-status proposal-id)
      status (is-eq status u3)
      false
    )
  )
)

(define-private (is-contract-executable (proposal-id uint) (proposal principal))
  (begin
    (unwrap-panic (check-uint proposal-id))
    (unwrap-panic (check-principal proposal))
    (match (contract-call? .proposal-submission-v2 get-proposal proposal-id)
      proposal-data
        (match (get proposal-contract proposal-data)
          expected (is-eq expected proposal)
          false
        )
      false
    )
  )
)

(define-public (set-min-delay (delay uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-delay delay))
    (var-set min-delay delay)
    (print {event: "executor-delay-updated", min-delay: delay})
    (ok true)
  )
)

(define-public (queue-proposal (proposal-id uint) (proposal <proposal-trait>) (ready-at uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint proposal-id))
    (try! (check-uint ready-at))
    (asserts! (is-proposal-passed proposal-id) ERR-NOT-PASSED)
    (asserts! (is-contract-executable proposal-id (contract-of proposal)) ERR-NOT-EXECUTABLE)
    (asserts! (is-none (map-get? execution-queue proposal-id)) ERR-ALREADY-QUEUED)
    (asserts! (>= ready-at (+ stacks-block-height (var-get min-delay))) ERR-TOO-EARLY)
    (map-set execution-queue proposal-id {
      proposal: (contract-of proposal),
      ready-at: ready-at,
      queued-at: stacks-block-height,
      queued-by: tx-sender,
      executed: false,
      canceled: false
    })
    (print {event: "proposal-queued", proposal-id: proposal-id, proposal: (contract-of proposal), ready-at: ready-at})
    (ok true)
  )
)

(define-public (cancel-queued (proposal-id uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint proposal-id))
    (match (map-get? execution-queue proposal-id)
      queued (begin
        (asserts! (not (get executed queued)) ERR-ALREADY-EXECUTED)
        (map-set execution-queue proposal-id (merge queued {canceled: true}))
        (print {event: "proposal-queue-canceled", proposal-id: proposal-id})
        (ok true)
      )
      ERR-QUEUE-NOT-FOUND
    )
  )
)

(define-public (execute-queued (proposal-id uint) (proposal <proposal-trait>) (sender principal))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint proposal-id))
    (try! (check-principal sender))
    (asserts! (is-proposal-passed proposal-id) ERR-NOT-PASSED)
    (match (map-get? execution-queue proposal-id)
      queued (begin
        (asserts! (is-eq (get proposal queued) (contract-of proposal)) ERR-PROPOSAL-MISMATCH)
        (asserts! (not (get canceled queued)) ERR-QUEUE-NOT-FOUND)
        (asserts! (not (get executed queued)) ERR-ALREADY-EXECUTED)
        (asserts! (>= stacks-block-height (get ready-at queued)) ERR-TOO-EARLY)
        (try! (as-contract (contract-call? .dao-core-v2 execute proposal sender)))
        (map-set execution-queue proposal-id (merge queued {executed: true}))
        (print {event: "proposal-executed", proposal-id: proposal-id, sender: sender})
        (ok true)
      )
      ERR-QUEUE-NOT-FOUND
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
