# User Order API - GET /api/user/order

## Description
Retrieve all orders for the authenticated user.

## Endpoint
`GET /api/user/order`

## Headers
- `Authorization: Bearer <token>` (required)

## Response
- **200 OK**
  - Returns a JSON object with an array of orders for the authenticated user.
  - Example:
    ```json
    {
      "orders": [
        {
          "_id": "<orderId>",
          "userId": "<userId>",
          "items": ["<productId1>", "<productId2>", ...],
          "total": 100,
          "status": "PENDING",
          "createdAt": "2025-07-03T12:00:00.000Z",
          "updatedAt": "2025-07-03T12:00:00.000Z"
        },
        ...
      ]
    }
    ```
- **401 Unauthorized**
  - Missing or invalid access token.
- **403 Forbidden**
  - Invalid or expired token.
- **500 Server Error**
  - Internal server error.

## Example Request
```http
GET /api/user/order HTTP/1.1
Authorization: Bearer <token>
```
