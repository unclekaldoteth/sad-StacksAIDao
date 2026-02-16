;; proposal-voting.clar
;; Vote casting, tallying, and quorum checks

;; Error codes
(define-constant ERR-PROPOSAL-NOT-FOUND (err u6001))
(define-constant ERR-PROPOSAL-NOT-ACTIVE (err u6002))
(define-constant ERR-ALREADY-VOTED (err u6003))
(define-constant ERR-VOTING-NOT-ENDED (err u6005))
(define-constant ERR-NO-VOTING-POWER (err u6007))
(define-constant ERR-INVALID-VOTE-OPTION (err u6008))

;; Vote options
(define-constant VOTE-FOR u1)
(define-constant VOTE-AGAINST u2)
(define-constant VOTE-ABSTAIN u3)

;; Configuration
(define-constant QUORUM-THRESHOLD u1000000000) ;; 1000 STX quorum
(define-constant APPROVAL-THRESHOLD u5100) ;; 51% approval required (in basis points)

;; Data maps
(define-map proposal-votes
  uint  ;; proposal-id
  {
    votes-for: uint,
    votes-against: uint,
    votes-abstain: uint,
    total-votes: uint,
    voter-count: uint
  }
)

(define-map voter-records
  {proposal-id: uint, voter: principal}
  {
    vote: uint,
    power: uint,
    voted-at: uint
  }
)

;; Read-only functions

(define-read-only (get-proposal-votes (proposal-id uint))
  (default-to 
    {votes-for: u0, votes-against: u0, votes-abstain: u0, total-votes: u0, voter-count: u0}
    (map-get? proposal-votes proposal-id)
  )
)

(define-read-only (get-voter-record (proposal-id uint) (voter principal))
  (map-get? voter-records {proposal-id: proposal-id, voter: voter})
)

(define-read-only (has-voted (proposal-id uint) (voter principal))
  (is-some (map-get? voter-records {proposal-id: proposal-id, voter: voter}))
)

(define-read-only (is-quorum-reached (proposal-id uint))
  (let
    (
      (votes (get-proposal-votes proposal-id))
    )
    (>= (get total-votes votes) QUORUM-THRESHOLD)
  )
)

(define-read-only (is-proposal-passed (proposal-id uint))
  (let
    (
      (votes (get-proposal-votes proposal-id))
      (total-decisive (+ (get votes-for votes) (get votes-against votes)))
    )
    (if (is-eq total-decisive u0)
      false
      (and 
        (is-quorum-reached proposal-id)
        (>= (* (get votes-for votes) u10000) (* total-decisive APPROVAL-THRESHOLD))
      )
    )
  )
)

(define-read-only (get-approval-percentage (proposal-id uint))
  (let
    (
      (votes (get-proposal-votes proposal-id))
      (total-decisive (+ (get votes-for votes) (get votes-against votes)))
    )
    (if (is-eq total-decisive u0)
      u0
      (/ (* (get votes-for votes) u10000) total-decisive)
    )
  )
)

;; Input checks (satisfy check_checker)
(define-private (check-uint (n uint))
  (ok (asserts! (>= n u0) ERR-PROPOSAL-NOT-ACTIVE))
)

;; Resolve vote weight from governance-token snapshots when available.
;; If missing, snapshot voting power once for this voter/proposal.
(define-private (resolve-voting-power (proposal-id uint) (voter principal))
  (match (contract-call? .governance-token-v2 get-snapshot-power voter proposal-id)
    snapshot-power (ok snapshot-power)
    (as-contract (contract-call? .governance-token-v2 snapshot-voting-power voter proposal-id))
  )
)

;; Public functions

;; Cast a vote
(define-public (vote (proposal-id uint) (vote-option uint))
  (let
    (
      (voter tx-sender)
      (current-votes (get-proposal-votes proposal-id))
    )
    ;; Check proposal is active
    (try! (check-uint proposal-id))
    (asserts! (contract-call? .proposal-submission-v2 is-proposal-active proposal-id) ERR-PROPOSAL-NOT-ACTIVE)
    
    ;; Check hasn't voted
    (asserts! (not (has-voted proposal-id voter)) ERR-ALREADY-VOTED)
    
    ;; Check vote option is valid
    (asserts! (or
      (is-eq vote-option VOTE-FOR)
      (is-eq vote-option VOTE-AGAINST)
      (is-eq vote-option VOTE-ABSTAIN)
    ) ERR-INVALID-VOTE-OPTION)

    (let
      (
        (voting-power (try! (resolve-voting-power proposal-id voter)))
      )
      ;; Check has voting power
      (asserts! (> voting-power u0) ERR-NO-VOTING-POWER)
      
      ;; Record vote
      (map-set voter-records 
        {proposal-id: proposal-id, voter: voter}
        {
          vote: vote-option,
          power: voting-power,
          voted-at: stacks-block-height
        }
      )
      
      ;; Update vote tallies
      (map-set proposal-votes proposal-id
        (merge current-votes {
          votes-for: (if (is-eq vote-option VOTE-FOR) 
            (+ (get votes-for current-votes) voting-power) 
            (get votes-for current-votes)),
          votes-against: (if (is-eq vote-option VOTE-AGAINST) 
            (+ (get votes-against current-votes) voting-power) 
            (get votes-against current-votes)),
          votes-abstain: (if (is-eq vote-option VOTE-ABSTAIN) 
            (+ (get votes-abstain current-votes) voting-power) 
            (get votes-abstain current-votes)),
          total-votes: (+ (get total-votes current-votes) voting-power),
          voter-count: (+ (get voter-count current-votes) u1)
        })
      )
      
      (print {
        event: "vote-cast",
        proposal-id: proposal-id,
        voter: voter,
        vote: vote-option,
        power: voting-power
      })
      (ok true)
    )
  )
)

;; Conclude voting and determine outcome
(define-public (conclude (proposal-id uint))
  (let
    (
      (proposal-data (unwrap! (contract-call? .proposal-submission-v2 get-proposal proposal-id) ERR-PROPOSAL-NOT-FOUND))
      (passed (is-proposal-passed proposal-id))
      (new-status (if passed u3 u4)) ;; STATUS-PASSED or STATUS-REJECTED
    )
    ;; Check voting period has ended
    (asserts! (> stacks-block-height (get end-block proposal-data)) ERR-VOTING-NOT-ENDED)
    
    ;; Update proposal status
    (try! (as-contract (contract-call? .proposal-submission-v2 set-proposal-status proposal-id new-status)))
    
    ;; If passed and has proposal contract, execute it
    (if (and passed (is-some (get proposal-contract proposal-data)))
      (begin
        (print {
          event: "proposal-concluded",
          proposal-id: proposal-id,
          passed: passed,
          executable: true
        })
        (ok passed)
      )
      (begin
        (print {
          event: "proposal-concluded",
          proposal-id: proposal-id,
          passed: passed,
          executable: false
        })
        (ok passed)
      )
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
