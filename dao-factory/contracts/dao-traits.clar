;; dao-traits.clar
;; Core trait definitions for the DAO system

;; SIP-010 Fungible Token Trait (for future token extensions)
(define-trait sip-010-trait
  (
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    (get-balance (principal) (response uint uint))
    (get-total-supply () (response uint uint))
    (get-name () (response (string-ascii 32) uint))
    (get-symbol () (response (string-ascii 10) uint))
    (get-decimals () (response uint uint))
    (get-token-uri () (response (optional (string-utf8 256)) uint))
  )
)

;; Extension Trait - All DAO extensions must implement this
(define-trait extension-trait
  (
    ;; Called when extension is enabled
    (callback (principal (buff 34)) (response bool uint))
  )
)

;; Proposal Trait - All proposals must implement this
(define-trait proposal-trait
  (
    ;; Execute the proposal
    (execute (principal) (response bool uint))
  )
)

;; Governance Token Trait - For voting power
(define-trait governance-token-trait
  (
    ;; Get voting power of a principal
    (get-voting-power (principal) (response uint uint))
    ;; Get total voting power
    (get-total-voting-power () (response uint uint))
  )
)
