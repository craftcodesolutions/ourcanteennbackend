# PUT https://ourcanteennbackend.vercel.app/api/owner/orderstatus

Update an order's status to `SUCCESS` for a specific user and order, by an authenticated owner.

## Request
- **Method:** PUT
- **Headers:**
  - `Authorization: Bearer <token>` (JWT token of the owner)
  - `Content-Type: application/json`
- **Body:**
```json
{
  "orderId": "<order_id>",
  "userId": "<user_id>"
}
```

## Success Response
- **Status:** 200 OK
- **Body:**
```json
{
  "status": "SUCCESS"
}
```

## Error Responses
- **401 Unauthorized:** If the user is not an owner or token is missing/invalid.
- **403 Forbidden:** If the order does not belong to the owner's restaurant.
- **404 Not Found:** If the restaurant or order is not found.
- **400 Bad Request:** If required fields are missing.
- **500 Server Error:** For unexpected errors.

## Description
This endpoint allows a restaurant owner to update the status of an order to `SUCCESS`. The owner must be authenticated, and the order must belong to their restaurant. The request must include both the `orderId` and `userId` in the body.

## Example Request
```
PUT /api/owner/orderstatus
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
  "status": "SUCCESS"
}
```
