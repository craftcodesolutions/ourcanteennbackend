# Loans Management API Documentation

**API Endpoint:**
```
GET/PUT https://ourcanteennbackend.vercel.app/api/owner/loans
```

---

## Description
This endpoint allows restaurant owners and staff to manage loans issued to customers. It provides functionality to fetch loans with filtering and pagination, update loan status (mark as paid or cancelled), and get comprehensive loan statistics.

---

## Authentication
- Requires a valid JWT token in the `Authorization` header
- Only users with `isOwner: true` or `staff.isStaff: true` can access this endpoint
- User must be associated with a restaurant (either as owner or staff)

**Header Example:**
```
Authorization: Bearer <your_jwt_token>
```

---

## GET Method - Fetch Loans

### Query Parameters

| Parameter | Type   | Required | Default | Description                                    |
|-----------|--------|----------|---------|------------------------------------------------|
| status    | string | No       | ''      | Filter by loan status: 'ACTIVE', 'PAID', 'CANCELLED', or empty for all |
| page      | number | No       | 1       | Page number for pagination                     |
| limit     | number | No       | 20      | Number of loans per page                       |

**Example Request:**
```
GET /api/owner/loans?status=ACTIVE&page=1&limit=20
```

### Response

#### Success (200)
```json
{
  "success": true,
  "loans": [
    {
      "_id": "64b1234567890abcdef12345",
      "loanApprover": "64b1234567890abcdef67890",
      "restaurantId": "64b1234567890abcdef11111",
      "userId": "64b1234567890abcdef22222",
      "orderId": "64b1234567890abcdef33333",
      "customerInfo": {
        "name": "John Doe",
        "phoneNumber": "+1234567890",
        "email": "john@example.com",
        "studentId": "ST12345"
      },
      "loanAmount": 150,
      "orderTotal": 150,
      "status": "ACTIVE",
      "approvedAt": "2024-01-15T10:30:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "description": "Loan for Order #DEF33333",
      "paymentMethod": "LOAN"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 95,
    "hasMore": true
  },
  "statistics": {
    "total": { "count": 95, "totalAmount": 14250 },
    "active": { "count": 25, "totalAmount": 3750 },
    "paid": { "count": 60, "totalAmount": 9000 },
    "cancelled": { "count": 10, "totalAmount": 1500 }
  }
}
```

---

## PUT Method - Update Loan Status

### Request Body

| Field  | Type   | Required | Description                                    |
|--------|--------|----------|------------------------------------------------|
| loanId | string | Yes      | The ID of the loan to update                   |
| status | string | Yes      | New status: 'PAID' or 'CANCELLED'             |
| notes  | string | No       | Optional notes about the status change         |

**Example Request:**
```json
{
  "loanId": "64b1234567890abcdef12345",
  "status": "PAID",
  "notes": "Customer paid in cash at restaurant"
}
```

### Response

#### Success (200)
```json
{
  "success": true,
  "message": "Loan marked as paid",
  "loan": {
    "_id": "64b1234567890abcdef12345",
    "status": "PAID",
    "paidAt": "2024-01-15T14:30:00.000Z",
    "notes": "Customer paid in cash at restaurant",
    "updatedAt": "2024-01-15T14:30:00.000Z",
    // ... other loan fields
  }
}
```

---

## Business Logic

### GET Method Logic
1. **Authentication**: Verifies user is owner or staff of a restaurant
2. **Filtering**: Applies status filter if provided
3. **Pagination**: Implements page-based pagination with configurable limit
4. **Statistics**: Calculates comprehensive loan statistics across all statuses
5. **Sorting**: Returns loans sorted by creation date (newest first)

### PUT Method Logic
1. **Authentication**: Verifies user permissions
2. **Validation**: Ensures loan exists and belongs to user's restaurant
3. **Status Validation**: Only allows updates to PAID or CANCELLED from ACTIVE status
4. **Transaction Processing**:
   - Updates loan record with new status and timestamp
   - If marked as PAID: Adds loan amount back to customer's credit
   - If marked as CANCELLED: No credit adjustment
5. **Notes**: Optional notes are stored with the status change

---

## Error Responses

### 400 - Bad Request
```json
{
  "success": false,
  "error": "Loan ID and status are required"
}
```

### 401 - Unauthorized
```json
{
  "success": false,
  "error": "You are not Owner or Staff"
}
```

### 404 - Not Found
```json
{
  "success": false,
  "error": "Loan not found"
}
```

### 500 - Server Error
```json
{
  "success": false,
  "error": "Failed to update loan"
}
```

---

## Database Schema

### Loans Collection Structure
```javascript
{
  "_id": ObjectId,
  "loanApprover": "string",        // User ID who approved the loan
  "restaurantId": "string",        // Restaurant this loan belongs to
  "userId": "string",              // Customer who received the loan
  "orderId": "string",             // Associated order ID
  "customerInfo": {
    "name": "string",
    "phoneNumber": "string",
    "email": "string",
    "studentId": "string"          // Optional
  },
  "loanAmount": Number,            // Loan amount
  "orderTotal": Number,            // Original order total
  "status": "string",              // 'ACTIVE', 'PAID', 'CANCELLED'
  "approvedAt": Date,              // When loan was approved
  "createdAt": Date,               // When record was created
  "updatedAt": Date,               // Last update timestamp
  "description": "string",         // Loan description
  "paymentMethod": "LOAN",         // Payment method identifier
  "paidAt": Date,                  // When marked as paid (optional)
  "cancelledAt": Date,             // When cancelled (optional)
  "notes": "string"                // Optional notes
}
```

---

## Integration with Frontend

### Frontend Component Compatibility
This API is designed to work seamlessly with the `loans.tsx` React Native component:

1. **Loan Interface**: Matches the TypeScript interface defined in the frontend
2. **Statistics Format**: Provides statistics in the exact format expected by StatCard components
3. **Pagination**: Supports the pagination pattern used in the FlatList
4. **Status Updates**: Handles the modal-based status update workflow

### Frontend Usage Example
```typescript
// Fetch loans
const response = await axios.get(
  `https://ourcanteennbackend.vercel.app/api/owner/loans?status=${status}&page=${page}&limit=20`,
  { headers: { 'Authorization': `Bearer ${token}` } }
);

// Update loan status
const updateResponse = await axios.put(
  'https://ourcanteennbackend.vercel.app/api/owner/loans',
  { loanId: loan._id, status: 'PAID', notes: 'Payment received' },
  { headers: { 'Authorization': `Bearer ${token}` } }
);
```

---

## Security Considerations

1. **Authentication Required**: All endpoints require valid JWT tokens
2. **Authorization**: Users can only access loans from their own restaurant
3. **Input Validation**: All inputs are validated before processing
4. **Transaction Safety**: Database operations use transactions to ensure consistency
5. **Error Handling**: Comprehensive error handling with appropriate HTTP status codes
