# Restaurant Menu API Documentation

This API route allows authenticated restaurant owners to manage their restaurant's menu items. All requests require a valid JWT token in the `Authorization` header.

## Base Path

`https://ourcanteennbackend.vercel.app/api/owner/resmenu`

---

## Authentication
- All endpoints require a Bearer token in the `Authorization` header.
- Example: `Authorization: Bearer <token>`

---

## Endpoints

### GET `/api/owner/resmenu`
**Description:**
Returns all menu items for the authenticated owner's restaurant.

**Response:**
- `200 OK`: Array of menu item objects.
- `404 Not Found`: If the restaurant is not found.
- `401/403`: If authentication fails.

**Example Response:**
```json
[
  {
    "_id": "...",
    "name": "Burger",
    "description": "Tasty beef burger",
    "price": 120,
    "image": "url",
    "cuisine": "Fast Food",
    "available": true,
    "restaurantId": "...",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

---

### POST `/api/owner/resmenu`
**Description:**
Add a new menu item to the authenticated owner's restaurant.

**Request Body:**
```json
{
  "name": "Burger",
  "description": "Tasty beef burger",
  "price": 120,
  "image": "url",
  "cuisine": "Fast Food",
  "available": true
}
```
- `name` (string, required)
- `price` (number, required)
- `description`, `image`, `cuisine`, `available` (optional)

**Response:**
- `201 Created`: Array of all menu items for the restaurant (including the newly added item).
- `400 Bad Request`: If required fields are missing.
- `404 Not Found`: If the restaurant is not found.

**Example Response:**
```json
[
  { "_id": "...", "name": "Burger", ... },
  { "_id": "...", "name": "Pizza", ... }
]
```

---

### PUT `/api/owner/resmenu`
**Description:**
Edit an existing menu item for the authenticated owner's restaurant.

**Request Body:**
```json
{
  "_id": "menuItemId",
  "name": "Updated Burger",
  "description": "Updated description",
  "price": 130,
  "image": "new-url",
  "cuisine": "Fast Food",
  "available": false
}
```
- `_id` (string, required): The menu item's MongoDB ObjectId.
- Other fields are optional and will be updated if provided.

**Response:**
- `200 OK`: Array of all menu items for the restaurant (including the updated item).
- `400 Bad Request`: If `_id` is missing.
- `404 Not Found`: If the restaurant or menu item is not found.

**Example Response:**
```json
[
  { "_id": "...", "name": "Updated Burger", ... },
  { "_id": "...", "name": "Pizza", ... }
]
```

---

## Error Responses
- All errors return a JSON object: `{ "error": "Error message" }`
- Status codes: `400`, `401`, `403`, `404`, `500`

---

## CORS
- `OPTIONS` method is supported for CORS preflight.
- Allows: `GET, POST, OPTIONS`
- Headers: `Content-Type, Authorization`

---

## Notes
- All actions are scoped to the authenticated owner's restaurant.
- Menu items are stored in the `menuitems` collection, linked by `restaurantId`.
- POST and PUT always return the full menu list for the restaurant.
