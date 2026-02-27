;; quorum-curve-v2.clar
;; Stores quorum requirements by turnout bucket.

(define-constant ERR-UNAUTHORIZED (err u12200))
(define-constant ERR-INVALID-BPS (err u12201))
(define-constant ERR-BUCKET-NOT-FOUND (err u12202))

(define-map quorum-buckets uint uint)

(define-read-only (get-required-quorum-bps (turnout-bucket uint))
  (default-to u1000 (map-get? quorum-buckets turnout-bucket))
)

(define-private (is-dao-or-extension)
  (contract-call? .dao-core-v2-c4 is-dao-or-extension)
)

(define-private (check-uint (n uint))
  (ok (asserts! (>= n u0) ERR-UNAUTHORIZED))
)

(define-public (set-quorum-bucket (turnout-bucket uint) (required-quorum-bps uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint turnout-bucket))
    (try! (check-uint required-quorum-bps))
    (asserts! (<= required-quorum-bps u10000) ERR-INVALID-BPS)
    (map-set quorum-buckets turnout-bucket required-quorum-bps)
    (print {event: "quorum-bucket-updated", turnout-bucket: turnout-bucket, required-quorum-bps: required-quorum-bps})
    (ok true)
  )
)

(define-public (delete-quorum-bucket (turnout-bucket uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint turnout-bucket))
    (asserts! (is-some (map-get? quorum-buckets turnout-bucket)) ERR-BUCKET-NOT-FOUND)
    (map-delete quorum-buckets turnout-bucket)
    (print {event: "quorum-bucket-deleted", turnout-bucket: turnout-bucket})
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
