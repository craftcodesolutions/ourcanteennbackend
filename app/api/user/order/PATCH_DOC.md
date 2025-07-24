# PATCH /api/user/order

Cancel an order for the authenticated user.

## Endpoint

```
PATCH /api/user/order
```

## Headers

- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

## Request Body

```
{
  "orderId": "<order_id>"
}
```
- `orderId` (string, required): The ID of the order to cancel.

## Responses

### 200 OK
```
{
  "message": "Order cancelled",
  "order": { ...updated order object... }
}
```

### 400 Bad Request
```
{
  "error": "Order ID is required"
}
```

### 401 Unauthorized
```
{
  "error": "Access token required"
}
```

### 403 Forbidden
```
{
  "error": "Invalid or expired token"
}
```

### 404 Not Found
```
{
  "error": "Order not found or already cancelled"
}
```

### 500 Server Error
```
{
  "error": "Server error"
}
```

## Notes
- Only the user who created the order can cancel it.
- Orders that are already cancelled cannot be cancelled again.
- The order status will be set to `CANCELLED` and `updatedAt` will be updated.
