# User Order API - POST /api/user/order

## Description
Create a new order for the authenticated user.

## Endpoint
`POST https://ourcanteennbackend.vercel.app/api/user/order`

## Headers
- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

## Request Body
- `cart`: Array of cart items (required, must not be empty)
  - Each item must include:
    - `_id`: Product ID (required)
    - `price`: Price per item (required)
    - `quantity`: Quantity (optional, defaults to 1)
- `collectionTime`: ISO string for when customer will collect the order (required)
- Example:
  ```json
  {
    "cart": [
      { "_id": "abc123", "price": 50, "quantity": 2 },
      { "_id": "def456", "price": 25 }
    ],
    "collectionTime": "2025-07-03T16:00:00.000Z"
  }
  ```

## Response
- **200 OK**
  - Returns the created order and its ID. The `items` array contains only product IDs.
  - Example:
    ```json
    {
      "orderId": "<orderId>",
      "order": {
        "userId": "<userId>",
        "restaurantId": "<restaurantId>",
        "items": cart,
        "total": 125,
        "status": "PENDING",
        "collectionTime": "2025-07-03T16:00:00.000Z",
        "userInfo": {
          "name": "John Doe",
          "email": "john@example.com",
          "phoneNumber": "+1234567890",
          "studentId": "STU001"
        },
        "createdAt": "2025-07-03T12:00:00.000Z",
        "updatedAt": "2025-07-03T12:00:00.000Z"
      }
    }
    ```
- **400 Bad Request**
  - Cart is empty or invalid, or a cart item is missing `_id` or `price`.
- **401 Unauthorized**
  - Missing or invalid access token.
- **403 Forbidden**
  - Invalid or expired token.
- **500 Server Error**
  - Internal server error.

## Example Request
```http
POST /api/user/order HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
  "cart": [
    { "_id": "abc123", "price": 50, "quantity": 2 },
    { "_id": "def456", "price": 25 }
  ],
  "collectionTime": "2025-07-03T16:00:00.000Z"
}
```

## Notes
- The order now includes `userInfo` with customer details (name, email, phone, studentId) for admin/staff convenience
- `collectionTime` is used for penalty calculations and pickup scheduling
- User information is automatically fetched from the authenticated user's profile
