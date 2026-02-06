;; membership.clar
;; DAO Member Registry with roles and permissions
;; Extension for dao-core

;; Error codes
(define-constant ERR-ALREADY-MEMBER (err u2001))
(define-constant ERR-NOT-MEMBER (err u2002))
(define-constant ERR-INVALID-ROLE (err u2003))

;; Role constants
(define-constant ROLE-MEMBER u1)
(define-constant ROLE-PROPOSER u2)
(define-constant ROLE-MODERATOR u3)
(define-constant ROLE-ADMIN u4)

;; Data vars
(define-data-var member-count uint u0)
;; Data maps
(define-map members 
  principal 
  {
    role: uint,
    joined-at: uint,
    stx-at-join: uint
  }
)

(define-map role-permissions
  uint
  {
    can-propose: bool,
    can-vote: bool,
    can-moderate: bool,
    can-admin: bool
  }
)

;; Initialize default role permissions
(map-set role-permissions ROLE-MEMBER {can-propose: false, can-vote: true, can-moderate: false, can-admin: false})
(map-set role-permissions ROLE-PROPOSER {can-propose: true, can-vote: true, can-moderate: false, can-admin: false})
(map-set role-permissions ROLE-MODERATOR {can-propose: true, can-vote: true, can-moderate: true, can-admin: false})
(map-set role-permissions ROLE-ADMIN {can-propose: true, can-vote: true, can-moderate: true, can-admin: true})

;; Read-only functions

(define-read-only (get-member-count)
  (var-get member-count)
)

(define-read-only (get-member-info (who principal))
  (map-get? members who)
)

(define-read-only (is-member (who principal))
  (is-some (map-get? members who))
)

(define-read-only (get-member-role (who principal))
  (match (map-get? members who)
    member (some (get role member))
    none
  )
)

(define-read-only (get-role-permissions (role uint))
  (map-get? role-permissions role)
)

(define-read-only (can-propose (who principal))
  (match (get-member-role who)
    role (match (get-role-permissions role)
      perms (get can-propose perms)
      false
    )
    false
  )
)

(define-read-only (can-vote (who principal))
  (match (get-member-role who)
    role (match (get-role-permissions role)
      perms (get can-vote perms)
      false
    )
    false
  )
)

;; STX-based voting power
(define-read-only (get-voting-power (who principal))
  (ok (stx-get-balance who))
)

(define-read-only (get-total-voting-power)
  (ok stx-liquid-supply)
)

;; Authorization - must be called by DAO or extension
(define-private (is-dao-or-extension)
  (contract-call? .dao-core is-dao-or-extension)
)

;; Public functions

;; Add a new member (admin only via DAO)
(define-public (add-member (who principal) (role uint))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (not (is-member who)) ERR-ALREADY-MEMBER)
    (asserts! (and (>= role ROLE-MEMBER) (<= role ROLE-ADMIN)) ERR-INVALID-ROLE)
    (map-set members who {
      role: role,
      joined-at: stacks-block-height,
      stx-at-join: (stx-get-balance who)
    })
    (var-set member-count (+ (var-get member-count) u1))
    (print {event: "member-added", member: who, role: role})
    (ok true)
  )
)

;; Remove a member (admin only via DAO)
(define-public (remove-member (who principal))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (is-member who) ERR-NOT-MEMBER)
    (map-delete members who)
    (var-set member-count (- (var-get member-count) u1))
    (print {event: "member-removed", member: who})
    (ok true)
  )
)

;; Update member role (admin only via DAO)
(define-public (set-member-role (who principal) (new-role uint))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (is-member who) ERR-NOT-MEMBER)
    (asserts! (and (>= new-role ROLE-MEMBER) (<= new-role ROLE-ADMIN)) ERR-INVALID-ROLE)
    (match (map-get? members who)
      member (begin
        (map-set members who (merge member {role: new-role}))
        (print {event: "role-updated", member: who, new-role: new-role})
        (ok true)
      )
      ERR-NOT-MEMBER
    )
  )
)

;; Self-join as basic member (open DAOs)
(define-public (join)
  (begin
    (asserts! (not (is-member tx-sender)) ERR-ALREADY-MEMBER)
    (map-set members tx-sender {
      role: ROLE-MEMBER,
      joined-at: stacks-block-height,
      stx-at-join: (stx-get-balance tx-sender)
    })
    (var-set member-count (+ (var-get member-count) u1))
    (print {event: "member-joined", member: tx-sender})
    (ok true)
  )
)

;; Extension callback (required by extension-trait)
(define-public (callback (sender principal) (memo (buff 34)))
  (begin
    sender
    memo
    (ok true)
  )
)
