# Security Spec

## Data Invariants
1. A user can only read/write their own `UserProfile`.
2. A user can only read/write `FoodItem` documents within their own `foodLogs` subcollection.
3. The `userId` in the `FoodItem` must match the parent document ID and `request.auth.uid`.

## Dirty Dozen Payloads
1. Create user profile for another user.
2. Read user profile of another user.
3. Update `targetCalories` manually with a string (wrong type).
4. Create food log in another user's subcollection.
5. Create food log with mismatched `userId` field.
6. Create food log without `calories` field.
7. Inject a 1.5MB string into the `name` field of a food log.
8. Modify `createdAt` of a food log.
9. Delete another user's food log.
10. Query food logs without specifying `userId == request.auth.uid`.
11. Send a ghost field `isAdmin: true` on user profile update.
12. Attempt to create user profile while unauthenticated.

## Test Runner
We will manually verify these invariants in the rules.
