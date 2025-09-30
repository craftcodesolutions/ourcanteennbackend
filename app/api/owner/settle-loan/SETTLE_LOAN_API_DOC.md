# Settle Loan API Documentation

## Endpoint: `/api/owner/settle-loan`

### Description
This API endpoint allows staff/owners to settle one or multiple active loans for a customer via cash payment. It supports both individual loan settlement and bulk settlement of all loans at once.

### Authentication
- **Required**: JWT Token
- **Authorization**: Bearer token in the Authorization header
- **Access Level**: Owner or Staff with admin privileges

### HTTP Method
- **POST**: Settle loans and restore customer credit

---

## Request Format

### Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Request Body
```json
{
  "loanIds": ["64b1234567890abcdef12345", "64b1234567890abcdef12346"],
  "userId": "64a9876543210fedcba98765",
  "notes": "Customer paid in cash at restaurant counter"
}
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `loanIds` | array | Yes | Array of loan IDs to settle |
| `userId` | string | Yes | Customer's user ID |
| `notes` | string | No | Additional notes about the settlement |

---

## Response Format

### Success Response (200)
```json
{
  "success": true,
  "message": "Successfully settled 2 loan(s)",
  "data": {
    "settledLoans": 2,
    "totalAmount": 450.00,
    "loanIds": ["64b1234567890abcdef12345", "64b1234567890abcdef12346"],
    "customer": {
      "userId": "64a9876543210fedcba98765",
      "name": "John Doe",
      "email": "john@example.com",
      "phoneNumber": "+8801234567890",
      "newCreditBalance": 750.00
    }
  }
}
```

### Error Responses

#### 400 - Bad Request
```json
{
  "success": false,
  "error": "Loan IDs array is required"
}
```

#### 401 - Unauthorized
```json
{
  "success": false,
  "error": "Access token required"
}
```

#### 403 - Forbidden
```json
{
  "success": false,
  "error": "Unauthorized access"
}
```

#### 404 - Not Found
```json
{
  "success": false,
  "error": "No active loans found for the specified IDs"
}
```

#### 500 - Server Error
```json
{
  "success": false,
  "error": "Transaction failed, no changes applied"
}
```

---

## Business Logic

### Settlement Process
1. **Authentication**: Verifies user is owner or staff
2. **Validation**: 
   - Checks loan IDs array is provided and not empty
   - Validates user ID is provided
   - Ensures all loans exist and are ACTIVE
   - Verifies all loans belong to the specified user
3. **1-Hour Protection**: Prevents settlement of loans created within the last hour
4. **Transaction Processing**:
   - Updates all specified loans to PAID status
   - Adds settlement timestamp and notes
   - Restores customer credit by adding total loan amount
5. **Response**: Returns settlement summary and updated customer info

### Payment Method
- **Fixed**: Cash at Restaurant (as per requirements)
- **Notes Format**: `"Payment Method: Cash at Restaurant - [custom notes] - Settled via Scanner by [Staff Name] - [X] loan(s) settled"`

### Credit Restoration
- **Automatic**: Total loan amount is added back to customer's credit balance
- **Atomic**: Either all loans are settled and credit restored, or nothing happens
- **Audit Trail**: All changes are logged with timestamps and staff attribution

---

## Usage Examples

### Settle Single Loan
```javascript
const response = await fetch('/api/owner/settle-loan', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    loanIds: ["64b1234567890abcdef12345"],
    userId: "64a9876543210fedcba98765",
    notes: "Customer paid ৳150 in cash"
  })
});
```

### Settle Multiple Loans (Bulk Settlement)
```javascript
const response = await fetch('/api/owner/settle-loan', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    loanIds: [
      "64b1234567890abcdef12345",
      "64b1234567890abcdef12346",
      "64b1234567890abcdef12347"
    ],
    userId: "64a9876543210fedcba98765",
    notes: "Customer paid all outstanding loans - total ৳450"
  })
});
```

---

## Integration with Scanner Flow

### Expected Integration
1. **QR Scan**: Customer QR code scanned to get userId
2. **Fetch Customer Info**: Include active loans in customer data
3. **Display Options**: Show individual loans and "Pay All" option
4. **Settlement**: Call this API with selected loan IDs
5. **Confirmation**: Show settlement success with updated balance

### Frontend Implementation Example
```javascript
// Settle all loans
const settleAllLoans = async (customerLoans, userId) => {
  const loanIds = customerLoans.map(loan => loan._id);
  
  const response = await fetch('/api/owner/settle-loan', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      loanIds,
      userId,
      notes: `Settled all ${loanIds.length} active loans`
    })
  });
  
  const result = await response.json();
  if (result.success) {
    alert(`Successfully settled ${result.data.settledLoans} loans for ৳${result.data.totalAmount}`);
  }
};
```

---

## Security Features

### Transaction Safety
- **Atomic Operations**: All-or-nothing transaction processing
- **Rollback Protection**: Failed transactions don't leave partial updates
- **Duplicate Prevention**: Validates loan status before processing

### Business Rules
- **1-Hour Protection**: Cannot settle loans within 1 hour of creation
- **Status Validation**: Only ACTIVE loans can be settled
- **Ownership Verification**: Loans must belong to specified user
- **Staff Authorization**: Only authorized staff can settle loans

### Audit Trail
- **Staff Attribution**: Records which staff member settled the loans
- **Timestamp Tracking**: Records exact settlement time
- **Notes Preservation**: Maintains settlement notes for future reference
- **Credit History**: Updates customer credit with proper audit trail
