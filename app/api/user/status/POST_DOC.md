# User Order Status API Documentation

This endpoint allows clients to retrieve the status of a specific order for a user.

## Endpoint

`POST https://ourcanteennbackend.vercel.app/api/user/status`

## Description
Returns the status of a user's order. The status can be one of the following:
- `PENDING`: The order has been placed but not yet processed.
- `SCANNED`: The order has been scanned (e.g., at pickup or delivery).
- `SUCCESS`: The order has been successfully completed.

## Request

### Headers
- `Content-Type: application/json`

### Body Parameters
| Name     | Type   | Required | Description                |
|----------|--------|----------|----------------------------|
| orderId  | string | Yes      | The ID of the order        |
| userId   | string | Yes      | The ID of the user         |

#### Example
```json
{
  "orderId": "60d21b4667d0d8992e610c85",
  "userId": "user123"
}
```

## Responses

### 200 OK
Returns the status of the order.
```json
{
  "orderStatus": "PENDING"
}
```

### 400 Bad Request
Missing required parameters.
```json
{
  "error": "Order ID and User ID are required"
}
```

### 404 Not Found
Order not found for the given user.
```json
{
  "error": "Order not found"
}
```

### 500 Internal Server Error
Server error or unexpected failure.
```json
{
  "error": "Server error"
}
```

## CORS
This endpoint supports CORS with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`
