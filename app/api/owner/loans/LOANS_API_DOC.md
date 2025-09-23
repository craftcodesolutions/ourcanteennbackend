# Loans API Documentation

## Overview
This API provides restaurant owners and staff with comprehensive loan management capabilities. Loans are restaurant-specific, allowing owners to track and manage customer loans for their establishment.

## Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <token>
```

## Endpoints

### GET /api/owner/loans
Retrieve loans for the authenticated user's restaurant with filtering and pagination.

#### Query Parameters
- `status` (optional): Filter by loan status (`ACTIVE`, `PAID`, `CANCELLED`)
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of loans per page (default: 20)

#### Request Example
```bash
GET /api/owner/loans?status=ACTIVE&page=1&limit=10
Authorization: Bearer <token>
```

#### Response Example
```json
{
  "success": true,
  "loans": [
    {
      "_id": "64f7b8c123456789abcdef01",
      "loanApprover": "64f7b8c123456789abcdef02",
      "restaurantId": "64f7b8c123456789abcdef03",
      "userId": "64f7b8c123456789abcdef04",
      "orderId": "64f7b8c123456789abcdef05",
      "customerInfo": {
        "name": "John Doe",
        "phoneNumber": "+8801234567890",
        "email": "john@example.com",
        "studentId": "2021-1-23-456"
      },
      "loanAmount": 150.0,
      "orderTotal": 150.0,
      "status": "ACTIVE",
      "approvedAt": "2024-01-15T10:30:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "description": "Loan for Order #ABCDEF05",
      "paymentMethod": "LOAN"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalLoans": 25,
    "limit": 10
  },
  "statistics": {
    "active": {
      "count": 5,
      "totalAmount": 750.0
    },
    "paid": {
      "count": 18,
      "totalAmount": 2340.0
    },
    "cancelled": {
      "count": 2,
      "totalAmount": 300.0
    },
    "total": {
      "count": 25,
      "totalAmount": 3390.0
    }
  }
}
```

#### Error Responses
- `401 Unauthorized`: User is not owner or staff
- `404 Not Found`: Restaurant not found
- `500 Internal Server Error`: Server error

---

### PUT /api/owner/loans
Update loan status (mark as paid or cancelled).

#### Request Body
```json
{
  "loanId": "64f7b8c123456789abcdef01",
  "status": "PAID",
  "notes": "Paid in cash on 2024-01-20"
}
```

#### Request Fields
- `loanId` (required): MongoDB ObjectId of the loan
- `status` (required): New status (`PAID` or `CANCELLED`)
- `notes` (optional): Additional notes about the status change

#### Response Example
```json
{
  "success": true,
  "message": "Loan marked as paid",
  "loan": {
    "_id": "64f7b8c123456789abcdef01",
    "loanApprover": "64f7b8c123456789abcdef02",
    "restaurantId": "64f7b8c123456789abcdef03",
    "userId": "64f7b8c123456789abcdef04",
    "orderId": "64f7b8c123456789abcdef05",
    "customerInfo": {
      "name": "John Doe",
      "phoneNumber": "+8801234567890",
      "email": "john@example.com",
      "studentId": "2021-1-23-456"
    },
    "loanAmount": 150.0,
    "orderTotal": 150.0,
    "status": "PAID",
    "approvedAt": "2024-01-15T10:30:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-20T14:45:00.000Z",
    "description": "Loan for Order #ABCDEF05",
    "paymentMethod": "LOAN",
    "paidAt": "2024-01-20T14:45:00.000Z",
    "updatedBy": "64f7b8c123456789abcdef02",
    "notes": "Paid in cash on 2024-01-20"
  }
}
```

#### Error Responses
- `400 Bad Request`: Missing required fields or invalid status
- `401 Unauthorized`: User is not owner or staff
- `404 Not Found`: Loan not found or access denied
- `500 Internal Server Error`: Server error

---

## Loan Schema

### Loan Document Structure
```javascript
{
  _id: ObjectId,                    // MongoDB document ID
  loanApprover: string,             // User ID who approved the loan
  restaurantId: string,             // Restaurant this loan belongs to
  userId: string,                   // Customer who received the loan
  orderId: string,                  // Associated order ID
  customerInfo: {
    name: string,                   // Customer name
    phoneNumber: string,            // Customer phone
    email: string,                  // Customer email
    studentId?: string              // Student ID (if applicable)
  },
  loanAmount: number,               // Amount of the loan
  orderTotal: number,               // Total order amount (same as loan for full loans)
  status: 'ACTIVE' | 'PAID' | 'CANCELLED',  // Current loan status
  approvedAt: Date,                 // When loan was approved
  createdAt: Date,                  // Document creation time
  updatedAt: Date,                  // Last update time
  description: string,              // Loan description
  paymentMethod: 'LOAN',            // Payment method identifier
  paidAt?: Date,                    // When loan was marked as paid
  cancelledAt?: Date,               // When loan was cancelled
  updatedBy?: string,               // User ID who last updated the loan
  notes?: string                    // Additional notes
}
```

### Status Flow
1. **ACTIVE**: Loan is approved and outstanding
2. **PAID**: Customer has repaid the loan
3. **CANCELLED**: Loan was cancelled by staff/owner

## Business Rules

### Restaurant Isolation
- Loans are restaurant-specific
- Owners can only see loans from their restaurant
- Staff can only see loans from their assigned restaurant

### Authorization Levels
- **Owner**: Full access to all loan operations
- **Staff**: Full access to all loan operations (restaurant-specific)
- **Regular Users**: No access to loan management

### Loan Lifecycle
1. Customer places order with insufficient balance
2. Staff/Owner approves loan via scanner
3. Loan record created in `loans` collection
4. Customer's credit balance goes negative
5. Order marked as SUCCESS immediately
6. Staff/Owner can later mark loan as PAID or CANCELLED

### Data Integrity
- Loans are created via transaction to ensure atomicity
- Customer balance is updated simultaneously with loan creation
- All loan operations are logged with timestamps and user IDs

## Usage Examples

### Viewing All Active Loans
```bash
GET /api/owner/loans?status=ACTIVE
```

### Marking Loan as Paid
```bash
PUT /api/owner/loans
{
  "loanId": "64f7b8c123456789abcdef01",
  "status": "PAID",
  "notes": "Customer paid in cash"
}
```

### Getting Loan Statistics
```bash
GET /api/owner/loans
# Returns statistics in the response
```

## Integration Notes

### Frontend Integration
- Use the loans page at `/app/(admin)/loans.tsx`
- Loans tab available in admin navigation
- Real-time updates via pull-to-refresh
- Pagination support for large datasets

### Database Considerations
- Index on `restaurantId` for performance
- Index on `status` for filtering
- Index on `createdAt` for sorting
- Compound index on `restaurantId + status` for optimal queries

### Monitoring
- Track loan approval rates
- Monitor outstanding loan amounts
- Alert on high-value loans
- Report on loan repayment patterns
