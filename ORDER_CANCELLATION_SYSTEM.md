# Order Cancellation System - Both Sides

## Overview
The canteen app now supports order cancellation from both user and owner/admin sides with automatic refund handling.

## User Side Cancellation
**Existing functionality - already implemented**

### API Endpoint
- **PATCH** `/api/user/order`
- **Body**: `{ orderId: "order_id" }`
- **Headers**: `Authorization: Bearer <token>`

### Features
- Users can cancel their own orders
- Order status changes to 'CANCELLED'
- Only orders that aren't already cancelled can be cancelled

### Frontend Location
- `ourcanteenapp/app/(tabs)/orders.tsx`
- Cancel button appears for each order
- Real-time loading state

## Owner/Admin Side Cancellation
**New functionality - just implemented**

### API Endpoint
- **PATCH** `/api/owner/cancel-order`
- **Body**: `{ orderId: "order_id", userId: "user_id" }`
- **Headers**: `Authorization: Bearer <token>`

### Authorization
- Must be restaurant owner (`isOwner: true`) or staff (`staff.isStaff: true`)
- Can only cancel orders belonging to their restaurant
- Order must belong to the authenticated user's restaurant

### Advanced Features
1. **Automatic Refunds**: If order status is 'SCANNED' (customer already paid), the system automatically refunds the credit to customer
2. **Transaction Safety**: Uses MongoDB transactions to ensure both order cancellation and refund happen atomically
3. **Audit Trail**: Records who cancelled the order (`cancelledBy`, `cancelledByType`)
4. **Status Validation**: Cannot cancel 'SUCCESS' (completed) orders

### Frontend Location
- `ourcanteenapp/app/adminorders/[date].tsx`
- Cancel button appears for each order (except CANCELLED/SUCCESS)
- Confirmation dialog with refund information
- Real-time loading state

## Order Status Flow

```
PENDING → SCANNED → SUCCESS (payment occurs here, food taken)
   ↓         ↓         ❌
CANCELLED  CANCELLED  (Cannot cancel - food already taken)
```

## Cancel Button Logic

### User Side
- Show cancel button if: `order.status === 'PENDING' || order.status === 'SCANNED'`
- User can cancel orders before food is taken
- Cannot cancel SUCCESS orders (food already received)

### Owner/Admin Side  
- Show cancel button if: `order.status !== 'CANCELLED' && order.status !== 'SUCCESS'`
- Can cancel PENDING orders (no payment, no food given)
- Can cancel SCANNED orders (no payment yet, no food given)
- Cannot cancel SUCCESS orders (payment made, food already taken)

## Refund System

### When Refunds Happen
- **PENDING → CANCELLED**: No refund (customer hasn't paid yet)
- **SCANNED → CANCELLED**: No refund (customer hasn't paid yet)
- **SUCCESS → CANCELLED**: ❌ Not allowed (food already taken)

### Refund Implementation
- No refunds needed since SUCCESS orders cannot be cancelled
- Only PENDING and SCANNED orders can be cancelled (no payment made yet)
- Transactions still used for data consistency

## Database Changes

### Orders Collection
New fields added when cancelled by owner/admin:
```javascript
{
  status: 'CANCELLED',
  cancelledBy: ObjectId, // ID of who cancelled
  cancelledByType: 'OWNER' | 'STAFF', // Type of canceller
  updatedAt: Date
}
```

### Users Collection
- `credit` field updated when refunds occur
- Transaction ensures data consistency

## Error Handling

### API Level
- Validates order ownership
- Prevents double cancellation
- Checks order status before cancellation
- Validates user permissions

### Frontend Level
- Loading states during cancellation
- Error alerts for failed operations
- Success messages with refund information
- Confirmation dialogs for destructive actions

## Security Features

1. **Permission Validation**: Only authorized users can cancel orders
2. **Ownership Verification**: Orders can only be cancelled by the right restaurant
3. **Status Validation**: Prevents invalid state transitions
4. **Atomic Transactions**: Ensures data consistency during refunds

## Testing Scenarios

1. **User cancels PENDING order** → Order cancelled, no refund
2. **User cancels SCANNED order** → Order cancelled, no automatic refund (user-side cancellation doesn't refund)
3. **Owner cancels PENDING order** → Order cancelled, no refund needed
4. **Owner cancels SCANNED order** → Order cancelled, no refund needed
5. **Attempt to cancel SUCCESS order** → Error - not allowed (food taken)
6. **Attempt to cancel already CANCELLED order** → Graceful handling

## UI/UX Features

### Confirmation Dialogs
- Simple confirmation message (no refund info needed)
- Clear warning that action cannot be undone
- Destructive action styling (red buttons)

### Real-time Updates
- Orders list refreshes after cancellation
- Loading states prevent double-clicks
- Immediate feedback to users

### Visual Indicators
- Cancel buttons only appear when relevant
- Different styling for different order statuses
- Clear success/error messaging
