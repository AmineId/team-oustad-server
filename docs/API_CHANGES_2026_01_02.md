# API Changes - January 2, 2026

## Summary
This document outlines new API endpoints that need to be integrated into the mobile app.

---

## 1. Check-In Checkout Endpoint

### `POST /check-in/{id}/checkout`

**Purpose:** Allows a member to checkout (record exit time) from the gym.

**Authentication:** Required (Bearer token)

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | The check-in ID to close |

**Request:** No body required

**Response (200):**
```json
{
  "id": 123,
  "displayId": "CHECKIN-abc123",
  "memberId": 1,
  "gymId": 1,
  "subscriptionId": 5,
  "checkInTime": "2026-01-02T09:00:00.000Z",
  "checkOutTime": "2026-01-02T11:30:00.000Z"
}
```

**Error Responses:**
- `400` - Already checked out: `{ "error": "Already checked out" }`
- `404` - Check-in not found: `{ "error": "Check-in not found" }`

---

## 2. Member Onboarding Status

### `PUT /members/{id}/onboarding`

**Purpose:** Update the onboarding completion status of a member.

**Authentication:** Required (Bearer token)

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | User ID of the member |

**Request Body:**
```json
{
  "onboarding": true
}
```

**Response (200):**
```json
{
  "message": "onboarding status updated",
  "member": {
    "userId": 1,
    "onboarding": true,
    ...
  }
}
```

**Error Responses:**
- `400` - Missing onboarding field: `{ "error": "onboarding is required" }`
- `403` - Forbidden (not own profile and not admin)

---

## 3. Profile Picture Endpoints

### `PUT /members/{id}/profile-picture`

**Purpose:** Upload a new profile picture for the member.

**Authentication:** Required (Bearer token)

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | User ID of the member |

**Request Body:**
```json
{
  "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

> **Note:** `imageData` can be a full data URI (with `data:image/...;base64,` prefix) or just the raw base64 string.

**Response (200):**
```json
{
  "message": "Profile picture uploaded successfully"
}
```

**Error Responses:**
- `400` - Missing or invalid image: `{ "error": "imageData is required" }` or `{ "error": "Invalid image data" }`
- `403` - Forbidden

---

### `GET /members/{id}/profile-picture`

**Purpose:** Retrieve the profile picture of a member.

**Authentication:** Required (Bearer token)

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | User ID of the member |

**Response (200):**
```json
{
  "profileImage": "base64-encoded-image-data..."
}
```

**Error Responses:**
- `403` - Forbidden
- `404` - No profile picture found

---

### `DELETE /members/{id}/profile-picture`

**Purpose:** Delete the profile picture of a member.

**Authentication:** Required (Bearer token)

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | User ID of the member |

**Response (200):**
```json
{
  "message": "Profile picture deleted successfully"
}
```

**Error Responses:**
- `403` - Forbidden

---

## 4. Preferred Training Days

### `PUT /members/{id}/preferred-training-days`

**Purpose:** Update the days of the week when the member prefers to train.

**Authentication:** Required (Bearer token)

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | User ID of the member |

**Request Body (Option 1 - Numbers):**
```json
{
  "days": [1, 3, 5]
}
```

**Request Body (Option 2 - Day Names):**
```json
{
  "days": ["monday", "wednesday", "friday"]
}
```

> **Day Mapping:**
> - 0 = Sunday
> - 1 = Monday
> - 2 = Tuesday
> - 3 = Wednesday
> - 4 = Thursday
> - 5 = Friday
> - 6 = Saturday

**Alternative field name:** `preferredTrainingDays` also accepted.

**Response (200):**
```json
{
  "message": "preferred training days updated",
  "member": {
    "userId": 1,
    "preferredTrainingDays": [1, 3, 5],
    ...
  }
}
```

**Error Responses:**
- `400` - Invalid days: `{ "error": "days must be an array" }` or `{ "error": "days must be numbers between 0 and 6 or valid day names" }`
- `403` - Forbidden

---

## Implementation Checklist for Mobile App

### API Service Updates
- [ ] Add `checkoutMember(checkInId: number)` method
- [ ] Add `updateOnboardingStatus(memberId: number, onboarding: boolean)` method
- [ ] Add `uploadProfilePicture(memberId: number, imageData: string)` method
- [ ] Add `getProfilePicture(memberId: number)` method
- [ ] Add `deleteProfilePicture(memberId: number)` method
- [ ] Add `updatePreferredTrainingDays(memberId: number, days: number[] | string[])` method

### UI Updates
- [ ] Add checkout button on active check-in screen
- [ ] Add onboarding flow completion API call
- [ ] Add profile picture upload in member profile
- [ ] Add profile picture display in member profile/header
- [ ] Add preferred training days selector in profile settings

### Response Format Notes
All endpoints return JSON objects. Key patterns:
- Success messages: `{ "message": "...", "member": {...} }`
- Check-in objects include `checkOutTime` field (null if still checked in)
- Profile images are base64 encoded strings

---

## Base URL
- **Pre-production:** `https://api-pprod.team-oustad.com`
- **Production:** `https://api.teamfitness.com`
- **Local dev:** `http://localhost:3001`
