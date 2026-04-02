# Auth Service Integration

This document describes the current authentication implementation for the React web application in [`/Users/ralfe/Dev/Vectis/src/webapp`](/Users/ralfe/Dev/Vectis/src/webapp).

## Summary

Vectis uses the Life2 hosted browser handoff flow:

1. The webapp sends unauthenticated users to `https://auth.life-sqrd.com/signIn`.
2. The request includes the public `applicationId` and a Vectis callback URL.
3. The auth service authenticates the user and redirects back with a Life2 JWT in the `token` query parameter.
4. The webapp captures the token on `/auth/callback`, validates its payload shape and expiry, stores it in `localStorage`, and removes the token from the URL.
5. The webapp sends the token to the backend as `Authorization: Bearer <life2-jwt>`.
6. The backend validates the JWT signature, issuer, audience, and expiry before deriving tenant and user context from the claims.

## Frontend Implementation

Frontend auth code lives in:

- [`/Users/ralfe/Dev/Vectis/src/webapp/src/App.tsx`](/Users/ralfe/Dev/Vectis/src/webapp/src/App.tsx)
- [`/Users/ralfe/Dev/Vectis/src/webapp/src/auth.ts`](/Users/ralfe/Dev/Vectis/src/webapp/src/auth.ts)
- [`/Users/ralfe/Dev/Vectis/src/webapp/src/config.ts`](/Users/ralfe/Dev/Vectis/src/webapp/src/config.ts)

The callback route is path-based rather than hash-based:

```text
http://localhost:4174/auth/callback?token=<life2-jwt>
```

Stored browser state:

- `vectis.auth.token`

The webapp currently:

- accepts user id from `userid`, `userId`, or `sub`
- accepts tenant id from `accountId`, `accountid`, `tenantId`, or `tenantid`
- accepts display name from `displayName` or `name`
- requires `exp`

If the stored token is expired or malformed, it is removed and the user is sent back to the sign-in handoff screen.

## Runtime Configuration

The webapp reads optional runtime settings from `window.__VECTIS_CONFIG__`.

Supported fields:

- `apiBaseUrl`
- `authServiceSignInUrl`
- `authServiceApplicationId`
- `appBaseUrl`

Default values are defined in [`/Users/ralfe/Dev/Vectis/src/webapp/src/config.ts`](/Users/ralfe/Dev/Vectis/src/webapp/src/config.ts).

Typical local configuration:

```js
window.__VECTIS_CONFIG__ = {
  apiBaseUrl: "http://localhost:3000/api/v1",
  authServiceSignInUrl: "https://auth.life-sqrd.com/signIn",
  authServiceApplicationId: "vectis-web",
  appBaseUrl: "http://localhost:4174"
};
```

## Backend Validation

Backend request-context logic lives in:

- [`/Users/ralfe/Dev/Vectis/src/backend/src/modules/context/request-context.ts`](/Users/ralfe/Dev/Vectis/src/backend/src/modules/context/request-context.ts)
- [`/Users/ralfe/Dev/Vectis/src/backend/src/modules/context/actor-service.ts`](/Users/ralfe/Dev/Vectis/src/backend/src/modules/context/actor-service.ts)

For bearer-token requests, the backend now validates:

- signature when `LIFE2_AUTH_SHARED_SECRET` is configured
- `iss = life2.ralfe.me`
- `aud = account`
- `exp`

Required runtime secret:

- `LIFE2_AUTH_SHARED_SECRET`

If the shared secret is not present, the backend still checks issuer, audience, and expiry for any supplied bearer token, but production deployments should always provide the shared secret so HS256 signatures are verified locally.

After validation, the backend derives:

- tenant context from `accountId`, `accountid`, `tenantId`, or `tenantid`
- user context from `userid`, `userId`, or `sub`
- optional profile fields from `displayName`, `name`, and `email`

## Recommended Registration Values

For Vectis, the auth-service team should register:

- an `applicationId` for the webapp, for example `vectis-web`
- every allowed local, staging, and production callback URL
- any production branding metadata needed for the hosted sign-in screen

Example callback registrations:

- `http://localhost:4174/auth/callback`
- `https://app.vectis-sense.ai/auth/callback`

## Operational Notes

- The webapp removes the `token` query parameter from browser history after a successful callback.
- API requests rely on bearer auth only; no `x-tenant-id` or `x-user-id` headers are sent by the webapp.
- Backend tests cover verified bearer-token auth in [`/Users/ralfe/Dev/Vectis/src/backend/tests/app.test.ts`](/Users/ralfe/Dev/Vectis/src/backend/tests/app.test.ts).
- Frontend tests cover sign-in handoff, callback token capture, and CRUD flows in [`/Users/ralfe/Dev/Vectis/src/webapp/tests/app.test.tsx`](/Users/ralfe/Dev/Vectis/src/webapp/tests/app.test.tsx).
