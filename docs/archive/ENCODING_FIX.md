# Fix for PostgreSQL UTF-8 Encoding Error

## Problem
Users were experiencing login failures with the error:
```
ConnectorError: invalid byte sequence for encoding "UTF8": 0x00
```

This error occurred when the email field contained null bytes (`0x00`) or other control characters that are invalid in PostgreSQL's UTF-8 encoding.

## Root Cause
The error was caused by email inputs containing:
- Null bytes (`\x00`)
- Control characters (`\x01` - `\x1F`)

These characters can be present in API requests due to:
- Malformed client requests
- Copy-paste issues with hidden characters
- Security testing/injection attempts
- Client-side encoding issues

## Solution
Added email sanitization across all routes that handle email input:

### 1. Created Sanitization Helper Function
Added to both `routes/auth.js` and `routes/users.js`:
```javascript
const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') return email;
  // Remove null bytes and control characters that can cause PostgreSQL encoding errors
  return email.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim().toLowerCase();
};
```

### 2. Applied Sanitization to All Email Lookups

#### auth.js
- `/auth/login` - Login endpoint
- `/auth/forgot-password` - Password reset request
- `/auth/reset-password` - Password reset execution
- `/auth/send-setup-email` - Send setup email to new users
- `/auth/setup-password` - Initial password setup

#### users.js
- `POST /users` - Create new user
- `POST /users/create-owner` - Create owner user
- `POST /users/create-admin` - Create admin user

### 3. Sanitization Behavior
The function:
- Removes null bytes (`\x00`)
- Removes control characters (`\x01-\x08`, `\x0B-\x0C`, `\x0E-\x1F`)
- Preserves tab (`\x09`), newline (`\x0A`), and carriage return (`\x0D`) initially but trims them
- Trims whitespace
- Converts to lowercase for consistency

## Testing
Created test utilities:
1. `fix-encoding-issue.js` - Scans database for existing encoding issues
2. `test-bob-login.js` - Checks specific user email encoding
3. `test-null-byte-login.js` - Tests login with various invalid characters

## Files Modified
- `routes/auth.js` - Added sanitization to all email-based auth endpoints
- `routes/users.js` - Added sanitization to user creation endpoints

## Prevention
This fix prevents:
- Database query failures due to invalid UTF-8 sequences
- Potential injection attacks via control characters
- User confusion from hidden characters in emails

## Additional Benefits
- Email normalization (lowercase, trimmed)
- Better error messages when invalid characters are detected
- Consistent email handling across all endpoints
