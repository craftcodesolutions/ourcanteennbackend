
# Order Classified API Documentation

## Base URL
`https://ourcanteennbackend.vercel.app`

---

## Endpoint


### GET `/api/owner/orderclssified`

Retrieves all orders for the authenticated owner's restaurant, grouped by collection date. Each group includes order statistics and a summary of items ordered for that date. Only authenticated owners can access this endpoint. Orders from other restaurants are not included.

#### Authentication
- **Type:** Bearer Token (JWT)
- **Header:** `Authorization: Bearer <token>`
- The token is verified using the `JWT_SECRET` environment variable.
- If the token is missing or invalid, the API returns an error with status 401 or 403.

#### Request Headers
- `Authorization: Bearer <token>`

#### Response
- **200 OK**: JSON object where each key is a date (`YYYY-MM-DD`), and the value contains:
  - `stats`: Object with `totalOrders`, `pendingOrders`, `successOrders` for that date.
  - `orders`: Array of order objects for that date (only for the authenticated owner's restaurant).
  - `itemsSummary`: Array summarizing the total quantity of each item ordered on that date. Each item includes `itemId`, `name`, `image`, and `quantity`.
- **401 Unauthorized**: If the user is not found or not an owner.
- **403 Forbidden**: If the token is invalid or expired.
- **500 Internal Server Error**: For other errors.

#### Example Response
```json
{
  "2025-07-15": {
    "stats": {
      "totalOrders": 3,
      "pendingOrders": 1,
      "successOrders": 2
    },
    "orders": [
      { /* order object */ },
      ...
    ],
    "itemsSummary": [
      {
        "itemId": "abc123",
        "name": "Burger",
        "image": "https://example.com/burger.jpg",
        "quantity": 5
      },
      {
        "itemId": "def456",
        "name": "Fries",
        "image": "https://example.com/fries.jpg",
        "quantity": 2
      }
    ]
  },
  ...
}
```

#### Logic
- Authenticates the user via JWT.
- Checks if the user exists in the `users` collection.
- Finds the restaurant owned by the authenticated user in the `restaurants` collection.
- Fetches all orders from the `orders` collection for that restaurant (filtered by `restaurantId`).
- Groups orders by the date part of `collectionTime`.
- For each date, calculates:
  - `totalOrders`: Total number of orders for that date.
  - `pendingOrders`: Orders with status `PENDING`.
  - `successOrders`: Orders with status `SUCCESS`.
  - `itemsSummary`: Array of items with total quantity per item for that date. Each item includes `itemId`, `name`, `image`, and `quantity`.

---

### OPTIONS `/api/owner/orderclssified`

Handles CORS preflight requests. Allows cross-origin requests from any origin.

#### Response Headers
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

**Status:** 204 No Content

---

## Error Handling
- All errors are returned as JSON with an `error` field and appropriate HTTP status code.
- Errors are logged to the server console for debugging.

---

## Additional Notes
- This endpoint is intended for owner users. Ensure the JWT token corresponds to a valid owner in the `users` collection.
- Only orders for the authenticated owner's restaurant are included (filtered by `restaurantId`).
- Orders are grouped by the `collectionTime` field, which should be an ISO date string.
- The response includes an `itemsSummary` array for each date, summarizing the total quantity of each item ordered on that date. Each item includes `itemId`, `name`, `image`, and `quantity`.