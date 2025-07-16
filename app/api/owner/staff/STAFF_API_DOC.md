# Owner Staff API Documentation

This API allows restaurant owners to manage their staff by adding staff members and retrieving the list of all staff for their restaurant.

## Authentication
All requests require a valid JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

root url - https://ourcanteennbackend.vercel.app/

---

## POST `/api/owner/staff`
Add a staff member to the owner's restaurant by email.

### Request
- **Headers:**
  - `Authorization: Bearer <token>`
- **Body (JSON):**
  ```json
  {
    "email": "staff@s.s"
  }
  ```

### Behavior
- Finds the user by email.
- Adds the user's `userId` to the restaurant's `staff` array.
- Updates the user document to set `staff.isStaff: true` and `staff.access: 'A'`.
- Returns the full staff list for the restaurant.

### Response
- **Status:** `200 OK`
- **Body:**
  ```json
  {
    "staff": [
      {
        "_id": "...",
        "name": "Staff",
        "email": "staff@s.s",
        ...
      }
      // more staff objects
    ]
  }
  ```
- **Errors:**
  - `400`: Staff email is required
  - `404`: Staff user not found or restaurant not found for owner
  - `401/403/500`: Auth or server errors

---

## GET `/api/owner/staff`
Get all staff members for the authenticated owner's restaurant.

### Request
- **Headers:**
  - `Authorization: Bearer <token>`

### Behavior
- Finds the restaurant by ownerId.
- Returns all staff user documents whose IDs are in the restaurant's `staff` array.

### Response
- **Status:** `200 OK`
- **Body:**
  ```json
  {
    "staff": [
      {
        "_id": "...",
        "name": "Staff",
        "email": "staff@s.s",
        ...
      }
      // more staff objects
    ]
  }
  ```
- **Errors:**
  - `404`: Restaurant not found for owner
  - `401/403/500`: Auth or server errors

---

## Example Staff Array in Restaurant Document
```json
"staff": [
  { "sid": "687658b6cdd738da3d1ea55e" },
  { "sid": "687658b6cdd738da3d1ea55f" }
]
```

## Example User Document for Staff
```json
{
  "_id": "687658b6cdd738da3d1ea55e",
  "name": "Staff",
  "email": "staff@s.s",
  "staff": {
    "isStaff": true,
    "access": "A"
  },
  ...
}
```

---

## CORS
Both endpoints support CORS via the `OPTIONS` method.
