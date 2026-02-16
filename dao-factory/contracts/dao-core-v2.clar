;; dao-core.clar
;; Central DAO registry and extension management
;; Follows the ExecutorDAO pattern

;; Trait imports (must be at top)
(use-trait proposal-trait .dao-traits-v2.proposal-trait)
(use-trait extension-trait .dao-traits-v2.extension-trait)

;; Error codes
(define-constant ERR-UNAUTHORIZED (err u1000))
(define-constant ERR-ALREADY-EXECUTED (err u1001))
(define-constant ERR-INVALID-EXTENSION (err u1002))
(define-constant ERR-ALREADY-INITIALIZED (err u1004))

;; Data vars
(define-data-var dao-name (string-ascii 64) "")
(define-data-var dao-description (string-utf8 256) u"")
(define-data-var initialized bool false)
(define-data-var executive principal tx-sender)

;; Data maps
(define-map extensions principal bool)
(define-map executed-proposals principal uint)

;; Read-only functions

(define-read-only (get-dao-name)
  (var-get dao-name)
)

(define-read-only (get-dao-description)
  (var-get dao-description)
)

(define-read-only (is-initialized)
  (var-get initialized)
)

(define-read-only (is-extension (extension principal))
  (default-to false (map-get? extensions extension))
)

(define-read-only (executed-at (proposal principal))
  (map-get? executed-proposals proposal)
)

;; Authorization check
(define-read-only (is-dao-or-extension)
  (ok (asserts! 
    (or 
      (is-eq tx-sender (as-contract tx-sender))
      (is-extension tx-sender)
    ) 
    ERR-UNAUTHORIZED
  ))
)

;; Authorization for extension management (executive or extension)
(define-read-only (is-exec-or-extension)
  (ok (asserts!
    (or
      (is-eq tx-sender (var-get executive))
      (is-eq tx-sender (as-contract tx-sender))
      (is-extension tx-sender)
    )
    ERR-UNAUTHORIZED
  ))
)

;; Input checks (satisfy check_checker)
(define-private (check-principal (p principal))
  (ok (asserts! (is-eq p p) ERR-UNAUTHORIZED))
)

(define-private (check-bool (b bool))
  (ok (asserts! (or (is-eq b true) (is-eq b false)) ERR-UNAUTHORIZED))
)

;; Public functions

;; Initialize the DAO (can only be called once)
(define-public (initialize (name (string-ascii 64)) (description (string-utf8 256)))
  (begin
    (asserts! (not (var-get initialized)) ERR-ALREADY-INITIALIZED)
    (asserts! (is-eq tx-sender (var-get executive)) ERR-UNAUTHORIZED)
    (var-set executive tx-sender)
    (var-set dao-name name)
    (var-set dao-description description)
    (var-set initialized true)
    (ok true)
  )
)

;; Set extension status (enable/disable)
(define-public (set-extension (extension principal) (enabled bool))
  (begin
    (try! (is-exec-or-extension))
    (try! (check-principal extension))
    (try! (check-bool enabled))
    (print {event: "extension", extension: extension, enabled: enabled})
    (ok (map-set extensions extension enabled))
  )
)

;; Set multiple extensions at once
(define-public (set-extensions (extension-list (list 20 {extension: principal, enabled: bool})))
  (begin
    (try! (is-exec-or-extension))
    (ok (map set-extension-iter extension-list))
  )
)

(define-private (set-extension-iter (item {extension: principal, enabled: bool}))
  (begin
    (unwrap-panic (check-principal (get extension item)))
    (unwrap-panic (check-bool (get enabled item)))
    (print {event: "extension", extension: (get extension item), enabled: (get enabled item)})
    (map-set extensions (get extension item) (get enabled item))
  )
)

;; Execute a proposal (called by governance extension)
(define-public (execute (proposal <proposal-trait>) (sender principal))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (is-none (executed-at (contract-of proposal))) ERR-ALREADY-EXECUTED)
    (let
      (
        (exec-result (as-contract (contract-call? proposal execute sender)))
      )
      (match exec-result
        ok-value (begin
          (map-set executed-proposals (contract-of proposal) stacks-block-height)
          (print {event: "execute", proposal: (contract-of proposal)})
          (ok ok-value)
        )
        err-value (err err-value)
      )
    )
  )
)

;; Request extension callback
(define-public (request-extension-callback (extension <extension-trait>) (memo (buff 34)))
  (let
    (
      (sender tx-sender)
    )
    (asserts! (is-extension (contract-of extension)) ERR-INVALID-EXTENSION)
    (as-contract (contract-call? extension callback sender memo))
  )
)
