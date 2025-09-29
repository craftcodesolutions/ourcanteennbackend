# Grouped Loans API Documentation

## Endpoint: `/api/owner/loans-grouped`

### Description
This API endpoint returns loans grouped by customer/user for easier tracking and management. It aggregates loan data at the user level and provides comprehensive statistics for each customer.

### Authentication
- **Required**: JWT Token
- **Authorization**: Bearer token in the Authorization header
- **Access Level**: Owner or Staff with admin privileges

### HTTP Method
- **GET**: Retrieve grouped loans data

---

## Request Parameters

### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | ALL | Filter loans by status (`ACTIVE`, `PAID`, `CANCELLED`, `ALL`) |
| `page` | integer | No | 1 | Page number for pagination |
| `limit` | integer | No | 50 | Number of user groups per page |

### Example Request
```javascript
GET /api/owner/loans-grouped?status=ACTIVE&page=1&limit=20
Authorization: Bearer <JWT_TOKEN>
```

---

## Response Format

### Success Response (200)
```json
{
  "success": true,
  "groupedLoans": [
    {
      "userId": "user123",
      "customerInfo": {
        "name": "John Doe",
        "phoneNumber": "+8801234567890",
        "email": "john@example.com",
        "studentId": "STU001"
      },
      "loans": [
        {
          "_id": "loan_id_1",
          "loanApprover": "admin_id",
          "restaurantId": "rest_id",
          "userId": "user123",
          "orderId": "order_123",
          "customerInfo": { ... },
          "loanAmount": 150.00,
          "orderTotal": 200.00,
          "status": "ACTIVE",
          "approvedAt": "2024-01-15T10:30:00Z",
          "createdAt": "2024-01-15T10:30:00Z",
          "updatedAt": "2024-01-15T10:30:00Z",
          "description": "Food loan",
          "paymentMethod": "pending",
          "notes": "Customer requested loan for lunch"
        }
      ],
      "totalActive": 2,
      "totalActiveAmount": 300.00,
      "totalPaid": 5,
      "totalPaidAmount": 750.00,
      "totalCancelled": 1,
      "totalCancelledAmount": 50.00,
      "lastLoanDate": "2024-01-15T10:30:00Z"
    }
  ],
  "statistics": {
    "total": {
      "count": 150,
      "totalAmount": 15000.00
    },
    "active": {
      "count": 25,
      "totalAmount": 3750.00
    },
    "paid": {
      "count": 120,
      "totalAmount": 11000.00
    },
    "cancelled": {
      "count": 5,
      "totalAmount": 250.00
    }
  },
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalUsers": 45,
    "hasMore": true
  }
}
```

### Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "Access token required"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "error": "Unauthorized access"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## Data Structure Details

### GroupedLoan Object
| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Unique identifier for the customer |
| `customerInfo` | object | Customer's personal information |
| `loans` | array | Array of loan objects for this customer (sorted by creation date, newest first) |
| `totalActive` | number | Count of active loans for this customer |
| `totalActiveAmount` | number | Total amount of active loans |
| `totalPaid` | number | Count of paid loans |
| `totalPaidAmount` | number | Total amount of paid loans |
| `totalCancelled` | number | Count of cancelled loans |
| `totalCancelledAmount` | number | Total amount of cancelled loans |
| `lastLoanDate` | string | ISO date of the most recent loan |

### Sorting Logic
1. **Primary Sort**: Users with highest active loan amounts first
2. **Secondary Sort**: Users with most recent loan activity
3. **Loan Sort**: Within each user group, loans are sorted by creation date (newest first)

---

## Features

### Backend Processing
- ✅ **Aggregation Pipeline**: Uses MongoDB aggregation for efficient grouping
- ✅ **Real-time Statistics**: Calculates user-level and overall statistics
- ✅ **Optimized Sorting**: Prioritizes users with active loans and recent activity
- ✅ **Pagination Support**: Handles large datasets efficiently
- ✅ **Status Filtering**: Filter by loan status across all users

### Performance Benefits
- **Reduced Network Traffic**: Groups multiple loans into single user objects
- **Frontend Simplification**: No client-side grouping logic needed
- **Database Optimization**: Single query with aggregation pipeline
- **Memory Efficiency**: Pagination prevents large data loads

---

## Usage Examples

### Get All User Groups
```javascript
const response = await fetch('/api/owner/loans-grouped', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Get Users with Active Loans Only
```javascript
const response = await fetch('/api/owner/loans-grouped?status=ACTIVE', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Pagination
```javascript
const response = await fetch('/api/owner/loans-grouped?page=2&limit=10', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## Integration Notes

### Frontend Implementation
- Use this endpoint for the "By User" view mode
- The original `/api/owner/loans` endpoint can still be used for "List View"
- Each user group can be expanded/collapsed to show individual loans
- Statistics provide quick overview of each customer's loan history

### Error Handling
- Handle authentication errors by redirecting to login
- Display user-friendly messages for server errors
- Implement retry logic for network failures

### Caching Considerations
- Data changes when loans are updated, approved, or paid
- Consider implementing cache invalidation on loan status changes
- Pagination allows for partial data loading and updates
