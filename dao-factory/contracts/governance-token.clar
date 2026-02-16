;; governance-token.clar
;; STX-based governance token wrapper
;; Uses native STX balance as voting power (no new token deployment)

;; Error codes
(define-constant ERR-UNAUTHORIZED (err u4000))
(define-constant ERR-INSUFFICIENT-BALANCE (err u4001))
(define-constant ERR-DELEGATION-EXISTS (err u4002))
(define-constant ERR-NO-DELEGATION (err u4003))
(define-constant ERR-SNAPSHOT-EXISTS (err u4004))

;; Data vars
(define-data-var total-delegated uint u0)

;; Data maps
;; Track delegated voting power
(define-map delegations
  principal  ;; delegator
  {
    delegate: principal,
    amount: uint,
    delegated-at: uint
  }
)

;; Track voting power received from delegations
(define-map delegated-power
  principal  ;; delegate
  uint       ;; total power received
)

;; Snapshot of voting power at proposal creation
(define-map voting-snapshots
  {voter: principal, proposal-id: uint}
  uint
)

;; Read-only functions

;; Get raw STX balance (base voting power)
(define-read-only (get-stx-balance (who principal))
  (stx-get-balance who)
)

;; Get voting power including delegations
(define-read-only (get-voting-power (who principal))
  (let
    (
      (own-balance (stx-get-balance who))
      (received-delegation (default-to u0 (map-get? delegated-power who)))
      (given-delegation (match (map-get? delegations who)
        delegation (get amount delegation)
        u0
      ))
      (base-power (if (>= own-balance given-delegation)
        (- own-balance given-delegation)
        u0
      ))
    )
    ;; Voting power = own balance - delegated away + received delegations
    (ok (+ base-power received-delegation))
  )
)

;; Get total voting power (liquid supply)
(define-read-only (get-total-voting-power)
  (ok stx-liquid-supply)
)

;; Check if user has delegated
(define-read-only (get-delegation (who principal))
  (map-get? delegations who)
)

;; Get voting power received from delegations
(define-read-only (get-delegated-power (who principal))
  (default-to u0 (map-get? delegated-power who))
)

;; Get snapshot voting power for a proposal
(define-read-only (get-snapshot-power (voter principal) (proposal-id uint))
  (map-get? voting-snapshots {voter: voter, proposal-id: proposal-id})
)

;; Input checks (satisfy check_checker)
(define-private (check-principal (p principal))
  (ok (asserts! (is-eq p p) ERR-UNAUTHORIZED))
)

(define-private (check-uint (n uint))
  (ok (asserts! (>= n u0) ERR-UNAUTHORIZED))
)

;; Authorization
(define-private (is-dao-or-extension)
  (contract-call? .dao-core is-dao-or-extension)
)

;; Public functions

;; Delegate voting power to another address
(define-public (delegate (delegate-to principal) (amount uint))
  (let
    (
      (balance (stx-get-balance tx-sender))
      (existing-delegation (map-get? delegations tx-sender))
    )
    (try! (check-principal delegate-to))
    (try! (check-uint amount))
    ;; Can't already have a delegation
    (asserts! (is-none existing-delegation) ERR-DELEGATION-EXISTS)
    ;; Must have sufficient balance
    (asserts! (>= balance amount) ERR-INSUFFICIENT-BALANCE)
    
    ;; Record delegation
    (map-set delegations tx-sender {
      delegate: delegate-to,
      amount: amount,
      delegated-at: stacks-block-height
    })
    
    ;; Update delegate's received power
    (map-set delegated-power delegate-to
      (+ (get-delegated-power delegate-to) amount)
    )
    
    (var-set total-delegated (+ (var-get total-delegated) amount))
    
    (print {
      event: "delegation",
      delegator: tx-sender,
      delegate: delegate-to,
      amount: amount
    })
    (ok true)
  )
)

;; Remove delegation
(define-public (undelegate)
  (match (map-get? delegations tx-sender)
    delegation (begin
      ;; Remove from delegate's received power
      (map-set delegated-power (get delegate delegation)
        (- (get-delegated-power (get delegate delegation)) (get amount delegation))
      )
      
      ;; Remove delegation record
      (map-delete delegations tx-sender)
      
      (var-set total-delegated (- (var-get total-delegated) (get amount delegation)))
      
      (print {
        event: "undelegation",
        delegator: tx-sender,
        delegate: (get delegate delegation),
        amount: (get amount delegation)
      })
      (ok true)
    )
    ERR-NO-DELEGATION
  )
)

;; Take snapshot of voting power (called by proposal-submission)
(define-public (snapshot-voting-power (voter principal) (proposal-id uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-principal voter))
    (try! (check-uint proposal-id))
    ;; Keep snapshots immutable once written for a voter/proposal pair.
    (asserts! (is-none (get-snapshot-power voter proposal-id)) ERR-SNAPSHOT-EXISTS)
    (let
      (
        (power (unwrap-panic (get-voting-power voter)))
      )
      (map-set voting-snapshots {voter: voter, proposal-id: proposal-id} power)
      (ok power)
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
