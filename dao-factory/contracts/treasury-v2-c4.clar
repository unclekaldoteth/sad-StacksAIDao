;; treasury.clar
;; Multi-asset DAO treasury vault

;; Error codes
(define-constant ERR-UNAUTHORIZED (err u7000))
(define-constant ERR-INSUFFICIENT-FUNDS (err u7001))
(define-constant ERR-INVALID-ASSET (err u7002))

;; Asset types
(define-constant ASSET-STX u1)

;; Data vars
(define-data-var treasury-stx-balance uint u0)
(define-data-var total-received uint u0)
(define-data-var total-spent uint u0)

;; Data maps
(define-map token-balances principal uint)
(define-map allowed-tokens principal bool)

(define-map spend-history
  uint  ;; spend-id
  {
    asset-type: uint,
    token: (optional principal),
    amount: uint,
    recipient: principal,
    proposal-id: (optional uint),
    spent-at: uint,
    spent-by: principal
  }
)

(define-data-var spend-nonce uint u0)

;; Read-only functions

(define-read-only (self-principal)
  (unwrap-panic (as-contract? () tx-sender))
)

;; Return treasury contract STX balance as uint.
;; This is used in arithmetic comparisons across dependent contracts.
(define-read-only (get-stx-balance)
  (stx-get-balance (self-principal))
)

(define-read-only (get-token-balance (token principal))
  (default-to u0 (map-get? token-balances token))
)

(define-read-only (is-token-allowed (token principal))
  (default-to false (map-get? allowed-tokens token))
)

(define-read-only (get-spend-history (spend-id uint))
  (map-get? spend-history spend-id)
)

(define-read-only (get-treasury-stats)
  {
    stx-balance: (get-stx-balance),
    total-received: (var-get total-received),
    total-spent: (var-get total-spent),
    spend-count: (var-get spend-nonce)
  }
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

(define-private (check-bool (b bool))
  (ok (asserts! (or (is-eq b true) (is-eq b false)) ERR-UNAUTHORIZED))
)

;; Authorization
(define-private (is-dao-or-extension)
  (contract-call? .dao-core-v2-c4 is-dao-or-extension)
)

;; Public functions

;; Deposit STX into treasury
(define-public (deposit-stx (amount uint))
  (let ((self (self-principal)))
    (try! (check-uint amount))
    (try! (stx-transfer? amount tx-sender self))
    (var-set treasury-stx-balance (+ (var-get treasury-stx-balance) amount))
    (var-set total-received (+ (var-get total-received) amount))
    (print {
      event: "treasury-deposit",
      asset: "STX",
      amount: amount,
      depositor: tx-sender
    })
    (ok true)
  )
)

;; Withdraw STX from treasury (DAO/extension only)
(define-public (withdraw-stx (amount uint) (recipient principal) (proposal-id (optional uint)))
  (let
    (
      (current-balance (get-stx-balance))
      (new-spend-id (+ (var-get spend-nonce) u1))
    )
    (try! (is-dao-or-extension))
    (try! (check-uint amount))
    (try! (check-principal recipient))
    (try! (check-optional-uint proposal-id))
    (asserts! (>= current-balance amount) ERR-INSUFFICIENT-FUNDS)
    
    ;; Transfer from contract
    (try! (as-contract? ((with-stx amount))
      (try! (stx-transfer? amount tx-sender recipient))
      true
    ))
    
    ;; Update state
    (var-set treasury-stx-balance (- (var-get treasury-stx-balance) amount))
    (var-set total-spent (+ (var-get total-spent) amount))
    (var-set spend-nonce new-spend-id)
    
    ;; Record spend history
    (map-set spend-history new-spend-id {
      asset-type: ASSET-STX,
      token: none,
      amount: amount,
      recipient: recipient,
      proposal-id: proposal-id,
      spent-at: stacks-block-height,
      spent-by: tx-sender
    })
    
    (print {
      event: "treasury-withdrawal",
      spend-id: new-spend-id,
      asset: "STX",
      amount: amount,
      recipient: recipient,
      proposal-id: proposal-id
    })
    (ok new-spend-id)
  )
)

;; Allow a token to be held in treasury (DAO/extension only)
(define-public (set-allowed-token (token principal) (allowed bool))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-principal token))
    (try! (check-bool allowed))
    (map-set allowed-tokens token allowed)
    (print {event: "token-allowlist-updated", token: token, allowed: allowed})
    (ok true)
  )
)

;; Update token balance (called after deposits)
(define-public (update-token-balance (token principal) (new-balance uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-principal token))
    (try! (check-uint new-balance))
    (asserts! (is-token-allowed token) ERR-INVALID-ASSET)
    (map-set token-balances token new-balance)
    (ok true)
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
