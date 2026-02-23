;; governance-params-v2.clar
;; DAO-governed parameter registry.

(define-constant ERR-UNAUTHORIZED (err u11400))
(define-constant ERR-PARAM-NOT-FOUND (err u11401))
(define-constant ERR-INVALID-KEY (err u11402))

(define-data-var param-count uint u0)

(define-map params (string-ascii 32) uint)

(define-read-only (get-param (key (string-ascii 32)))
  (map-get? params key)
)

(define-read-only (get-param-count)
  (var-get param-count)
)

(define-private (is-dao-or-extension)
  (contract-call? .dao-core-v2 is-dao-or-extension)
)

(define-private (check-key (key (string-ascii 32)))
  (ok (asserts! (> (len key) u0) ERR-INVALID-KEY))
)

(define-private (check-uint (n uint))
  (ok (asserts! (>= n u0) ERR-UNAUTHORIZED))
)

(define-public (set-param (key (string-ascii 32)) (value uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-key key))
    (try! (check-uint value))
    (if (is-none (map-get? params key))
      (var-set param-count (+ (var-get param-count) u1))
      true
    )
    (map-set params key value)
    (print {event: "param-updated", key: key, value: value})
    (ok true)
  )
)

(define-public (delete-param (key (string-ascii 32)))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-key key))
    (asserts! (is-some (map-get? params key)) ERR-PARAM-NOT-FOUND)
    (map-delete params key)
    (var-set param-count (- (var-get param-count) u1))
    (print {event: "param-deleted", key: key})
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
