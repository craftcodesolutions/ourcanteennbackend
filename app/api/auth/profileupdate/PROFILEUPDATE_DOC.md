# Update User Profile API Documentation

**Endpoint:**  
`POST https://ourcanteennbackend.vercel.app/api/auth/profileupdate`

**Description:**  
Updates the profile information of an existing user. Requires all fields to be provided. Returns a new JWT token and the updated user data.

---

## Request Body

Send a JSON object with the following fields:

| Field        | Type   | Required | Description                |
|--------------|--------|----------|----------------------------|
| name         | string | Yes      | Full name of the user      |
| email        | string | Yes      | User's email address       |
| institute    | string | Yes      | Name of the institute      |
| studentId    | string | Yes      | Student ID                 |
| phoneNumber  | string | Yes      | User's phone number        |

### Example

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "institute": "ABC University",
  "studentId": "123456",
  "phoneNumber": "0123456789"
}
```

---

## Responses

### 200 OK

Profile updated successfully.

```json
{
  "token": "<new_jwt_token>",
  "user": {
    "id": "<user_id>",
    "name": "John Doe",
    "email": "john@example.com",
    "institute": "ABC University",
    "studentId": "123456",
    "phoneNumber": "0123456789",
    "isOwner": false
  }
}
```

### 400 Bad Request

Missing or invalid fields.

```json
{
  "error": "All fields are required"
}
```
_or_
```json
{
  "error": "Invalid email format"
}
```

### 404 Not Found

User not found.

```json
{
  "error": "User not found."
}
```

### 500 Server Error

Internal server error.

```json
{
  "error": "Server error"
}
```

---
