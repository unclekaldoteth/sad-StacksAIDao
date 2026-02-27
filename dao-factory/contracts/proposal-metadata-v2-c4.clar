;; proposal-metadata-v2.clar
;; Optional metadata pointers for proposal IDs.

(define-constant ERR-UNAUTHORIZED (err u12300))
(define-constant ERR-PROPOSAL-NOT-FOUND (err u12301))
(define-constant ERR-INVALID-CID (err u12302))

(define-map proposal-metadata
  uint
  {
    cid: (string-ascii 80),
    checksum: (optional (buff 32)),
    updated-at: uint,
    updated-by: principal
  }
)

(define-read-only (get-metadata (proposal-id uint))
  (map-get? proposal-metadata proposal-id)
)

(define-private (is-dao-or-extension)
  (contract-call? .dao-core-v2-c4 is-dao-or-extension)
)

(define-private (check-uint (n uint))
  (ok (asserts! (>= n u0) ERR-UNAUTHORIZED))
)

(define-private (check-cid (cid (string-ascii 80)))
  (ok (asserts! (> (len cid) u0) ERR-INVALID-CID))
)

(define-private (check-checksum (checksum (optional (buff 32))))
  (ok (asserts! (is-eq checksum checksum) ERR-UNAUTHORIZED))
)

(define-private (proposal-exists (proposal-id uint))
  (begin
    (unwrap-panic (check-uint proposal-id))
    (is-some (contract-call? .proposal-submission-v2-c4 get-proposal proposal-id))
  )
)

(define-private (is-proposer (proposal-id uint) (who principal))
  (begin
    (unwrap-panic (check-uint proposal-id))
    (match (contract-call? .proposal-submission-v2-c4 get-proposal proposal-id)
      proposal (is-eq (get proposer proposal) who)
      false
    )
  )
)

(define-private (is-authorized-writer (proposal-id uint))
  (begin
    (unwrap-panic (check-uint proposal-id))
    (or
      (is-proposer proposal-id tx-sender)
      (is-ok (is-dao-or-extension))
    )
  )
)

(define-public (set-metadata (proposal-id uint) (cid (string-ascii 80)) (checksum (optional (buff 32))))
  (begin
    (try! (check-uint proposal-id))
    (try! (check-cid cid))
    (try! (check-checksum checksum))
    (asserts! (proposal-exists proposal-id) ERR-PROPOSAL-NOT-FOUND)
    (asserts! (is-authorized-writer proposal-id) ERR-UNAUTHORIZED)
    (map-set proposal-metadata proposal-id {
      cid: cid,
      checksum: checksum,
      updated-at: stacks-block-height,
      updated-by: tx-sender
    })
    (print {event: "proposal-metadata-updated", proposal-id: proposal-id, cid: cid})
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
