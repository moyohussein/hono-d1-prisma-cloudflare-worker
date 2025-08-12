# Frontend Integration Guide

This document explains how to integrate your frontend with the leamsp-api backend.

Base URL
- All paths below are relative to /api
- Example full URL: http://<host>/api/auth/login

Conventions
- Authorization: Bearer <JWT>
- Responses use an envelope: { "success": boolean, "data"?: any, "error"?: any }
- Content-Type: application/json unless uploading files

Authentication
1) Register
POST /auth/register
Body
{
  "name": "Test User",
  "email": "user@example.com",
  "password": "Strong#Pass1",
  "password_confirmation": "Strong#Pass1"
}

2) Login
POST /auth/login
Body
{
  "email": "user@example.com",
  "password": "Strong#Pass1"
}
Response
{
  "success": true,
  "data": {
    "token": "<JWT>",
    "user": { "id": 1, "email": "user@example.com", "name": "Test User", "role": "USER" }
  }
}

Use the token in the Authorization header: Authorization: Bearer <JWT>

ID Card
Get latest active card (with recent logs)
GET /id-card
Headers
Authorization: Bearer <JWT>
Response (200)
{
  "success": true,
  "data": {
    "id": "<string>",
    "expiresAt": "<ISO or null>",
    "status": "active",
    "imageUrl": "/api/id-card/<id>/image",
    "user": {
      "id": "<string>",
      "name": "<string>",
      "email": "<string>",
      "image": null,
      "role": "USER" | "ADMIN"
    },
    "recentVerifications": [
      { "status": "success", "verifiedAt": "<ISO or null>", "ipAddress": null }
    ],
    "previewUrl": "/api/id-card/preview"
  }
}

Create an ID card record
POST /id-card
Headers
Authorization: Bearer <JWT>
Body
{
  "displayName": "My Card",
  "attributes": { "dept": "Engineering", "level": 3 }
}
Response (201)
{
  "success": true,
  "data": { "id": "<string>", "displayName": "My Card", "attributes": { ... } }
}

Generate/render an ID card (issue verification token or get URL)
POST /id-card/generate
Headers
Authorization: Bearer <JWT>
Body
{
  "cardId": "<id>",
  "options": { "format": "png" | "webp", "width": 800, "height": 480 }
}
Response (200) one of
- { "success": true, "data": { "token": "<string>", "expiresAt": "<ISO>" } }
- { "success": true, "data": { "url": "<https URL>", "publicId": "<cloudinary public id>" } }

Verify ID card token (public)
GET /id-card/verify/{token}
Response (200)
{ "success": true, "data": { "valid": true } }

Fetch card image (public)
GET /id-card/{id}/image
Returns the image (image/png or image/webp) or 404 if unavailable.

Media Uploads (Cloudinary)
Get Cloudinary client config
GET /cloudinary/config
Response (200)
{
  "success": true,
  "data": {
    "cloudName": "<string>",
    "uploadPreset": "<string>",
    "folder": "<string>"
  }
}

Proxy upload via backend (optional)
POST /cloudinary
Headers
Authorization: Bearer <JWT>
Content-Type: multipart/form-data
Fields
- file: binary
- folder: optional override
Response (200)
{
  "success": true,
  "data": { "url": "<https URL>", "publicId": "<string>", "width": 800, "height": 480 }
}

Example TypeScript Helpers
export async function apiFetch<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`/api${path}`,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    }
  );
  const json = await res.json();
  if (!res.ok || json?.success === false) throw json?.error ?? json;
  return json.data as T;
}

// Usage examples
// Login
const { token, user } = await apiFetch<{ token: string; user: { id: number; name: string } }>(
  '/auth/login',
  { method: 'POST', body: JSON.stringify({ email: 'user@example.com', password: 'Strong#Pass1' }) }
);

// Get latest ID card
const latestCard = await apiFetch<{
  id: string;
  expiresAt: string | null;
  status: 'active';
  imageUrl: string;
  user: { id: string; name: string; email: string; image: string | null; role: 'USER' | 'ADMIN' };
  recentVerifications: { status: 'success'; verifiedAt: string | null; ipAddress: string | null }[];
  previewUrl: string;
}>('/id-card', { method: 'GET' }, token);

// Create an ID card
const created = await apiFetch<{ id: string; displayName: string; attributes: Record<string, unknown> }>(
  '/id-card',
  { method: 'POST', body: JSON.stringify({ displayName: 'My Card', attributes: { dept: 'Engineering' } }) },
  token
);

// Generate token for verification
const gen = await apiFetch<{ token: string; expiresAt: string } | { url: string; publicId: string }>(
  '/id-card/generate',
  { method: 'POST', body: JSON.stringify({ cardId: created.id, options: { format: 'png' } }) },
  token
);

Error Handling
- All validation errors return { success: false, error } with 4xx status
- On server errors, you may receive { success: false, error: "Internal Server Error" }

Security Notes
- Always store JWT securely (e.g., httpOnly cookies or secure storage)
- Do not expose Cloudinary API secrets in the frontend; use GET /cloudinary/config

