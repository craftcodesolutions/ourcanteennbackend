# Loan Approval API Documentation

**API Endpoint:**
```
POST https://ourcanteennbackend.vercel.app/api/owner/approve-loan
```

---

## Description
This endpoint allows restaurant owners or staff with access level "A" to approve loans for customers who have insufficient balance to complete their orders. When a loan is approved, a restaurant-specific loan record is created, the order amount is deducted from the customer's credit (allowing negative balance), and the order status is updated to 'SUCCESS' immediately.

---

## Authentication
- Requires a valid JWT token in the `Authorization` header.
- Only users with `isOwner: true` or `staff.isStaff: true` with `staff.access: "A"` can access this endpoint.

**Header Example:**
```
Authorization: Bearer <your_jwt_token>
```

---

## Request Body
Send a JSON object with the following fields:

| Field      | Type     | Required | Description                                    |
|------------|----------|----------|------------------------------------------------|
| orderId    | string   | Yes      | The ID of the order requiring loan approval    |
| userId     | string   | Yes      | The ID of the customer requesting the loan     |
| loanAmount | number   | Yes      | Amount of loan to approve (must match order total) |

**Example:**
```json
{
  "orderId": "64b1234567890abcdef12345",
  "userId": "64b1234567890abcdef67890",
  "loanAmount": 150
}
```

---

## Business Logic

### Permission Requirements
- Must be restaurant owner (`isOwner: true`) OR
- Must be staff (`staff.isStaff: true`) with access level "A" (`staff.access: "A"`)

### Validation
1. **Order Ownership**: Order must belong to the authenticated user's restaurant
2. **Loan Amount**: Must exactly match the order total
3. **Order Status**: Order must exist and be valid for processing

### Transaction Process
The API uses MongoDB transactions to ensure atomicity:

1. **Create Loan Record**: Inserts loan document in `loans` collection
2. **Update Customer Credit**: Adds loan amount to customer's credit balance
3. **Update Order Status**: Changes order status to 'SCANNED' and adds loan approval flags

---

## Response

### Success (200)
```json
{
  "success": true,
  "message": "Loan approved successfully",
  "order": {
    "_id": "64b1234567890abcdef12345",
    "status": "SCANNED",
    "loanApproved": true,
    "loanApprovedBy": "64b1234567890abcdef67890",
    "scannedBy": "64b1234567890abcdef67890",
    "total": 150,
    "items": [...],
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "loanAmount": 150
}
```

### Error Responses

#### 400 - Bad Request
```json
{
  "error": "Order ID, User ID, and loan amount are required"
}
```

#### 401 - Unauthorized
```json
{
  "error": "You are not Owner or Staff"
}
```

#### 403 - Forbidden
```json
{
  "error": "Insufficient permissions. Only owners or staff with access level A can approve loans."
}
```

#### 404 - Not Found
```json
{
  "error": "Order not found"
}
```

---

## Database Changes

### New Collection: `loans`
```javascript
{
  "_id": ObjectId,
  "userId": "string",           // Customer receiving the loan
  "orderId": "string",          // Associated order
  "amount": Number,             // Loan amount
  "approvedBy": "string",       // User ID who approved the loan
  "approvedByType": "string",   // "OWNER" or "STAFF"
  "restaurantId": "string",     // Restaurant providing the loan
  "customerName": "string",     // Customer details for reference
  "customerEmail": "string",
  "customerPhone": "string",
  "status": "APPROVED",         // Loan status
  "createdAt": Date
}
```

### Updated Collections

#### `users` Collection
- `credit` field: Increased by loan amount

#### `orders` Collection
New fields added:
```javascript
{
  "status": "SCANNED",           // Updated from previous status
  "loanApproved": true,          // Flag indicating loan was approved
  "loanApprovedBy": "userId",    // Who approved the loan
  "scannedBy": "userId",         // Who scanned/processed the order
  "updatedAt": Date
}
```

---

## Security Features

1. **Permission Validation**: Only authorized users can approve loans
2. **Ownership Verification**: Orders can only be processed by the owning restaurant
3. **Amount Validation**: Loan amount must match order total exactly
4. **Atomic Transactions**: Ensures data consistency across multiple collections
5. **Audit Trail**: Records who approved the loan and when

---

## Integration with Scanner

This endpoint is designed to work with the QR scanner interface:

1. Scanner detects insufficient balance (HTTP 406 error)
2. Scanner displays "Approve Loan" button for authorized users
3. User clicks "Approve Loan" button
4. API processes loan approval
5. Scanner receives updated order data
6. Order can proceed normally through SUCCESS flow

---

## Error Handling

- All database operations are wrapped in transactions
- Failed transactions are rolled back automatically
- Detailed error messages for debugging
- Proper HTTP status codes for different error types
