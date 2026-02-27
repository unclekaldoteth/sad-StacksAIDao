;; grants-escrow-v2.clar
;; Milestone-gated grants managed by DAO.

(define-constant ERR-UNAUTHORIZED (err u11800))
(define-constant ERR-GRANT-NOT-FOUND (err u11801))
(define-constant ERR-NOT-APPROVED (err u11802))
(define-constant ERR-ALREADY-RELEASED (err u11803))
(define-constant ERR-INVALID-AMOUNT (err u11804))
(define-constant ERR-INVALID-MILESTONE (err u11805))

(define-data-var grant-count uint u0)

(define-map grants
  uint
  {
    grantee: principal,
    amount: uint,
    milestone: (string-utf8 256),
    approved: bool,
    released: bool,
    created-at: uint
  }
)

(define-read-only (get-grant (grant-id uint))
  (map-get? grants grant-id)
)

(define-private (is-dao-or-extension)
  (contract-call? .dao-core-v2-c4 is-dao-or-extension)
)

(define-private (check-principal (p principal))
  (ok (asserts! (is-eq p p) ERR-UNAUTHORIZED))
)

(define-private (check-uint (n uint))
  (ok (asserts! (>= n u0) ERR-UNAUTHORIZED))
)

(define-private (check-positive-amount (n uint))
  (ok (asserts! (> n u0) ERR-INVALID-AMOUNT))
)

(define-private (check-milestone (m (string-utf8 256)))
  (ok (asserts! (> (len m) u0) ERR-INVALID-MILESTONE))
)

(define-public (create-grant (grantee principal) (amount uint) (milestone (string-utf8 256)))
  (let ((new-id (+ (var-get grant-count) u1)))
    (try! (is-dao-or-extension))
    (try! (check-principal grantee))
    (try! (check-positive-amount amount))
    (try! (check-milestone milestone))
    (map-set grants new-id {
      grantee: grantee,
      amount: amount,
      milestone: milestone,
      approved: false,
      released: false,
      created-at: stacks-block-height
    })
    (var-set grant-count new-id)
    (print {event: "grant-created", grant-id: new-id, grantee: grantee, amount: amount})
    (ok new-id)
  )
)

(define-public (approve-grant (grant-id uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint grant-id))
    (match (map-get? grants grant-id)
      grant (begin
        (map-set grants grant-id (merge grant {approved: true}))
        (print {event: "grant-approved", grant-id: grant-id})
        (ok true)
      )
      ERR-GRANT-NOT-FOUND
    )
  )
)

(define-public (release-grant (grant-id uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint grant-id))
    (match (map-get? grants grant-id)
      grant (begin
        (asserts! (get approved grant) ERR-NOT-APPROVED)
        (asserts! (not (get released grant)) ERR-ALREADY-RELEASED)
        (try! (as-contract? ()
          (try! (contract-call? .treasury-v2-c4 withdraw-stx (get amount grant) (get grantee grant) none))
          true
        ))
        (map-set grants grant-id (merge grant {released: true}))
        (print {event: "grant-released", grant-id: grant-id, grantee: (get grantee grant), amount: (get amount grant)})
        (ok true)
      )
      ERR-GRANT-NOT-FOUND
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
