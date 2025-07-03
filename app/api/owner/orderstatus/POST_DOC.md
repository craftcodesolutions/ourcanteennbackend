# POST https://ourcanteennbackend.vercel.app/api/owner/orderstatus

Update the status of an order to `SCANNED` for a restaurant owner. This endpoint is intended for authenticated restaurant owners to mark an order as scanned (e.g., after verifying a QR code or similar process).

## Authentication
- Requires a valid JWT access token in the `Authorization` header (format: `Bearer <token>`).
- The user must be an owner (`isOwner: true`).

## Request Body
```
{
  "orderId": "string",   // The ID of the order to update (MongoDB ObjectId as string)
  "userId": "string"      // The ID of the user who placed the order (MongoDB ObjectId as string)
}
```

## Success Response
- **Status:** 200 OK
- **Body:**
```
{
  "order": {
    "_id": "...",
    "userId": "...",
    "restaurantId": "...",
    ...,
    "status": "SCANNED"
  }
}
```

## Error Responses
- **401 Unauthorized**: If the user is not authenticated or not an owner.
  - `{ "error": "Access token required" }`
  - `{ "error": "You are not Owner" }`
- **403 Forbidden**: If the order does not belong to the owner's restaurant or the token is invalid.
  - `{ "error": "Order does not belong to your restaurant" }`
  - `{ "error": "Invalid or expired token" }`
- **404 Not Found**: If the restaurant or order is not found.
  - `{ "error": "Restaurant not found" }`
  - `{ "error": "Order not found" }`
- **400 Bad Request**: If required fields are missing.
  - `{ "error": "Order ID and User ID are required" }`
- **500 Internal Server Error**: For unexpected errors.
  - `{ "error": "Server error" }`

## Example Request
```
POST /api/owner/orderstatus
Authorization: Bearer <token>
Content-Type: application/json

{
  "orderId": "60f7c2b8e1d2c8a1b4e8d123",
  "userId": "60f7c2b8e1d2c8a1b4e8d456"
}
```

## Example Success Response
```
{
  "order": {
    "_id": "60f7c2b8e1d2c8a1b4e8d123",
    "userId": "60f7c2b8e1d2c8a1b4e8d456",
    "restaurantId": "60f7c2b8e1d2c8a1b4e8d789",
    ...,
    "status": "SCANNED"
  }
}
```
