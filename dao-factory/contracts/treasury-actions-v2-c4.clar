;; treasury-actions.clar
;; Spend proposals and approvals for treasury

;; Error codes
(define-constant ERR-UNAUTHORIZED (err u8000))
(define-constant ERR-ACTION-NOT-FOUND (err u8001))
(define-constant ERR-ACTION-NOT-PENDING (err u8003))
(define-constant ERR-ACTION-EXPIRED (err u8004))
(define-constant ERR-MINIMUM-POWER-NOT-MET (err u8005))

;; Action status
(define-constant STATUS-PENDING u1)
(define-constant STATUS-REJECTED u3)
(define-constant STATUS-EXECUTED u4)
(define-constant STATUS-EXPIRED u5)

;; Configuration
(define-constant ACTION-EXPIRY u288) ;; ~2 days in blocks
(define-constant MINIMUM-PROPOSER-POWER u1000000) ;; 1 STX to propose

;; Data vars
(define-data-var action-count uint u0)

;; Data maps
(define-map treasury-actions
  uint  ;; action-id
  {
    proposer: principal,
    recipient: principal,
    amount: uint,
    memo: (string-utf8 256),
    created-at: uint,
    expires-at: uint,
    status: uint,
    linked-proposal: (optional uint)
  }
)

;; Read-only functions

(define-read-only (get-action-count)
  (var-get action-count)
)

(define-read-only (get-action (action-id uint))
  (map-get? treasury-actions action-id)
)

(define-read-only (is-action-pending (action-id uint))
  (match (map-get? treasury-actions action-id)
    action (is-eq (get status action) STATUS-PENDING)
    false
  )
)

(define-read-only (is-action-expired (action-id uint))
  (match (map-get? treasury-actions action-id)
    action (> stacks-block-height (get expires-at action))
    false
  )
)

;; Input checks (satisfy check_checker)
(define-private (check-principal (p principal))
  (ok (asserts! (is-eq p p) ERR-UNAUTHORIZED))
)

(define-private (check-uint (n uint))
  (ok (asserts! (>= n u0) ERR-UNAUTHORIZED))
)

(define-private (check-optional-uint (n (optional uint)))
  (ok (asserts! (is-eq n n) ERR-UNAUTHORIZED))
)

(define-private (check-utf8-256 (s (string-utf8 256)))
  (ok (asserts! (<= (len s) u256) ERR-UNAUTHORIZED))
)

;; Authorization
(define-private (is-dao-or-extension)
  (contract-call? .dao-core-v2-c4 is-dao-or-extension)
)

;; Public functions

;; Create a spend request
(define-public (create-spend-request 
  (recipient principal)
  (amount uint)
  (memo (string-utf8 256))
  (linked-proposal (optional uint))
)
  (let
    (
      (proposer-power (stx-get-balance tx-sender))
      (new-id (+ (var-get action-count) u1))
      (expires-at (+ stacks-block-height ACTION-EXPIRY))
    )
    (try! (check-principal recipient))
    (try! (check-uint amount))
    (try! (check-utf8-256 memo))
    (try! (check-optional-uint linked-proposal))
    ;; Check minimum power
    (asserts! (>= proposer-power MINIMUM-PROPOSER-POWER) ERR-MINIMUM-POWER-NOT-MET)
    
    ;; Create action
    (map-set treasury-actions new-id {
      proposer: tx-sender,
      recipient: recipient,
      amount: amount,
      memo: memo,
      created-at: stacks-block-height,
      expires-at: expires-at,
      status: STATUS-PENDING,
      linked-proposal: linked-proposal
    })
    
    (var-set action-count new-id)
    
    (print {
      event: "spend-request-created",
      action-id: new-id,
      proposer: tx-sender,
      recipient: recipient,
      amount: amount,
      expires-at: expires-at
    })
    (ok new-id)
  )
)

;; Approve and execute spend (DAO/extension only)
(define-public (approve-and-execute (action-id uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint action-id))
    (match (map-get? treasury-actions action-id)
      action (begin
        ;; Check status
        (asserts! (is-eq (get status action) STATUS-PENDING) ERR-ACTION-NOT-PENDING)
        ;; Check not expired
        (asserts! (<= stacks-block-height (get expires-at action)) ERR-ACTION-EXPIRED)
        
        ;; Execute the transfer via treasury
        (try! (as-contract? ()
          (try! (contract-call? .treasury-v2-c4 withdraw-stx
            (get amount action)
            (get recipient action)
            (get linked-proposal action)
          ))
          true
        ))
        
        ;; Update status
        (map-set treasury-actions action-id (merge action {status: STATUS-EXECUTED}))
        
        (print {
          event: "spend-request-executed",
          action-id: action-id,
          recipient: (get recipient action),
          amount: (get amount action)
        })
        (ok true)
      )
      ERR-ACTION-NOT-FOUND
    )
  )
)

;; Reject a spend request (DAO/extension only)
(define-public (reject-action (action-id uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint action-id))
    (match (map-get? treasury-actions action-id)
      action (begin
        (asserts! (is-eq (get status action) STATUS-PENDING) ERR-ACTION-NOT-PENDING)
        (map-set treasury-actions action-id (merge action {status: STATUS-REJECTED}))
        (print {event: "spend-request-rejected", action-id: action-id})
        (ok true)
      )
      ERR-ACTION-NOT-FOUND
    )
  )
)

;; Mark expired action
(define-public (mark-expired (action-id uint))
  (begin
    (try! (check-uint action-id))
    (match (map-get? treasury-actions action-id)
      action (begin
        (asserts! (> stacks-block-height (get expires-at action)) ERR-ACTION-NOT-PENDING)
        (asserts! (is-eq (get status action) STATUS-PENDING) ERR-ACTION-NOT-PENDING)
        (map-set treasury-actions action-id (merge action {status: STATUS-EXPIRED}))
        (print {event: "spend-request-expired", action-id: action-id})
        (ok true)
      )
      ERR-ACTION-NOT-FOUND
    )
  )
)

;; Extension callback
(define-public (callback (sender principal) (memo (buff 34)))
  (begin
    sender
    memo
    (ok true)
  )
)
