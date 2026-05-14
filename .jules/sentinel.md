## 2024-05-14 - Replace weak pseudorandom identifier generation
**Vulnerability:** Found multiple instances of `Math.random().toString(36).substr(2, 9)` used to generate unique identifiers for database items, channels, and components.
**Learning:** This is a common but weak pattern for UUID generation that can lead to collisions in distributed environments or when dealing with numerous concurrent items. It is not cryptographically secure and should not be used as an alternative to proper UUIDv4 patterns.
**Prevention:** Always use `crypto.randomUUID()` when generating unique identifiers to ensure standard, cryptographically secure IDs that are virtually collision-free.
