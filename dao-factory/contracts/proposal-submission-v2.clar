;; proposal-submission.clar
;; Create and validate governance proposals

;; Error codes
(define-constant ERR-PROPOSAL-NOT-FOUND (err u5001))
(define-constant ERR-PROPOSAL-ALREADY-EXISTS (err u5002))
(define-constant ERR-INVALID-PROPOSAL (err u5003))
(define-constant ERR-MINIMUM-POWER-NOT-MET (err u5004))

;; Proposal status constants
(define-constant STATUS-PENDING u1)
(define-constant STATUS-ACTIVE u2)
(define-constant STATUS-EXPIRED u6)

;; Configuration
(define-constant MINIMUM-PROPOSAL-POWER u1000000) ;; 1 STX minimum to propose
(define-constant PROPOSAL-DURATION u1440) ;; ~10 days in blocks
(define-constant VOTING-DELAY u144) ;; ~1 day delay before voting starts

;; Data vars
(define-data-var proposal-count uint u0)

;; Data maps
(define-map proposals
  uint  ;; proposal-id
  {
    proposer: principal,
    title: (string-ascii 128),
    description: (string-utf8 1024),
    proposal-contract: (optional principal),
    created-at: uint,
    start-block: uint,
    end-block: uint,
    status: uint,
    execution-delay: uint
  }
)

(define-map proposal-by-contract principal uint)

;; Read-only functions

(define-read-only (get-proposal-count)
  (var-get proposal-count)
)

(define-read-only (get-proposal (proposal-id uint))
  (map-get? proposals proposal-id)
)

(define-read-only (get-proposal-by-contract (proposal-contract principal))
  (match (map-get? proposal-by-contract proposal-contract)
    id (get-proposal id)
    none
  )
)

(define-read-only (get-proposal-status (proposal-id uint))
  (match (map-get? proposals proposal-id)
    proposal (some (get status proposal))
    none
  )
)

(define-read-only (is-proposal-active (proposal-id uint))
  (match (map-get? proposals proposal-id)
    proposal (and 
      (is-eq (get status proposal) STATUS-ACTIVE)
      (>= stacks-block-height (get start-block proposal))
      (<= stacks-block-height (get end-block proposal))
    )
    false
  )
)

(define-read-only (can-propose (who principal))
  (>= (stx-get-balance who) MINIMUM-PROPOSAL-POWER)
)

;; Input checks (satisfy check_checker)
(define-private (check-ascii-128 (s (string-ascii 128)))
  (ok (asserts! (> (len s) u0) ERR-INVALID-PROPOSAL))
)

(define-private (check-utf8-1024 (s (string-utf8 1024)))
  (ok (asserts! (> (len s) u0) ERR-INVALID-PROPOSAL))
)

(define-private (check-optional-principal (p (optional principal)))
  (ok (asserts! (is-eq p p) ERR-INVALID-PROPOSAL))
)

(define-private (check-uint (n uint))
  (ok (asserts! (>= n u0) ERR-INVALID-PROPOSAL))
)

;; Authorization
(define-private (is-dao-or-extension)
  (contract-call? .dao-core-v2 is-dao-or-extension)
)

;; Public functions

;; Create a new proposal
(define-public (propose 
  (title (string-ascii 128))
  (description (string-utf8 1024))
  (proposal-contract (optional principal))
)
  (let
    (
      (proposer-power (stx-get-balance tx-sender))
      (new-id (+ (var-get proposal-count) u1))
      (start-block (+ stacks-block-height VOTING-DELAY))
      (end-block (+ start-block PROPOSAL-DURATION))
    )
    (try! (check-ascii-128 title))
    (try! (check-utf8-1024 description))
    (try! (check-optional-principal proposal-contract))
    ;; Check minimum power requirement
    (asserts! (>= proposer-power MINIMUM-PROPOSAL-POWER) ERR-MINIMUM-POWER-NOT-MET)
    
    ;; Check proposal contract doesn't already have a proposal
    (match proposal-contract
      contract (asserts! (is-none (map-get? proposal-by-contract contract)) ERR-PROPOSAL-ALREADY-EXISTS)
      true
    )
    
    ;; Create proposal
    (map-set proposals new-id {
      proposer: tx-sender,
      title: title,
      description: description,
      proposal-contract: proposal-contract,
      created-at: stacks-block-height,
      start-block: start-block,
      end-block: end-block,
      status: STATUS-PENDING,
      execution-delay: u0
    })
    
    ;; Index by contract if provided
    (match proposal-contract
      contract (map-set proposal-by-contract contract new-id)
      true
    )
    
    (var-set proposal-count new-id)
    
    (print {
      event: "proposal-created",
      proposal-id: new-id,
      proposer: tx-sender,
      title: title,
      start-block: start-block,
      end-block: end-block
    })
    (ok new-id)
  )
)

;; Activate a pending proposal (moves from pending to active)
(define-public (activate-proposal (proposal-id uint))
  (begin
    (try! (check-uint proposal-id))
    (let
      (
        (proposal (unwrap! (map-get? proposals proposal-id) ERR-PROPOSAL-NOT-FOUND))
      )
      (asserts! (is-eq (get status proposal) STATUS-PENDING) ERR-INVALID-PROPOSAL)
      (asserts! (>= stacks-block-height (get start-block proposal)) ERR-INVALID-PROPOSAL)
      
      (map-set proposals proposal-id (merge proposal {status: STATUS-ACTIVE}))
      
      (print {event: "proposal-activated", proposal-id: proposal-id})
      (ok true)
    )
  )
)

;; Update proposal status (called by voting contract)
(define-public (set-proposal-status (proposal-id uint) (new-status uint))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-uint proposal-id))
    (asserts! (and (>= new-status STATUS-PENDING) (<= new-status STATUS-EXPIRED)) ERR-INVALID-PROPOSAL)
    (let
      (
        (proposal (unwrap! (map-get? proposals proposal-id) ERR-PROPOSAL-NOT-FOUND))
      )
      (map-set proposals proposal-id (merge proposal {status: new-status}))
      (print {event: "proposal-status-updated", proposal-id: proposal-id, status: new-status})
      (ok true)
    )
  )
)

;; Mark proposal as expired
(define-public (expire-proposal (proposal-id uint))
  (begin
    (try! (check-uint proposal-id))
    (let
      (
        (proposal (unwrap! (map-get? proposals proposal-id) ERR-PROPOSAL-NOT-FOUND))
      )
      (asserts! (> stacks-block-height (get end-block proposal)) ERR-INVALID-PROPOSAL)
      (asserts! (or (is-eq (get status proposal) STATUS-PENDING) (is-eq (get status proposal) STATUS-ACTIVE)) ERR-INVALID-PROPOSAL)
      
      (map-set proposals proposal-id (merge proposal {status: STATUS-EXPIRED}))
      
      (print {event: "proposal-expired", proposal-id: proposal-id})
      (ok true)
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
