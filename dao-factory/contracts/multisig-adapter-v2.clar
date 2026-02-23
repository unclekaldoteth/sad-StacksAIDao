;; multisig-adapter-v2.clar
;; Lightweight signer approvals for action IDs.

(define-constant ERR-UNAUTHORIZED (err u12000))
(define-constant ERR-NOT-SIGNER (err u12001))
(define-constant ERR-ALREADY-APPROVED (err u12002))
(define-constant ERR-INVALID-THRESHOLD (err u12003))
(define-constant ERR-BELOW-THRESHOLD (err u12004))

(define-data-var signer-count uint u0)
(define-data-var threshold uint u1)

(define-map signers principal bool)
(define-map approvals {action-id: uint, signer: principal} bool)
(define-map approval-count uint uint)

(define-read-only (is-signer (signer principal))
  (default-to false (map-get? signers signer))
)

(define-read-only (get-threshold)
  (var-get threshold)
)

(define-read-only (get-signer-count)
  (var-get signer-count)
)

(define-read-only (get-approval-count (action-id uint))
  (default-to u0 (map-get? approval-count action-id))
)

(define-read-only (is-action-approved (action-id uint))
  (>= (get-approval-count action-id) (var-get threshold))
)

(define-private (is-dao-or-extension)
  (contract-call? .dao-core-v2 is-dao-or-extension)
)

(define-private (check-principal (p principal))
  (ok (asserts! (is-eq p p) ERR-UNAUTHORIZED))
)

(define-private (check-bool (b bool))
  (ok (asserts! (or (is-eq b true) (is-eq b false)) ERR-UNAUTHORIZED))
)

(define-private (check-uint (n uint))
  (ok (asserts! (>= n u0) ERR-UNAUTHORIZED))
)

(define-public (set-signer (signer principal) (enabled bool))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-principal signer))
    (try! (check-bool enabled))
    (let
      (
        (already (is-signer signer))
        (current (var-get signer-count))
        (next-count
          (if (and enabled (not already))
            (+ current u1)
            (if (and (not enabled) already)
              (- current u1)
              current
            )
          )
        )
      )
      (asserts! (or (is-eq next-count u0) (>= next-count (var-get threshold))) ERR-BELOW-THRESHOLD)
      (var-set signer-count next-count)
      (map-set signers signer enabled)
      (print {event: "signer-updated", signer: signer, enabled: enabled, signer-count: next-count})
      (ok true)
    )
  )
)

(define-public (set-threshold (new-threshold uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint new-threshold))
    (asserts! (and (> new-threshold u0) (<= new-threshold (var-get signer-count))) ERR-INVALID-THRESHOLD)
    (var-set threshold new-threshold)
    (print {event: "threshold-updated", threshold: new-threshold})
    (ok true)
  )
)

(define-public (approve-action (action-id uint))
  (begin
    (try! (check-uint action-id))
    (asserts! (is-signer tx-sender) ERR-NOT-SIGNER)
    (asserts! (is-none (map-get? approvals {action-id: action-id, signer: tx-sender})) ERR-ALREADY-APPROVED)
    (map-set approvals {action-id: action-id, signer: tx-sender} true)
    (map-set approval-count action-id (+ (get-approval-count action-id) u1))
    (print {event: "action-approved", action-id: action-id, signer: tx-sender, approvals: (get-approval-count action-id)})
    (ok (is-action-approved action-id))
  )
)

(define-public (callback (sender principal) (memo (buff 34)))
  (begin
    sender
    memo
    (ok true)
  )
)
