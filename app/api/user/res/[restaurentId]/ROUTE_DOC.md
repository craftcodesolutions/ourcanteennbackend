# Get Restaurant Details and Categorized Menu

**Endpoint:**
`GET https://ourcanteennbackend.vercel.app/api/user/res/[restaurentId]`

## Description
Returns the full details of a single restaurant (by its ID) and all menu items for that restaurant, categorized by cuisine. Cuisine and institute names are resolved.

## Authentication
- Requires a valid JWT token in the `Authorization` header:
  
  `Authorization: Bearer <token>`

## Path Parameters

| Parameter      | Type   | Description                       |
|---------------|--------|-----------------------------------|
| restaurentId   | string | The ID of the restaurant to fetch |

## Response

- **200 OK**
  Returns a JSON object with the restaurant details and its menu items categorized by cuisine.

### Example Response

```json
{
  "restaurant": {
    "_id": "68666ac53fec3c3fd6d73d54",
    "name": "Magi khan",
    "location": "Rajshahi",
    "institute": "University of Rajshahi(RU)",
    "banner": "https://res.cloudinary.com/dmlsf2eac/image/upload/v1751542434/rmdtspwco06x8cchgzhn.jpg",
    "logo": "https://res.cloudinary.com/dmlsf2eac/image/upload/v1751542445/tnq9qllzsclapqili55b.jpg",
    "openingHours": {
      "sunday": { "open": true, "start": "10", "end": "16" },
      "monday": { "open": false, "start": "", "end": "" },
      "tuesday": { "open": false, "start": "", "end": "" },
      "wednesday": { "open": false, "start": "", "end": "" },
      "thursday": { "open": false, "start": "", "end": "" },
      "friday": { "open": false, "start": "", "end": "" },
      "saturday": { "open": false, "start": "", "end": "" }
    },
    "ownerId": "68666a393fec3c3fd6d73d53",
    "createdAt": "2025-07-03T11:34:29.155Z",
    "updatedAt": "2025-07-03T11:34:29.155Z",
    "cuisine": [
      { "_id": "686564f9be897d4481d58579", "name": "Biriyani" },
      { "_id": "686564f9be897d4481d5857a", "name": "Breakfast" },
      { "_id": "686564f9be897d4481d5857b", "name": "Rice" }
    ]
  },
  "menuByCuisine": {
    "686564f9be897d4481d5857a:Breakfast": [
      {
        "_id": "68666aff3fec3c3fd6d73d55",
        "name": "Meye",
        "description": "Sex",
        "price": 699,
        "image": "https://res.cloudinary.com/dmlsf2eac/image/upload/v1751542520/ixap3vlgk7gknnqmzu9j.jpg",
        "cuisine": { "_id": "686564f9be897d4481d5857a", "name": "Breakfast" },
        "available": true,
        "restaurantId": "68666ac53fec3c3fd6d73d54",
        "createdAt": "2025-07-03T11:35:27.573Z",
        "updatedAt": "2025-07-03T11:35:27.573Z"
      }
      // ...other menu items for Breakfast...
    ],
    "686564f9be897d4481d58579:Biriyani": [
      {
        "_id": "68666b303fec3c3fd6d73d56",
        "name": "Hola",
        "description": "Hola magi",
        "price": 75,
        "image": "https://res.cloudinary.com/dmlsf2eac/image/upload/v1751542573/utezp6bhqpf71o3czeq6.jpg",
        "cuisine": { "_id": "686564f9be897d4481d58579", "name": "Biriyani" },
        "available": true,
        "restaurantId": "68666ac53fec3c3fd6d73d54",
        "createdAt": "2025-07-03T11:36:16.978Z",
        "updatedAt": "2025-07-03T11:36:16.978Z"
      }
      // ...other menu items for Biriyani...
    ]
    // ...other cuisines...
  }
}
```

## Error Responses

- **401 Unauthorized**: Access token required or missing.
- **403 Forbidden**: Invalid or expired token.
- **404 Not Found**: User or restaurant not found.
- **400 Bad Request**: Restaurant ID not provided.
- **500 Server Error**: Unexpected server error.

## CORS
- Allowed methods: `GET, POST, OPTIONS`
- Allowed headers: `Content-Type, Authorization`
- Allowed origin: `*`
