# Order Cancellation Penalty System Documentation

## Overview
The canteen app now implements a penalty system for order cancellations within 6 hours of order placement to discourage last-minute cancellations and reduce food waste.

---

## Penalty Rules

### Time-Based Penalty
- **Within 6 hours**: 10% penalty applied
- **After 6 hours**: No penalty (free cancellation)

### Penalty Calculation
```javascript
const hoursElapsed = (currentTime - orderTime) / (1000 * 60 * 60);
const penaltyRate = 0.10; // 10%
const penaltyAmount = hoursElapsed < 6 ? Math.round(orderTotal * penaltyRate) : 0;
```

### Credit Deduction
- Penalty is deducted from user's account credit
- If insufficient credit, maximum available credit is deducted
- Penalty amount cannot exceed user's current balance

---

## API Endpoint

### PATCH `/api/user/order`
Enhanced existing cancellation endpoint with penalty logic.

#### Request Body
```json
{
  "orderId": "string",
  "confirmPenalty": boolean (optional)
}
```

#### Two-Step Process

**Step 1: Penalty Check**
```bash
PATCH /api/user/order
{
  "orderId": "64b1234567890abcdef12345"
}
```

**Response (if penalty required):**
```json
{
  "requiresPenalty": true,
  "penaltyAmount": 25,
  "penaltyRate": 10,
  "hoursElapsed": 2.5,
  "order": {
    "_id": "64b1234567890abcdef12345",
    "total": 250,
    "createdAt": "2024-01-15T08:00:00.000Z"
  }
}
```

**Step 2: Confirm Penalty**
```bash
PATCH /api/user/order
{
  "orderId": "64b1234567890abcdef12345",
  "confirmPenalty": true
}
```

**Response (penalty applied):**
```json
{
  "message": "Order cancelled successfully",
  "order": { ... },
  "orders": [ ... ],
  "penaltyApplied": 25,
  "penaltyMessage": "A penalty of ৳25 has been deducted from your account."
}
```

---

## Database Changes

### Enhanced `orders` Collection
New fields added when penalty is applied:
```javascript
{
  "status": "CANCELLED",
  "penaltyApplied": Number,        // Actual penalty deducted
  "penaltyRate": Number,           // Rate used (0.10)
  "cancelledAt": Date,             // When cancelled
  "hoursElapsedAtCancel": Number,  // Hours elapsed at cancellation
  "updatedAt": Date
}
```

### New `penalties` Collection
Tracks all penalty transactions:
```javascript
{
  "_id": ObjectId,
  "userId": "string",              // User who was penalized
  "orderId": "string",             // Related order
  "amount": Number,                // Penalty amount
  "reason": "EARLY_CANCELLATION",  // Penalty reason
  "hoursElapsed": Number,          // Hours since order
  "orderTotal": Number,            // Original order total
  "penaltyRate": Number,           // Rate applied
  "createdAt": Date
}
```

### Updated `users` Collection
- `credit` field: Reduced by penalty amount during transaction

---

## Frontend Integration

### Warning Modal
When user attempts early cancellation:

1. **Initial Request**: Check for penalty requirement
2. **Show Modal**: Display penalty information with:
   - Order total
   - Hours elapsed
   - Penalty rate (10%)
   - Penalty amount
   - Warning message
3. **User Choice**: 
   - "Keep Order" → Cancel the cancellation
   - "Cancel & Pay Penalty" → Proceed with penalty

### Modal Features
- **Clear Information**: Shows all penalty details
- **User Decision**: Two clear options
- **Visual Warning**: Orange warning icon and colors
- **Penalty Breakdown**: Detailed calculation display

---

## Business Logic

### Penalty Prevention
- Encourages users to think twice before cancelling
- Reduces food waste by discouraging last-minute cancellations
- Provides revenue recovery for restaurants

### Fair Implementation
- Clear 6-hour threshold
- Reasonable 10% penalty rate
- Two-step confirmation process
- Detailed penalty information
- Only deducts available credit

### Order Status Flow
```
PENDING → (< 6 hours) → CANCELLED + PENALTY
PENDING → (> 6 hours) → CANCELLED (no penalty)
SCANNED → (< 6 hours) → CANCELLED + PENALTY
SCANNED → (> 6 hours) → CANCELLED (no penalty)
SUCCESS → ❌ Cannot cancel
```

---

## Error Handling

### API Level
- Validates order ownership
- Checks order status (cannot cancel SUCCESS orders)
- Handles insufficient credit gracefully
- Uses transactions for data consistency

### Frontend Level
- Two-step confirmation process
- Clear penalty information display
- Loading states during processing
- Success/error message handling
- Modal state management

---

## Security Features

1. **User Ownership**: Only order owner can cancel
2. **Time Validation**: Server-side time calculation
3. **Credit Protection**: Cannot deduct more than available
4. **Atomic Transactions**: Ensures data consistency
5. **Audit Trail**: Complete penalty tracking

---

## User Experience

### Positive Aspects
- **Transparency**: All costs clearly shown upfront
- **Choice**: User decides whether to proceed
- **Fair Warning**: 6-hour grace period
- **Clear Information**: Detailed penalty breakdown

### Flow Example
1. User clicks "Cancel Order" (placed 2 hours ago)
2. System calculates: 2 hours < 6 hours → penalty required
3. Modal shows: "10% penalty (৳25) will be charged"
4. User can choose to keep order or pay penalty
5. If confirmed, order cancelled with penalty applied
6. User receives confirmation with penalty details

This system balances user flexibility with business needs while maintaining transparency and fairness.
