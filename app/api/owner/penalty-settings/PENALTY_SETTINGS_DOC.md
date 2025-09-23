# Penalty Settings API Documentation

## Overview
Restaurant owners can configure penalty settings for order cancellations through this API. Settings include penalty rate, time threshold, and whether to allow negative balances.

---

## API Endpoints

### GET `/api/owner/penalty-settings`
Retrieve current penalty settings for the restaurant.

#### Authentication
- Requires JWT token in Authorization header
- Only restaurant owners (`isOwner: true`) can access

#### Response (200 OK)
```json
{
  "success": true,
  "penaltySettings": {
    "enabled": true,
    "penaltyRate": 10,
    "timeThreshold": 6,
    "allowNegativeBalance": true
  },
  "restaurantId": "64b1234567890abcdef12345",
  "restaurantName": "Example Restaurant"
}
```

#### Default Settings
If no settings exist, defaults are returned:
- `enabled`: `true`
- `penaltyRate`: `10` (10%)
- `timeThreshold`: `6` (6 hours)
- `allowNegativeBalance`: `true`

---

### PUT `/api/owner/penalty-settings`
Update penalty settings for the restaurant.

#### Authentication
- Requires JWT token in Authorization header
- Only restaurant owners (`isOwner: true`) can update

#### Request Body
```json
{
  "enabled": boolean,
  "penaltyRate": number,          // 0-100 (percentage)
  "timeThreshold": number,        // 0-48 (hours)
  "allowNegativeBalance": boolean
}
```

#### Validation Rules
- `enabled`: Must be boolean
- `penaltyRate`: Number between 0-100 (percentage)
- `timeThreshold`: Number between 0-48 (hours)
- `allowNegativeBalance`: Must be boolean

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Penalty settings updated successfully",
  "penaltySettings": {
    "enabled": true,
    "penaltyRate": 15,
    "timeThreshold": 4,
    "allowNegativeBalance": false,
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "updatedBy": "64b1234567890abcdef67890"
  }
}
```

---

## Database Schema

### Enhanced `restaurants` Collection
```javascript
{
  "_id": ObjectId,
  "name": "string",
  "ownerId": ObjectId,
  // ... other restaurant fields
  "penaltySettings": {
    "enabled": Boolean,           // Whether penalty system is active
    "penaltyRate": Number,        // Penalty percentage (0-100)
    "timeThreshold": Number,      // Hours threshold for penalty
    "allowNegativeBalance": Boolean, // Can users go negative
    "updatedAt": Date,
    "updatedBy": String          // User ID who last updated
  }
}
```

---

## Integration with Order Cancellation

### How Settings Are Used
1. **User Cancels Order**: System fetches restaurant's penalty settings
2. **Time Check**: Compares order time vs `timeThreshold`
3. **Penalty Calculation**: Uses `penaltyRate` if within threshold
4. **Balance Handling**: Respects `allowNegativeBalance` setting
5. **Penalty Application**: Rounds to 1 decimal place

### Example Flow
```javascript
// Restaurant settings
const settings = {
  enabled: true,
  penaltyRate: 15,          // 15%
  timeThreshold: 4,         // 4 hours
  allowNegativeBalance: false
};

// Order placed 2 hours ago (₹100 total)
const hoursElapsed = 2;
const orderTotal = 100;

// Penalty calculation
if (hoursElapsed < settings.timeThreshold && settings.enabled) {
  const rawPenalty = orderTotal * (settings.penaltyRate / 100); // 15
  const penalty = Math.round(rawPenalty * 10) / 10; // 15.0
  
  // Apply penalty respecting balance settings
  if (settings.allowNegativeBalance) {
    // Deduct full penalty even if user goes negative
    finalPenalty = penalty; // 15.0
  } else {
    // Only deduct what user can afford
    finalPenalty = Math.min(penalty, userCredit);
  }
}
```

---

## Frontend Integration

### Admin Restaurant Page
- **Settings Display**: Shows current penalty configuration
- **Edit Modal**: Allows owners to modify all settings
- **Real-time Preview**: Shows how settings affect penalties
- **Validation**: Prevents invalid values

### Settings UI Features
- **Toggle Switches**: Enable/disable penalty system
- **Numeric Inputs**: Set penalty rate and time threshold
- **Balance Options**: Choose negative balance policy
- **Clear Descriptions**: Explain each setting's impact

---

## Error Handling

### 400 Bad Request
```json
{
  "error": "penaltyRate must be a number between 0 and 100"
}
```

### 403 Forbidden
```json
{
  "error": "Only restaurant owners can update penalty settings"
}
```

### 404 Not Found
```json
{
  "error": "Restaurant not found"
}
```

---

## Business Logic

### Penalty Rate
- **Range**: 0-100%
- **Recommendation**: 5-20% for fair penalties
- **Example**: 10% of ₹100 order = ₹10 penalty

### Time Threshold
- **Range**: 0-48 hours
- **Common Values**: 
  - 2 hours: Strict policy
  - 6 hours: Moderate policy  
  - 24 hours: Lenient policy

### Negative Balance
- **Allowed**: Users can go negative, ensures full penalty collection
- **Not Allowed**: Penalty limited to available credit, protects users

---

## Security Features

1. **Owner-Only Access**: Only restaurant owners can modify settings
2. **Input Validation**: All values validated and sanitized
3. **Audit Trail**: Tracks who made changes and when
4. **Range Limits**: Prevents extreme values
5. **Database Integrity**: Uses atomic operations

---

## Migration Notes

### Existing Restaurants
- Systems works with default settings if none configured
- No migration required for existing data
- Settings can be added incrementally

### Backward Compatibility
- All existing cancellation logic continues to work
- Default values ensure consistent behavior
- Optional integration for new features
