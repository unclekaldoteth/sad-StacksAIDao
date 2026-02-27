;; proposal-tags-v2.clar
;; Governance tags for proposal categorization.

(define-constant ERR-UNAUTHORIZED (err u12400))
(define-constant ERR-PROPOSAL-NOT-FOUND (err u12401))

(define-map proposal-tags uint (list 20 (string-ascii 32)))

(define-read-only (get-tags (proposal-id uint))
  (default-to (list) (map-get? proposal-tags proposal-id))
)

(define-private (is-dao-or-extension)
  (contract-call? .dao-core-v2-c4 is-dao-or-extension)
)

(define-private (check-uint (n uint))
  (ok (asserts! (>= n u0) ERR-UNAUTHORIZED))
)

(define-private (check-tags (tags (list 20 (string-ascii 32))))
  (ok (asserts! (is-eq tags tags) ERR-UNAUTHORIZED))
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

(define-public (set-tags (proposal-id uint) (tags (list 20 (string-ascii 32))))
  (begin
    (try! (check-uint proposal-id))
    (try! (check-tags tags))
    (asserts! (proposal-exists proposal-id) ERR-PROPOSAL-NOT-FOUND)
    (asserts! (is-authorized-writer proposal-id) ERR-UNAUTHORIZED)
    (map-set proposal-tags proposal-id tags)
    (print {event: "proposal-tags-updated", proposal-id: proposal-id})
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
