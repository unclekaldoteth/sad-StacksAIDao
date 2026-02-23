;; vesting-manager-v2.clar
;; Linear vesting schedules funded by treasury.

(define-constant ERR-UNAUTHORIZED (err u11900))
(define-constant ERR-SCHEDULE-NOT-FOUND (err u11901))
(define-constant ERR-INVALID-SCHEDULE (err u11902))
(define-constant ERR-NOTHING-TO-RELEASE (err u11903))
(define-constant ERR-INVALID-AMOUNT (err u11904))

(define-data-var schedule-count uint u0)

(define-map schedules
  uint
  {
    beneficiary: principal,
    total: uint,
    start-block: uint,
    cliff-block: uint,
    end-block: uint,
    released: uint
  }
)

(define-read-only (get-schedule (schedule-id uint))
  (map-get? schedules schedule-id)
)

(define-private (is-dao-or-extension)
  (contract-call? .dao-core-v2 is-dao-or-extension)
)

(define-private (vested-amount (schedule {beneficiary: principal, total: uint, start-block: uint, cliff-block: uint, end-block: uint, released: uint}) (current-block uint))
  (if (< current-block (get cliff-block schedule))
    u0
    (if (>= current-block (get end-block schedule))
      (get total schedule)
      (/ (* (get total schedule) (- current-block (get start-block schedule))) (- (get end-block schedule) (get start-block schedule)))
    )
  )
)

(define-read-only (get-releasable (schedule-id uint) (current-block uint))
  (match (map-get? schedules schedule-id)
    schedule (let ((vested (vested-amount schedule current-block)))
      (if (>= vested (get released schedule))
        (- vested (get released schedule))
        u0
      )
    )
    u0
  )
)

(define-private (check-principal (p principal))
  (ok (asserts! (is-eq p p) ERR-UNAUTHORIZED))
)

(define-private (check-uint (n uint))
  (ok (asserts! (>= n u0) ERR-UNAUTHORIZED))
)

(define-private (check-positive (n uint))
  (ok (asserts! (> n u0) ERR-INVALID-AMOUNT))
)

(define-private (can-release (beneficiary principal))
  (or
    (is-eq tx-sender beneficiary)
    (is-ok (is-dao-or-extension))
  )
)

(define-public (create-schedule (beneficiary principal) (total uint) (start-block uint) (cliff-block uint) (end-block uint))
  (let ((new-id (+ (var-get schedule-count) u1)))
    (try! (is-dao-or-extension))
    (try! (check-principal beneficiary))
    (try! (check-positive total))
    (try! (check-uint start-block))
    (try! (check-uint cliff-block))
    (try! (check-uint end-block))
    (asserts! (and (<= start-block cliff-block) (< cliff-block end-block) (>= start-block stacks-block-height)) ERR-INVALID-SCHEDULE)
    (map-set schedules new-id {
      beneficiary: beneficiary,
      total: total,
      start-block: start-block,
      cliff-block: cliff-block,
      end-block: end-block,
      released: u0
    })
    (var-set schedule-count new-id)
    (print {event: "vesting-created", schedule-id: new-id, beneficiary: beneficiary, total: total})
    (ok new-id)
  )
)

(define-public (release (schedule-id uint))
  (begin
    (try! (check-uint schedule-id))
    (match (map-get? schedules schedule-id)
      schedule (let ((releasable (get-releasable schedule-id stacks-block-height)))
        (asserts! (can-release (get beneficiary schedule)) ERR-UNAUTHORIZED)
        (asserts! (> releasable u0) ERR-NOTHING-TO-RELEASE)
        (try! (as-contract (contract-call? .treasury-v2 withdraw-stx releasable (get beneficiary schedule) none)))
        (map-set schedules schedule-id (merge schedule {released: (+ (get released schedule) releasable)}))
        (print {event: "vesting-released", schedule-id: schedule-id, beneficiary: (get beneficiary schedule), amount: releasable})
        (ok releasable)
      )
      ERR-SCHEDULE-NOT-FOUND
    )
  )
)

(define-public (callback (sender principal) (memo (buff 34)))
  (begin
    sender
    memo
    (ok true)
  )
)
