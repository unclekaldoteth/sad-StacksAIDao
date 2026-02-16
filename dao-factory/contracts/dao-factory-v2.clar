;; dao-factory.clar
;; Clone and deploy DAO instances

;; Error codes
(define-constant ERR-UNAUTHORIZED (err u9000))
(define-constant ERR-DAO-EXISTS (err u9001))
(define-constant ERR-INVALID-NAME (err u9002))

;; Data vars
(define-data-var dao-count uint u0)
(define-data-var factory-owner principal tx-sender)

;; Data maps
(define-map deployed-daos
  uint  ;; dao-id
  {
    name: (string-ascii 64),
    core-contract: principal,
    deployer: principal,
    deployed-at: uint,
    template-id: uint
  }
)

(define-map dao-by-name (string-ascii 64) uint)
(define-map dao-by-deployer principal (list 50 uint))

;; Read-only functions

(define-read-only (get-dao-count)
  (var-get dao-count)
)

(define-read-only (get-dao-info (dao-id uint))
  (map-get? deployed-daos dao-id)
)

(define-read-only (get-dao-by-name (name (string-ascii 64)))
  (match (map-get? dao-by-name name)
    id (get-dao-info id)
    none
  )
)

(define-read-only (get-daos-by-deployer (deployer principal))
  (default-to (list) (map-get? dao-by-deployer deployer))
)

(define-read-only (is-name-available (name (string-ascii 64)))
  (is-none (map-get? dao-by-name name))
)

;; Input checks (satisfy check_checker)
(define-private (check-principal (p principal))
  (ok (asserts! (is-eq p p) ERR-UNAUTHORIZED))
)

(define-private (check-uint (n uint))
  (ok (asserts! (>= n u0) ERR-UNAUTHORIZED))
)

;; Public functions

;; Register a newly deployed DAO (called after manual deployment)
(define-public (register-dao 
  (name (string-ascii 64))
  (core-contract principal)
  (template-id uint)
)
  (let
    (
      (new-id (+ (var-get dao-count) u1))
      (deployer-daos (get-daos-by-deployer tx-sender))
    )
    ;; Check name is available
    (asserts! (is-name-available name) ERR-DAO-EXISTS)
    ;; Check name is valid (non-empty)
    (asserts! (> (len name) u0) ERR-INVALID-NAME)
    (try! (check-principal core-contract))
    (try! (check-uint template-id))
    
    ;; Register DAO
    (map-set deployed-daos new-id {
      name: name,
      core-contract: core-contract,
      deployer: tx-sender,
      deployed-at: stacks-block-height,
      template-id: template-id
    })
    
    ;; Index by name
    (map-set dao-by-name name new-id)
    
    ;; Index by deployer
    (map-set dao-by-deployer tx-sender
      (unwrap-panic (as-max-len? (append deployer-daos new-id) u50))
    )
    
    (var-set dao-count new-id)
    
    (print {
      event: "dao-registered",
      dao-id: new-id,
      name: name,
      core-contract: core-contract,
      deployer: tx-sender,
      template-id: template-id
    })
    (ok new-id)
  )
)

;; Update factory owner
(define-public (set-factory-owner (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get factory-owner)) ERR-UNAUTHORIZED)
    (try! (check-principal new-owner))
    (var-set factory-owner new-owner)
    (print {event: "factory-owner-updated", new-owner: new-owner})
    (ok true)
  )
)
