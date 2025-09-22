# Password Reset Setup Guide

## Required Environment Variables

Add these to your `.env.local` file:

```env
# Email Configuration (for password reset)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

## Gmail Setup Instructions

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Gmail Settings → Security
   - Under "2-Step Verification", click on "App passwords"
   - Generate a new app password for "Mail"
   - Use this 16-character password in `EMAIL_PASSWORD`

## API Endpoints

### 1. Request Password Reset
- **POST** `/api/auth/forgot-password`
- **Body**: `{ email: "user@example.com" }`
- **Response**: Sends 4-digit code to email

### 2. Verify Reset Code
- **POST** `/api/auth/verify-reset-code`
- **Body**: `{ email: "user@example.com", code: "1234" }`
- **Response**: Returns reset token if code is valid

### 3. Reset Password
- **POST** `/api/auth/reset-password`
- **Body**: 
  ```json
  {
    "email": "user@example.com",
    "resetToken": "token-from-verify-step",
    "newPassword": "newpassword123",
    "confirmPassword": "newpassword123"
  }
  ```

## Frontend Flow

1. User enters email on `/forgot-password`
2. Code sent to email → Navigate to `/verify-code`
3. User enters 4-digit code → Navigate to `/reset-password`
4. User sets new password → Redirect to `/signin`

## Database Collections

The system creates a `password_resets` collection with:
- `email`: User's email
- `code`: 4-digit verification code
- `expiresAt`: Expiration time (15 minutes)
- `verified`: Boolean flag
- `used`: Boolean flag

## Security Features

- Codes expire after 15 minutes
- Only verified codes can be used for password reset
- Old reset requests are cleaned up when new ones are created
- Passwords are hashed with bcrypt (12 rounds)
