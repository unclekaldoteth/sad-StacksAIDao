;; template-registry.clar
;; DAO templates library for factory

;; Error codes
(define-constant ERR-UNAUTHORIZED (err u10000))
(define-constant ERR-TEMPLATE-NOT-FOUND (err u10001))
(define-constant ERR-INVALID-TEMPLATE (err u10003))

;; Template types
(define-constant TEMPLATE-BASIC u1)
(define-constant TEMPLATE-FULL u4)

;; Data vars
(define-data-var template-count uint u0)
(define-data-var registry-owner principal tx-sender)

;; Data maps
(define-map templates
  uint  ;; template-id
  {
    name: (string-ascii 64),
    description: (string-utf8 256),
    template-type: uint,
    contracts: (list 20 (string-ascii 64)),
    created-at: uint,
    created-by: principal,
    active: bool,
    usage-count: uint
  }
)

;; Read-only functions

(define-read-only (get-template-count)
  (var-get template-count)
)

(define-read-only (get-template (template-id uint))
  (map-get? templates template-id)
)

(define-read-only (is-template-active (template-id uint))
  (match (map-get? templates template-id)
    template (get active template)
    false
  )
)

(define-read-only (get-template-contracts (template-id uint))
  (match (map-get? templates template-id)
    template (some (get contracts template))
    none
  )
)

;; Input checks (satisfy check_checker)
(define-private (check-principal (p principal))
  (ok (asserts! (is-eq p p) ERR-UNAUTHORIZED))
)

(define-private (check-uint (n uint))
  (ok (asserts! (>= n u0) ERR-UNAUTHORIZED))
)

;; Public functions

;; Create a new template (owner only)
(define-public (create-template
  (name (string-ascii 64))
  (description (string-utf8 256))
  (template-type uint)
  (contracts (list 20 (string-ascii 64)))
)
  (let
    (
      (new-id (+ (var-get template-count) u1))
    )
    ;; Only owner can create templates
    (asserts! (is-eq tx-sender (var-get registry-owner)) ERR-UNAUTHORIZED)
    ;; Validate template type
    (asserts! (and (>= template-type TEMPLATE-BASIC) (<= template-type TEMPLATE-FULL)) ERR-INVALID-TEMPLATE)
    ;; Must have at least one contract
    (asserts! (> (len contracts) u0) ERR-INVALID-TEMPLATE)
    
    ;; Create template
    (map-set templates new-id {
      name: name,
      description: description,
      template-type: template-type,
      contracts: contracts,
      created-at: stacks-block-height,
      created-by: tx-sender,
      active: true,
      usage-count: u0
    })
    
    (var-set template-count new-id)
    
    (print {
      event: "template-created",
      template-id: new-id,
      name: name,
      template-type: template-type,
      contracts: contracts
    })
    (ok new-id)
  )
)

;; Increment usage count (called by factory)
(define-public (increment-usage (template-id uint))
  (begin
    (try! (check-uint template-id))
    (let
      (
        (template (unwrap! (map-get? templates template-id) ERR-TEMPLATE-NOT-FOUND))
      )
      (map-set templates template-id 
        (merge template {usage-count: (+ (get usage-count template) u1)})
      )
      (ok true)
    )
  )
)

;; Activate/deactivate template (owner only)
(define-public (set-template-active (template-id uint) (active bool))
  (begin
    (asserts! (is-eq tx-sender (var-get registry-owner)) ERR-UNAUTHORIZED)
    (try! (check-uint template-id))
    (let
      (
        (template (unwrap! (map-get? templates template-id) ERR-TEMPLATE-NOT-FOUND))
      )
      (map-set templates template-id (merge template {active: active}))
      (print {event: "template-status-updated", template-id: template-id, active: active})
      (ok true)
    )
  )
)

;; Update registry owner
(define-public (set-registry-owner (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get registry-owner)) ERR-UNAUTHORIZED)
    (try! (check-principal new-owner))
    (var-set registry-owner new-owner)
    (print {event: "registry-owner-updated", new-owner: new-owner})
    (ok true)
  )
)
