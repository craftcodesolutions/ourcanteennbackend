# Topup API Documentation

**API Endpoint:**
```
POST https://ourcanteennbackend.vercel.app/api/owner/topup
```

---

## Description
This endpoint allows an owner or staff to top up a user's credit by userId, phone number, or email. It creates a topup record and updates the user's credit balance. The response includes all topup instances performed by the authenticated owner/staff.

---

## Authentication
- Requires a valid JWT token in the `Authorization` header.
- Only users with `isOwner: true` or `staff.isStaff: true` can access this endpoint.

**Header Example:**
```
Authorization: Bearer <your_jwt_token>
```

---

## Request Body
Send a JSON object with the following fields:

| Field    | Type     | Required | Description                                 |
|----------|----------|----------|---------------------------------------------|
| key      | string   | Yes      | The value to identify the user (ID, phone, or email) |
| type     | string   | Yes      | One of: `userId`, `phoneNumber`, `email`    |
| amount   | number   | Yes      | Amount to top up (will be added to credit)  |

**Example:**
```
{
  "key": "64b1234567890abcdef12345",
  "type": "userId",
  "amount": 100
}
```

Or by phone number:
```
{
  "key": "+8801234567890",
  "type": "phoneNumber",
  "amount": 50
}
```

Or by email:
```
{
  "key": "user@example.com",
  "type": "email",
  "amount": 25
}
```

---

## Response
- **Success (200):**

```
{
  "success": true,
  "allTopups": [
    {
      "_id": "...",
      "topupMaker": "...",
      "userId": "...",
      "amount": 100,
      "createdAt": "2025-07-17T12:34:56.789Z"
    },
    // ...more topup records
  ]
}
```

- **Error:**

```
{
  "error": "Error message"
}
```

---

## Error Codes
| Status | Message                        | Description                                 |
|--------|--------------------------------|---------------------------------------------|
| 400    | key, type, and amount are required | Missing required fields                     |
| 400    | Invalid type                   | type must be one of userId, phoneNumber, email |
| 401    | Access token required          | No JWT token provided                       |
| 401    | You are not Owner or Staff     | Authenticated user is not owner/staff        |
| 404    | User not found                 | No user matches the provided key/type        |
| 500    | Server error                   | Internal server error                        |

---

## CORS
Supports CORS preflight requests via OPTIONS method.

---

## Example Usage (JavaScript fetch)
```js
fetch('https://ourcanteennbackend.vercel.app/api/owner/topup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <your_jwt_token>'
  },
  body: JSON.stringify({
    key: '64b1234567890abcdef12345',
    type: 'userId',
    amount: 100
  })
})
  .then(res => res.json())
  .then(data => console.log(data));
```

---

## Notes
- The `amount` is added to the user's existing credit.
- All topup records returned are those performed by the authenticated owner/staff.
- Ensure your JWT token is valid and has the correct permissions.
