# User Institute Restaurants & Menu Items API

**Endpoint:** `/api/user/resnmenu`

## Methods

### GET
Retrieve all restaurants from the authenticated user's institute and all menu items from those restaurants, with each menu item including its restaurant's name.

#### Request
- **Headers:**
  - `Authorization: Bearer <JWT_TOKEN>`

#### Response
- **Status:** `200 OK`
- **Content-Type:** `application/json`
- **Body:**

```
{
  "restaurants": [
    {
      "_id": "<restaurantId>",
      "name": "<restaurant name>",
      "location": "<location>",
      "institute": "<institute name>",
      "banner": "<banner url>",
      "logo": "<logo url>",
      "openingHours": { ... },
      "ownerId": "<ownerId>",
      "createdAt": "<ISO date>",
      "updatedAt": "<ISO date>",
      "cuisine": [<cuisine ids>]
    }
  ],
  "allmenuitems": [
    {
      "_id": "<menuItemId>",
      "name": "<menu item name>",
      "description": "<description>",
      "price": <number>,
      "image": "<image url>",
      "cuisine": "<cuisine id>",
      "available": <boolean>,
      "restaurantId": "<restaurantId>",
      "createdAt": "<ISO date>",
      "updatedAt": "<ISO date>",
      "restaurantName": "<restaurant name>"
    }
  ]
}
```

#### Example
```
{
    "restaurants": [
        {
            "_id": "68666ac53fec3c3fd6d73d54",
            "name": "Magi khan",
            "location": "Rajshahi",
            "institute": "University of Rajshahi(RU)",
            "banner": "https://res.cloudinary.com/dmlsf2eac/image/upload/v1751542434/rmdtspwco06x8cchgzhn.jpg",
            "logo": "https://res.cloudinary.com/dmlsf2eac/image/upload/v1751542445/tnq9qllzsclapqili55b.jpg",
            "openingHours": { ... },
            "ownerId": "68666a393fec3c3fd6d73d53",
            "createdAt": "2025-07-03T11:34:29.155Z",
            "updatedAt": "2025-07-03T11:34:29.155Z",
            "cuisine": [
                "686564f9be897d4481d58579",
                "686564f9be897d4481d5857a",
                "686564f9be897d4481d5857b"
            ]
        }
    ],
    "allmenuitems": [
        {
            "_id": "68666aff3fec3c3fd6d73d55",
            "name": "Meye",
            "description": "Sex",
            "price": 699,
            "image": "https://res.cloudinary.com/dmlsf2eac/image/upload/v1751542520/ixap3vlgk7gknnqmzu9j.jpg",
            "cuisine": "686564f9be897d4481d5857a",
            "available": true,
            "restaurantId": "68666ac53fec3c3fd6d73d54",
            "createdAt": "2025-07-03T11:35:27.573Z",
            "updatedAt": "2025-07-03T11:35:27.573Z",
            "restaurantName": "Magi khan"
        },
        {
            "_id": "68666b303fec3c3fd6d73d56",
            "name": "Hola",
            "description": "Hola magi",
            "price": 75,
            "image": "https://res.cloudinary.com/dmlsf2eac/image/upload/v1751542573/utezp6bhqpf71o3czeq6.jpg",
            "cuisine": "686564f9be897d4481d58579",
            "available": true,
            "restaurantId": "68666ac53fec3c3fd6d73d54",
            "createdAt": "2025-07-03T11:36:16.978Z",
            "updatedAt": "2025-07-03T11:36:16.978Z",
            "restaurantName": "Magi khan"
        }
    ]
}
```

#### Errors
- `401 Unauthorized`: Access token required or missing.
- `403 Forbidden`: Invalid or expired token.
- `404 Not Found`: User not found.
- `500 Internal Server Error`: Server error.

#### CORS
- `OPTIONS` method is supported for CORS preflight.

---

**Note:** Only authenticated users can access this endpoint. Menu items are filtered to only those belonging to restaurants in the user's institute, and each menu item includes its restaurant's name for convenience.
