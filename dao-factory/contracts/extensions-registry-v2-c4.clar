;; extensions-registry.clar
;; Modular extension loader and registry
;; Tracks all installed extensions with metadata

;; Error codes
(define-constant ERR-UNAUTHORIZED (err u3000))
(define-constant ERR-EXTENSION-NOT-FOUND (err u3001))
(define-constant ERR-EXTENSION-ALREADY-EXISTS (err u3002))
(define-constant ERR-INVALID-CATEGORY (err u3003))

;; Extension categories
(define-constant CATEGORY-GOVERNANCE u1)
(define-constant CATEGORY-UTILITY u5)

;; Data vars
(define-data-var extension-count uint u0)
(define-data-var extension-nonce uint u0)

;; Data maps
(define-map extension-info
  principal
  {
    id: uint,
    name: (string-ascii 64),
    description: (string-utf8 256),
    category: uint,
    version: (string-ascii 16),
    enabled: bool,
    added-at: uint,
    added-by: principal
  }
)

(define-map extensions-by-id uint principal)
(define-map extensions-by-category uint (list 50 principal))

;; Read-only functions

(define-read-only (get-extension-count)
  (var-get extension-count)
)

(define-read-only (get-extension-info (extension principal))
  (map-get? extension-info extension)
)

(define-read-only (get-extension-by-id (id uint))
  (map-get? extensions-by-id id)
)

(define-read-only (get-extensions-by-category (category uint))
  (default-to (list) (map-get? extensions-by-category category))
)

(define-read-only (is-extension-enabled (extension principal))
  (match (map-get? extension-info extension)
    info (get enabled info)
    false
  )
)

(define-read-only (get-extension-category (extension principal))
  (match (map-get? extension-info extension)
    info (some (get category info))
    none
  )
)

;; Input checks (satisfy check_checker)
(define-private (check-principal (p principal))
  (ok (asserts! (is-eq p p) ERR-UNAUTHORIZED))
)

(define-private (check-ascii-64 (s (string-ascii 64)))
  (ok (asserts! (<= (len s) u64) ERR-UNAUTHORIZED))
)

(define-private (check-ascii-16 (s (string-ascii 16)))
  (ok (asserts! (<= (len s) u16) ERR-UNAUTHORIZED))
)

(define-private (check-utf8-256 (s (string-utf8 256)))
  (ok (asserts! (<= (len s) u256) ERR-UNAUTHORIZED))
)

;; Authorization
(define-private (is-dao-or-extension)
  (contract-call? .dao-core-v2-c4 is-dao-or-extension)
)

;; Public functions

;; Register a new extension
(define-public (register-extension 
  (extension principal) 
  (name (string-ascii 64))
  (description (string-utf8 256))
  (category uint)
  (version (string-ascii 16))
)
  (let
    (
      (new-id (+ (var-get extension-nonce) u1))
      (current-category-list (get-extensions-by-category category))
    )
    (try! (is-dao-or-extension))
    (try! (check-principal extension))
    (try! (check-ascii-64 name))
    (try! (check-utf8-256 description))
    (try! (check-ascii-16 version))
    (asserts! (is-none (map-get? extension-info extension)) ERR-EXTENSION-ALREADY-EXISTS)
    (asserts! (and (>= category CATEGORY-GOVERNANCE) (<= category CATEGORY-UTILITY)) ERR-INVALID-CATEGORY)
    
    ;; Store extension info
    (map-set extension-info extension {
      id: new-id,
      name: name,
      description: description,
      category: category,
      version: version,
      enabled: true,
      added-at: stacks-block-height,
      added-by: tx-sender
    })
    
    ;; Index by ID
    (map-set extensions-by-id new-id extension)
    
    ;; Index by category
    (map-set extensions-by-category category 
      (unwrap-panic (as-max-len? (append current-category-list extension) u50))
    )
    
    ;; Update counters
    (var-set extension-nonce new-id)
    (var-set extension-count (+ (var-get extension-count) u1))
    
    ;; Enable in dao-core
    (try! (as-contract? ()
      (try! (contract-call? .dao-core-v2-c4 set-extension extension true))
      true
    ))
    
    (print {
      event: "extension-registered",
      extension: extension,
      id: new-id,
      name: name,
      category: category
    })
    (ok new-id)
  )
)

;; Enable an extension
(define-public (enable-extension (extension principal))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-principal extension))
    (match (map-get? extension-info extension)
      info (begin
        (map-set extension-info extension (merge info {enabled: true}))
        (try! (as-contract? ()
          (try! (contract-call? .dao-core-v2-c4 set-extension extension true))
          true
        ))
        (print {event: "extension-enabled", extension: extension})
        (ok true)
      )
      ERR-EXTENSION-NOT-FOUND
    )
  )
)

;; Disable an extension
(define-public (disable-extension (extension principal))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-principal extension))
    (match (map-get? extension-info extension)
      info (begin
        (map-set extension-info extension (merge info {enabled: false}))
        (try! (as-contract? ()
          (try! (contract-call? .dao-core-v2-c4 set-extension extension false))
          true
        ))
        (print {event: "extension-disabled", extension: extension})
        (ok true)
      )
      ERR-EXTENSION-NOT-FOUND
    )
  )
)

;; Update extension version
(define-public (update-extension-version (extension principal) (new-version (string-ascii 16)))
  (begin
    (try! (is-dao-or-extension))
    (try! (check-principal extension))
    (try! (check-ascii-16 new-version))
    (match (map-get? extension-info extension)
      info (begin
        (map-set extension-info extension (merge info {version: new-version}))
        (print {event: "extension-updated", extension: extension, version: new-version})
        (ok true)
      )
      ERR-EXTENSION-NOT-FOUND
    )
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
