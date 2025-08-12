# Frontend API Specification (Edge-Compatible)

This document specifies the HTTP APIs that the frontend consumes. It is implementation-ready for a backend built on Cloudflare Workers (or any Edge environment). All endpoints must avoid Node.js built-in modules and rely on Web APIs (Fetch, FormData, Web Crypto).

## Conventions

- Base URL: `/api`
- Auth: `Authorization: Bearer <JWT>` for protected endpoints
- Content-Type: `application/json` unless explicitly using file upload (`multipart/form-data`)
- Error format:
  ```json
  { "error": "string", "details": "optional string", "code": "optional string" }
  ```
- Rate limit headers (when applicable): `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- Edge compatibility: No Node built-ins (crypto, querystring, http, https). Use Web Crypto and Fetch APIs.
- Tokens: Verification/Reset tokens should be SHA-256 hashed, single-use, with expiry. JWT is the session token.
- Security headers: Ensure `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `X-XSS-Protection`, and `Permissions-Policy` are set.

---

## 1) Authentication

### 1.1 POST `/api/auth/signup`
- Purpose: Register a new account
- Auth: Public
- Request Body
  ```json
  {
    "name": "string",
    "email": "string",
    "password": "string",
    "confirmPassword": "string"
  }
  ```
- Responses
  - 200
    ```json
    { "id": "string", "email": "string", "name": "string", "emailVerified": "string|null" }
    ```
  - 400 / 409 / 500: Error
- Notes: Email normalized to lowercase; validate password strength; in dev email may be auto-verified.

### 1.2 POST `/api/auth/login`
- Purpose: Login with email/password
- Auth: Public
- Request Body
  ```json
  { "email": "string", "password": "string" }
  ```
- Responses
  - 200
    ```json
    { "token": "jwt-string", "user": { "id": "string", "email": "string", "name": "string" } }
    ```
  - 401 / 429 / 500: Error
- Notes: Rate-limited (e.g., 5/min). Include `X-RateLimit-*` headers.

### 1.3 POST `/api/auth/verify-email`
- Purpose: Issue a verification email
- Auth: Either requires current user or accepts an email
- Request Body (if not using session)
  ```json
  { "email": "string" }
  ```
- Responses
  - 200 `{ "ok": true }`
  - 400 / 401 / 500: Error
- Notes: Backend sends an email with a verification link containing a token.

### 1.4 GET `/api/auth/verify?token=...`
- Purpose: Consume a verification token
- Auth: Public (token-guarded)
- Responses
  - 200 `{ "verified": true }`
  - 400 / 410 / 500: Error
- Notes: Token is single-use; 410 for expired/used.

### 1.5 POST `/api/auth/forgot-password`
- Purpose: Initiate password reset email
- Auth: Public
- Request Body
  ```json
  { "email": "string" }
  ```
- Responses
  - 200 `{ "ok": true }` (do not disclose account existence)
  - 429 / 500: Error
- Notes: Rate-limited.

### 1.6 POST `/api/auth/reset-password`
- Purpose: Reset password with a valid token
- Auth: Public (token-guarded)
- Request Body
  ```json
  { "token": "string", "newPassword": "string", "confirmPassword": "string" }
  ```
- Responses
  - 200 `{ "ok": true }`
  - 400 / 410 / 500: Error

### 1.7 POST `/api/auth/delete-account`
- Purpose: Schedule account deletion and redact sensitive data
- Auth: Bearer token required
- Request Body
  ```json
  { "confirm": true }
  ```
- Responses
  - 200 `{ "scheduledAt": "ISO string" }`
  - 401 / 429 / 500: Error
- Notes: Rate-limited; immediate redaction of sensitive fields.

### 1.8 POST `/api/auth/request-export`
- Purpose: Request an export of user data via email
- Auth: Bearer token required
- Request Body
  ```json
  { "format": "json|csv" }
  ```
- Responses
  - 200 `{ "ok": true }`
  - 401 / 429 / 500: Error

---

## 2) User

### 2.1 GET `/api/user/profile`
- Purpose: Fetch the current user profile
- Auth: Bearer token required
- Responses
  - 200
    ```json
    { "id": "string", "email": "string", "name": "string|null", "createdAt": "ISO string", "emailVerified": "ISO string|null" }
    ```
  - 401 / 500: Error

### 2.2 PUT `/api/user/profile`
- Purpose: Update profile fields
- Auth: Bearer token required
- Request Body (all optional)
  ```json
  { "name": "string" }
  ```
- Responses
  - 200 `{ "id": "string", "email": "string", "name": "string", "updatedAt": "ISO string" }`
  - 400 / 401 / 500: Error

### 2.3 PUT `/api/user/password`
- Purpose: Change password
- Auth: Bearer token required
- Request Body
  ```json
  { "currentPassword": "string", "newPassword": "string", "confirmPassword": "string" }
  ```
- Responses
  - 200 `{ "ok": true }`
  - 400 / 401 / 500: Error

### 2.4 GET `/api/users/:id/created-at`
- Purpose: Fetch user creation date
- Auth: Bearer token required (or public if acceptable)
- Responses
  - 200 `{ "userId": "string", "createdAt": "ISO string" }`
  - 404 / 401 / 500: Error

---

## 3) ID Card

### 3.1 POST `/api/id-card`
- Purpose: Create an ID card record for the logged-in user
- Auth: Bearer token required
- Request Body (example)
  ```json
  { "displayName": "string", "attributes": { "key": "value" } }
  ```
- Responses
  - 201 `{ "id": "string", "displayName": "string", "attributes": { ... } }`
  - 400 / 401 / 500: Error

### 3.2 POST `/api/id-card/generate`
- Purpose: Generate/render an ID card
- Auth: Bearer token required
- Request Body
  ```json
  { "cardId": "string", "options": { "format": "png|webp", "width": 400, "height": 400 } }
  ```
- Responses (one of)
  - 200 `{ "token": "string", "expiresAt": "ISO string" }`
  - 200 `{ "url": "https://...", "publicId": "string" }`
  - 400 / 401 / 500: Error

### 3.3 GET `/api/id-card/verify/:token`
- Purpose: Verify an ID card token (e.g., via QR)
- Auth: Public (token-guarded)
- Responses
  - 200 `{ "valid": true, "cardId": "string", "owner": { "id": "string", "name": "string" } }`
  - 410 / 400 / 500: Error

### 3.4 GET `/api/id-card/:id/image`
- Purpose: Retrieve a rendered image or redirect to CDN
- Auth: Public or Bearer (per access rules)
- Query
  - `format=png|webp`, `w=number`, `h=number`
- Responses
  - 200: image bytes OR `{ "url": "https://..." }`
  - 404 / 401 / 500: Error

### 3.5 GET `/api/id-card`
- Purpose: List user’s ID cards
- Auth: Bearer token required
- Query
  - `page=number`, `pageSize=number`
- Responses
  - 200 `{ "items": [ ... ], "total": number, "page": number, "pageSize": number }`
  - 401 / 500: Error

---

## 4) Media / Uploads

### 4.1 POST `/api/cloudinary`
- Purpose: Upload an image (profile picture, etc.) via Cloudinary
- Auth: Bearer token required (optional, per policy)
- Content-Type: `multipart/form-data`
  - `file`: File
- Responses
  - 200 `{ "url": "https://...", "public_id": "string", "width": number, "height": number, "format": "string" }`
  - 400 / 500: Error
- Notes
  - Enforce file validation: size ≤ 5MB; types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`.

### 4.2 POST `/api/upload`
- Purpose: Alternate upload endpoint (same semantics as above)
- Auth: Bearer token required (optional)
- Content-Type: `multipart/form-data`
- Responses: same as 4.1

---

## 5) Maintenance / Admin

### 5.1 POST `/api/cron/cleanup`
- Purpose: Cleanup job (remove expired tokens, execute scheduled deletions)
- Auth: Restricted (internal secret header or env-gated)
- Headers
  - `X-Internal-Cron: <secret>` (or Cloudflare cron trigger)
- Responses
  - 200 `{ "ok": true, "stats": { ... } }`
  - 403 / 500: Error

---

## Cross-Cutting Requirements

- Edge compatibility
  - No Node.js built-ins. Use Web Crypto (`crypto.subtle.digest`, `crypto.getRandomValues`) and `fetch`/`FormData`.
  - Avoid Node-only SDKs (e.g., Cloudinary Node SDK) in edge routes.
- Rate limiting
  - Apply to sensitive routes (`/auth/login`, `/auth/forgot-password`, `/auth/delete-account`).
  - Return `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers.
- Security
  - Set `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `X-XSS-Protection`, `Permissions-Policy`.
  - Sanitize logs and error outputs; avoid leaking secrets.
- Tokens
  - Password reset and email verification tokens: SHA-256 hashed, short TTL, one-time use.
  - Session token: JWT including `sub`, `email`, `iat`, `exp`.
- Pagination pattern
  - Query params: `page`, `pageSize`; response returns `items`, `total`, `page`, `pageSize`.

---

## Optional: OpenAPI Generation

This spec can be converted to OpenAPI 3.1 for generators and clients. If needed, we can auto-generate an OpenAPI YAML file and mock server.
