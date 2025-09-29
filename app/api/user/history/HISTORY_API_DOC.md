# User History API Documentation

## Overview
This API endpoint allows users to retrieve their loan and topup history with filtering and pagination capabilities.

## Endpoint
`GET /api/user/history`

## Authentication
- **Required**: JWT token in Authorization header
- **Format**: `Authorization: Bearer <token>`

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | 'ALL' | Filter by type: 'ALL', 'LOANS', 'TOPUPS' |
| `status` | string | '' | For loans: 'ACTIVE', 'PAID', 'CANCELLED' |
| `page` | number | 1 | Page number for pagination |
| `limit` | number | 20 | Number of items per page |

## Response Format

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "loans": [
      {
        "_id": "loan_id",
        "userId": "user_id",
        "restaurantId": "restaurant_id",
        "restaurantName": "Restaurant Name",
        "orderId": "order_id",
        "loanAmount": 150.00,
        "orderTotal": 200.00,
        "status": "ACTIVE",
        "loanApprover": "approver_id",
        "customerInfo": {
          "name": "Customer Name",
          "phoneNumber": "+1234567890",
          "email": "customer@email.com",
          "studentId": "STU123"
        },
        "description": "Loan description",
        "paymentMethod": "CASH",
        "approvedAt": "2024-01-01T12:00:00Z",
        "createdAt": "2024-01-01T11:00:00Z",
        "updatedAt": "2024-01-01T12:00:00Z",
        "notes": "Optional notes",
        "paidAt": null,
        "cancelledAt": null
      }
    ],
    "topups": [
      {
        "_id": "topup_id",
        "userId": "user_id",
        "amount": 100.00,
        "status": "approved",
        "approvedBy": "admin_id",
        "createdAt": "2024-01-01T10:00:00Z",
        "updatedAt": "2024-01-01T11:00:00Z",
        "approvedAt": "2024-01-01T11:00:00Z",
        "notes": "Topup notes"
      }
    ],
    "statistics": {
      "loans": {
        "active": { "count": 2, "totalAmount": 300.00 },
        "paid": { "count": 5, "totalAmount": 750.00 },
        "cancelled": { "count": 1, "totalAmount": 50.00 },
        "total": { "count": 8, "totalAmount": 1100.00 }
      },
      "topups": {
        "pending": { "count": 1, "totalAmount": 100.00 },
        "approved": { "count": 10, "totalAmount": 1500.00 },
        "rejected": { "count": 0, "totalAmount": 0.00 },
        "total": { "count": 11, "totalAmount": 1600.00 }
      }
    },
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 50,
      "limit": 20,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "Invalid or missing token"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

## Usage Examples

### Get all history (loans and topups)
```
GET /api/user/history
```

### Get only loans
```
GET /api/user/history?type=LOANS
```

### Get only active loans
```
GET /api/user/history?type=LOANS&status=ACTIVE
```

### Get topups with pagination
```
GET /api/user/history?type=TOPUPS&page=2&limit=10
```

## Database Collections Used
- `loans` - For loan history
- `topups` - For topup history  
- `restaurants` - For restaurant information in loans

## Notes
- Results are sorted by creation date (newest first)
- When type is 'ALL', both loans and topups are returned with equal weight
- Statistics are calculated across all records regardless of pagination
- Restaurant names are populated for loans to provide better context
