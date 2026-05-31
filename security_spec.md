# Security Specification - Gate Control System

## Data Invariants
1. A log entry must have a valid string ID, formatted timestamp matching the server time, non-empty userName, verified author/system identity, and valid action type.
2. A user document cannot have its passcode changed to be identical to the admin password.
3. Lock schedule must enforce formatted datetimes and is only written by administrators.
4. Blocked users lose active gate triggering permissions.
5. All IDs must be strictly verified for length (< 128 chars) and pattern (`^[a-zA-Z0-9_\-]+$`) to prevent Resource Poisoning or Injection attacks.

## The "Dirty Dozen" Payloads (Zero-Trust Validation)
We simulate 12 malicious payloads that must return `PERMISSION_DENIED`:

1. **Self-Escalation Attack**: A standard user attempts to write themselves a `role: "admin"` during user creation/registration.
2. **Ghost Log Poisoning**: An anonymous block entry with empty `details` and a false `userName` to cover tracks.
3. **Admin Password Overwrite**: Standard users trying to rewrite the `config/settings` document to gain full system control.
4. **Time Spoofing on Log**: Creating an activity log with a falsified timestamp in the future or past, rather than `request.time`.
5. **PII Blanket Scraping**: Non-admin reading all user phone/plot details in bulk.
6. **Bypassing Invariant IDs**: Registering a user with a 1.2MB garbage-character string ID to exhaust/pollute Firestore index storage structures.
7. **Negative Size Limits**: Attempting to set empty/negative string arrays or values.
8. **Malicious Gate State Hijack**: Standard or unauthenticated client directly updating `gateState/main` to bypass physical authorization locks.
9. **Bypassing Terminal Lock**: Editing a terminal-state "blocked" flag to "active" from an unauthorized client.
10. **State Key Poisoning**: Appending non-defined fields (e.g., `isSuperAdmin: true`) on user profile updates.
11. **Self-Approved PIN Reset**: Resolving an existing PIN reset request from standard user scope to bypass administrator confirmation.
12. **Zombie Subscriptions**: Overwriting another user's push subscription settings by falsifying subscription ownership.

## Firestore Security Rules Test Suite
We enforce and audit compliance before publishing production rules. All write operations must respect strict helper validators.
