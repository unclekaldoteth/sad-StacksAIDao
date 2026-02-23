;; treasury-streaming-v2.clar
;; Block-based linear treasury streams.

(define-constant ERR-UNAUTHORIZED (err u11700))
(define-constant ERR-STREAM-NOT-FOUND (err u11701))
(define-constant ERR-INVALID-SCHEDULE (err u11702))
(define-constant ERR-NOTHING-TO-CLAIM (err u11703))
(define-constant ERR-NOT-RECIPIENT (err u11704))
(define-constant ERR-STREAM-CANCELED (err u11705))
(define-constant ERR-ALREADY-CANCELED (err u11706))
(define-constant ERR-INVALID-AMOUNT (err u11707))

(define-data-var stream-count uint u0)

(define-map streams
  uint
  {
    recipient: principal,
    total: uint,
    claimed: uint,
    start-block: uint,
    end-block: uint,
    canceled: bool
  }
)

(define-read-only (get-stream (stream-id uint))
  (map-get? streams stream-id)
)

(define-private (vested-amount (stream {recipient: principal, total: uint, claimed: uint, start-block: uint, end-block: uint, canceled: bool}) (current-block uint))
  (if (<= current-block (get start-block stream))
    u0
    (if (>= current-block (get end-block stream))
      (get total stream)
      (/ (* (get total stream) (- current-block (get start-block stream))) (- (get end-block stream) (get start-block stream)))
    )
  )
)

(define-read-only (get-claimable (stream-id uint) (current-block uint))
  (match (map-get? streams stream-id)
    stream (if (get canceled stream)
      u0
      (let ((vested (vested-amount stream current-block)))
        (if (>= vested (get claimed stream))
          (- vested (get claimed stream))
          u0
        )
      )
    )
    u0
  )
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

(define-private (check-positive (n uint))
  (ok (asserts! (> n u0) ERR-INVALID-AMOUNT))
)

(define-public (create-stream (recipient principal) (total uint) (start-block uint) (end-block uint))
  (let ((new-id (+ (var-get stream-count) u1)))
    (try! (is-dao-or-extension))
    (try! (check-principal recipient))
    (try! (check-positive total))
    (try! (check-uint start-block))
    (try! (check-uint end-block))
    (asserts! (and (> end-block start-block) (>= start-block stacks-block-height)) ERR-INVALID-SCHEDULE)
    (map-set streams new-id {
      recipient: recipient,
      total: total,
      claimed: u0,
      start-block: start-block,
      end-block: end-block,
      canceled: false
    })
    (var-set stream-count new-id)
    (print {event: "stream-created", stream-id: new-id, recipient: recipient, total: total})
    (ok new-id)
  )
)

(define-public (claim (stream-id uint))
  (begin
    (try! (check-uint stream-id))
    (match (map-get? streams stream-id)
      stream (let ((claimable (get-claimable stream-id stacks-block-height)))
        (asserts! (is-eq tx-sender (get recipient stream)) ERR-NOT-RECIPIENT)
        (asserts! (not (get canceled stream)) ERR-STREAM-CANCELED)
        (asserts! (> claimable u0) ERR-NOTHING-TO-CLAIM)
        (try! (as-contract (contract-call? .treasury-v2 withdraw-stx claimable tx-sender none)))
        (map-set streams stream-id (merge stream {claimed: (+ (get claimed stream) claimable)}))
        (print {event: "stream-claimed", stream-id: stream-id, recipient: tx-sender, amount: claimable})
        (ok claimable)
      )
      ERR-STREAM-NOT-FOUND
    )
  )
)

(define-public (cancel-stream (stream-id uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint stream-id))
    (match (map-get? streams stream-id)
      stream (begin
        (asserts! (not (get canceled stream)) ERR-ALREADY-CANCELED)
        (map-set streams stream-id (merge stream {canceled: true}))
        (print {event: "stream-canceled", stream-id: stream-id})
        (ok true)
      )
      ERR-STREAM-NOT-FOUND
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
