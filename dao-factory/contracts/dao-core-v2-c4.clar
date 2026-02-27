;; dao-core.clar
;; Central DAO registry and extension management
;; Follows the ExecutorDAO pattern
;;
;; Internal auth helpers are define-private (callable via try! internally).
;; Public wrappers expose them for cross-contract calls.

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
(define-read-only (get-dao-name) (var-get dao-name))
(define-read-only (get-dao-description) (var-get dao-description))
(define-read-only (is-initialized) (var-get initialized))
(define-read-only (self-principal)
  (unwrap-panic (as-contract? () tx-sender))
)
(define-read-only (is-extension (extension principal))
  (default-to false (map-get? extensions extension))
)
(define-read-only (executed-at (proposal principal))
  (map-get? executed-proposals proposal)
)

;; Internal auth helpers (define-private so they can be try!-ed inside this contract)
(define-private (auth-dao-or-extension)
  (let ((self (self-principal)))
    (ok (asserts!
      (or
        (is-eq tx-sender self)
        (is-extension tx-sender)
      )
      ERR-UNAUTHORIZED
    ))
  )
)

(define-private (auth-exec-or-extension)
  (let ((self (self-principal)))
    (ok (asserts!
      (or
        (is-eq tx-sender (var-get executive))
        (is-eq tx-sender self)
        (is-extension tx-sender)
      )
      ERR-UNAUTHORIZED
    ))
  )
)

;; Public wrappers for cross-contract calls (other contracts call these via contract-call?)
(define-public (is-dao-or-extension)
  (auth-dao-or-extension)
)

(define-public (is-exec-or-extension)
  (auth-exec-or-extension)
)

;; Input checks
(define-private (check-principal (p principal))
  (ok (asserts! (is-eq p p) ERR-UNAUTHORIZED))
)

(define-private (check-bool (b bool))
  (ok (asserts! (or (is-eq b true) (is-eq b false)) ERR-UNAUTHORIZED))
)

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
    (try! (auth-exec-or-extension))
    (try! (check-principal extension))
    (try! (check-bool enabled))
    (print {event: "extension", extension: extension, enabled: enabled})
    (ok (map-set extensions extension enabled))
  )
)

;; Set multiple extensions at once
(define-public (set-extensions (extension-list (list 20 {extension: principal, enabled: bool})))
  (begin
    (try! (auth-exec-or-extension))
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
(define-public (execute (proposal principal) (sender principal))
  (begin
    (try! (auth-dao-or-extension))
    (try! (check-principal proposal))
    (try! (check-principal sender))
    (asserts! (is-none (executed-at proposal)) ERR-ALREADY-EXECUTED)
    (map-set executed-proposals proposal stacks-block-height)
    (print {event: "execute", proposal: proposal, sender: sender})
    (ok true)
  )
)

;; Request extension callback
(define-public (request-extension-callback (extension principal) (memo (buff 34)))
  (begin
    (try! (check-principal extension))
    (asserts! (is-extension extension) ERR-INVALID-EXTENSION)
    (print {event: "extension-callback", extension: extension, memo: memo})
    (ok true)
  )
)
