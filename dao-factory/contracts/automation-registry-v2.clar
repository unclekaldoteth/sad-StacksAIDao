;; automation-registry-v2.clar
;; Registry for automation jobs approved by governance.

(define-constant ERR-UNAUTHORIZED (err u12100))
(define-constant ERR-AUTOMATION-NOT-FOUND (err u12101))
(define-constant ERR-INVALID-NAME (err u12102))

(define-data-var automation-count uint u0)

(define-map automations
  uint
  {
    name: (string-ascii 64),
    target: principal,
    function-name: (string-ascii 64),
    enabled: bool,
    created-at: uint,
    created-by: principal
  }
)

(define-read-only (get-automation (automation-id uint))
  (map-get? automations automation-id)
)

(define-read-only (get-automation-count)
  (var-get automation-count)
)

(define-private (is-dao-or-extension)
  (contract-call? .dao-core-v2 is-dao-or-extension)
)

(define-private (check-principal (p principal))
  (ok (asserts! (is-eq p p) ERR-UNAUTHORIZED))
)

(define-private (check-ascii-64 (s (string-ascii 64)))
  (ok (asserts! (> (len s) u0) ERR-INVALID-NAME))
)

(define-private (check-uint (n uint))
  (ok (asserts! (>= n u0) ERR-UNAUTHORIZED))
)

(define-private (check-bool (b bool))
  (ok (asserts! (or (is-eq b true) (is-eq b false)) ERR-UNAUTHORIZED))
)

(define-public (create-automation (name (string-ascii 64)) (target principal) (function-name (string-ascii 64)))
  (let ((new-id (+ (var-get automation-count) u1)))
    (try! (is-dao-or-extension))
    (try! (check-ascii-64 name))
    (try! (check-principal target))
    (try! (check-ascii-64 function-name))
    (map-set automations new-id {
      name: name,
      target: target,
      function-name: function-name,
      enabled: true,
      created-at: stacks-block-height,
      created-by: tx-sender
    })
    (var-set automation-count new-id)
    (print {event: "automation-created", automation-id: new-id, name: name, target: target, function-name: function-name})
    (ok new-id)
  )
)

(define-public (set-automation-enabled (automation-id uint) (enabled bool))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint automation-id))
    (try! (check-bool enabled))
    (match (map-get? automations automation-id)
      automation (begin
        (map-set automations automation-id (merge automation {enabled: enabled}))
        (print {event: "automation-updated", automation-id: automation-id, enabled: enabled})
        (ok true)
      )
      ERR-AUTOMATION-NOT-FOUND
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
