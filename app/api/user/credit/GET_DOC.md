# User Credit API Documentation

This document describes the API endpoints for managing and retrieving user credit information in the OurCanteen backend.

## Endpoint

`https://ourcanteennbackend.vercel.app/api/user/credit`

---

## Authentication
All endpoints require a valid JWT access token in the `Authorization` header:

```
Authorization: Bearer <token>
```

---

## GET: Retrieve User Credit

**Description:**
Returns the current credit balance for the authenticated user.

**Request:**
- Method: `GET`
- Headers:
  - `Authorization: Bearer <token>`

**Response:**
- Success: `200 OK`
  - JSON body:
    ```json
    {
      "credit": <number>
    }
    ```
  - If the user has no credit, `credit` will be `0`.
- Error: Returns appropriate status codes and error messages for authentication or server errors.

**Example Success Response:**
```
GET /api/user/credit
Authorization: Bearer eyJhbGciOi...

Response:
{
  "credit": 150
}
```

---


## Error Handling
- `401 Unauthorized`: Access token required or missing.
- `403 Forbidden`: Invalid or expired token.
- `500 Internal Server Error`: Server-side error.

---

## Notes
- The endpoint uses MongoDB to fetch the user's credit based on the user ID from the JWT.
- If the user is not found or has no credit, the response will default to `0`.