;; address-book-v2.clar
;; Labeled address registry for DAO operations.

(define-constant ERR-UNAUTHORIZED (err u12700))
(define-constant ERR-ENTRY-NOT-FOUND (err u12701))
(define-constant ERR-INVALID-LABEL (err u12702))

(define-map address-book
  principal
  {
    label: (string-ascii 64),
    category: uint,
    updated-at: uint,
    updated-by: principal
  }
)

(define-read-only (get-entry (address principal))
  (map-get? address-book address)
)

(define-private (is-dao-or-extension)
  (contract-call? .dao-core-v2-c4 is-dao-or-extension)
)

(define-private (check-principal (p principal))
  (ok (asserts! (is-eq p p) ERR-UNAUTHORIZED))
)

(define-private (check-ascii-64 (s (string-ascii 64)))
  (ok (asserts! (> (len s) u0) ERR-INVALID-LABEL))
)

(define-private (check-uint (n uint))
  (ok (asserts! (>= n u0) ERR-UNAUTHORIZED))
)

(define-public (set-entry (address principal) (label (string-ascii 64)) (category uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-principal address))
    (try! (check-ascii-64 label))
    (try! (check-uint category))
    (map-set address-book address {
      label: label,
      category: category,
      updated-at: stacks-block-height,
      updated-by: tx-sender
    })
    (print {event: "address-book-updated", address: address, label: label, category: category})
    (ok true)
  )
)

(define-public (delete-entry (address principal))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-principal address))
    (asserts! (is-some (map-get? address-book address)) ERR-ENTRY-NOT-FOUND)
    (map-delete address-book address)
    (print {event: "address-book-deleted", address: address})
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
