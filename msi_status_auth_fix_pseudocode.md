# MSI Builder Status Auth Fix — Pseudocode

## Root cause

The dashboard shell receives a Manus/OAuth user and creates a fabricated local REST session with the literal access token `oauth-session`. The Go REST API correctly rejects this value because it is not a signed bearer token. The MSI page then requests `/api/v1/admin/msi-builder/status` and `/api/v1/admin/msi-builds` with that invalid token. The backend returns a plain-text 401 response, while the frontend JSON-only error parser replaces the useful reason with the generic message `Request failed`.

## Target behavior

1. Treat the local Go REST session and the Manus/OAuth session as separate authentication systems.
2. Do not synthesize a REST access token from an OAuth user object.
3. Let the local login response be the only source of `session.accessToken` for REST admin operations.
4. If a user is authenticated only through OAuth, show the local login screen instead of rendering REST admin controls with a fake token.
5. Preserve the real backend error body when the response is not JSON, so 401/403/404 diagnostics are visible.
6. Keep the existing local login flow, setup flow, tRPC data flow, and logout behavior intact.
7. Do not put tokens in logs, generated artifacts, or user-facing error text.

## Implementation sequence

1. Remove the App effect that maps `auth.user` to an `AuthSession` containing `oauth-session`.
2. Leave `auth.user` available only for existing tRPC-backed dashboard queries; do not use it as a REST credential.
3. Update the generic REST request helper to try JSON first and then read the response as text. Construct `ApiError` with the actual safe text when JSON parsing fails.
4. Keep the existing `LoginPage` callback as the source of a real local `AuthSession`.
5. Build the frontend and run TypeScript/Vitest checks.
6. Rebuild the local frontend image/container so the Windows browser receives the new bundle.
7. Re-login through the local Go API if the current browser has no real local REST session.
8. Verify `/api/v1/admin/msi-builder/status` returns 200 with a real bearer token, then verify `/api/v1/admin/msi-builds` and queue a fresh 2.4.5 build.

## Safety boundaries

Do not alter database rows, enrollment tokens, MSI artifacts, Windows Installer cache, or signing certificates as part of this auth fix. Only frontend source, generated frontend assets, and the local frontend container build are in scope.
