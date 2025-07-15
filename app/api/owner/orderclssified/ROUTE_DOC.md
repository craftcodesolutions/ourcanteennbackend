
# Order Classified API Documentation

## Root URL
`https://ourcanteennbackend.vercel.app`

This document describes the API endpoints and logic for the `/api/owner/orderclssified` route in the OurCanteen backend.

## Overview
This endpoint allows authenticated users (owners) to retrieve their orders grouped by collection date, along with statistics for each date. It also provides CORS support for frontend requests.

---

## Authentication
- **Type:** Bearer Token (JWT)
- **Header:** `Authorization: Bearer <token>`
- The token is verified using the `JWT_SECRET` environment variable.
- If the token is missing or invalid, the API returns an error with status 401 or 403.

---

## Endpoints

### GET `/api/owner/orderclssified`

**Description:**
Returns all orders for the authenticated owner, grouped by the collection date. Each group includes statistics for total, pending, and successful orders.

**Request Headers:**
- `Authorization: Bearer <token>`

**Response:**
- **200 OK**: JSON object where each key is a date (`YYYY-MM-DD`), and the value contains order stats and the list of orders for that date.
- **401 Unauthorized**: If the user is not found or not an owner.
- **403 Forbidden**: If the token is invalid or expired.
- **500 Internal Server Error**: For other errors.

**Response Example:**
```json
{
  "2025-07-15": {
    "stats": {
      "totalOrders": 3,
      "pendingOrders": 1,
      "successOrders": 2
    },
    "orders": [
      { /* order object */ },
      ...
    ]
  },
  ...
}
```

**Logic:**
- Authenticates the user via JWT.
- Checks if the user exists in the `users` collection.
- Fetches all orders from the `orders` collection where `userId` matches the authenticated user.
- Groups orders by the date part of `collectionTime`.
- For each date, calculates:
  - `totalOrders`: Total number of orders.
  - `pendingOrders`: Orders with status `PENDING`.
  - `successOrders`: Orders with status `SUCCESS`.

---

### OPTIONS `/api/owner/orderclssified`

**Description:**
CORS preflight support. Allows cross-origin requests from any origin.

**Response Headers:**
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

**Status:** 204 No Content

---

## Error Handling
- All errors are returned as JSON with an `error` field and appropriate HTTP status code.
- Errors are logged to the server console for debugging.

---

## Notes
- This endpoint is intended for owner users. Ensure the JWT token corresponds to a valid owner in the `users` collection.
- The grouping is based on the `collectionTime` field, which should be an ISO date string.

---