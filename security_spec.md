# Security Specification — D-Likon Model Academy Cloud Sync

## 1. Data Invariants
1. **Master Gate & Ownership**: Every school resource (`students`, `securityLogs`, `staffAccounts`, `staffAttendance`) belongs to a valid `/schools/{schoolId}` parent document with a verified `ownerUid` or bootstrapped Admin (`chorcho2utkosho@gmail.com` with `email_verified == true` or `/admins/{uid}`).
2. **PII Protection**: Student phone numbers (`guardianPhone`) and PINs (`guardianPin`) live inside `/schools/{schoolId}/students/{studentId}` and are strictly readable only by Admin, the school `ownerUid`, or the student's bound `guardianUid`. Blanket signed-in reads are strictly forbidden.
3. **Gatepass & Guardian Response Integrity**: Gatepass scan logs (`securityLogs/{logId}`) can only be created by an Admin or the `ownerUid` of the parent school document (`exists()` verified). Guardians matching `existing().guardianUid == request.auth.uid` can ONLY update `['guardianAcknowledged', 'guardianResponse', 'acknowledgedAt', 'acknowledgedBy', 'updatedAt']` while keeping `studentId`, `ownerUid`, `action`, and `createdAt` immutable.
4. **Server Timestamp Enforcement**: Every document `create` enforces `incoming().createdAt == request.time && incoming().updatedAt == request.time`, and every `update` enforces `incoming().updatedAt == request.time` and immutable `createdAt` and `ownerUid`.
5. **Path & Size Guards**: Every document ID path parameter is validated with `isValidId()`, every string has explicit `.size() <= MAX` bounds, and every schema checks `keys().hasAll(...) && keys().hasOnly(...)`.

## 2. "Dirty Dozen" Attack Payloads (All Must Fail with PERMISSION_DENIED)
1. **Unauthenticated Read**: Read `/schools/dlikon_academy/students/std1` with `request.auth == null` -> DENIED.
2. **Unverified Email Spoof**: Write as `email: "chorcho2utkosho@gmail.com"` with `email_verified: false` -> DENIED.
3. **Ghost Field Injection (Shadow Update)**: Create `securityLogs/log1` with extra `isAdminOverride: true` -> DENIED (`keys().hasOnly` rejects).
4. **Blanket List Scraping**: `list` `/schools/dlikon_academy/students` as random UID `hacker_uid` where `resource.data.ownerUid != 'hacker_uid'` and `resource.data.guardianUid != 'hacker_uid'` -> DENIED.
5. **ID Poisoning (1.5KB Document ID)**: Create `/schools/dlikon_academy/securityLogs/<1500 chars>` -> DENIED (`isValidId` rejects `size > 128`).
6. **Value Poisoning**: Update `securityLogs/log1` `guardianResponse` with a 50KB string or boolean -> DENIED (`isValidSecurityLog` checks `is string && size <= 300`).
7. **Privilege Escalation (Self Admin)**: Non-admin writes `/admins/hacker_uid` -> DENIED.
8. **Ownership Hijack**: Update `students/std1` changing `ownerUid` to `hacker_uid` -> DENIED (`incoming().ownerUid == existing().ownerUid`).
9. **Client Timestamp Spoofing**: Create `securityLogs/log1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> DENIED.
10. **Immortal CreatedAt Mutation**: Update `securityLogs/log1` changing `createdAt` -> DENIED.
11. **Guardian Tampering With Action/Status**: Guardian updates `securityLogs/log1` with `action: "exit"` or `status: "flagged"` -> DENIED (`affectedKeys().hasOnly` allows only acknowledgement keys).
12. **Orphan Subcollection Create**: Create `/schools/nonexistent_school/securityLogs/log1` -> DENIED (`exists(/databases/$(database)/documents/schools/$(schoolId))` fails).
