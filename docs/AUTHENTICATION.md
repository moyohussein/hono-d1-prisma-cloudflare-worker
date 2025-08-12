# Authentication Flow Documentation

This document outlines the complete authentication flow for the LeamSP frontend, including API endpoints, request/response formats, and implementation examples.

## Table of Contents
- [1. Registration](#1-registration)
- [2. Email Verification](#2-email-verification)
- [3. Login](#3-login)
- [4. Password Reset](#4-password-reset)
- [5. Protected Routes](#5-protected-routes)
- [6. Logout](#6-logout)
- [7. Error Handling](#7-error-handling)
- [8. Security Considerations](#8-security-considerations)

## 1. Registration

### Endpoint
```
POST /api/auth/register
```

### Request Body
```typescript
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "password_confirmation": "SecurePass123!"
}
```

### Response (Success - 201)
```typescript
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "email_verified_at": null,
  "created_at": "2025-08-11T10:00:00Z"
}
```

### Implementation Example
```typescript
const register = async (userData) => {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Registration failed');
  }
  
  return response.json();
};
```

## 2. Email Verification

### Flow
1. User receives verification email after registration
2. Email contains link: `https://yourapp.com/verify-email?token=xxx`
3. Frontend handles the verification when user clicks the link

### Endpoint
```
GET /api/auth/verify-email?token=xxx
```

### Response
- Success: 302 Redirect to `/email-verified?status=success`
- Already verified: 302 Redirect to `/email-verified?status=already-verified`
- Invalid token: 400 Bad Request

## 3. Login

### Endpoint
```
POST /api/auth/login
```

### Request Body
```typescript
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

### Response (Success - 200)
```typescript
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "email_verified_at": "2025-08-11T10:05:00Z"
  }
}
```

### Implementation Example
```typescript
const login = async (email, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Login failed');
  }
  
  const data = await response.json();
  localStorage.setItem('token', data.token);
  return data.user;
};
```

## 4. Password Reset

### 4.1 Forgot Password

#### Endpoint
```
POST /api/auth/forgot-password
```

#### Request Body
```typescript
{
  "email": "john@example.com"
}
```

#### Response (Always 200)
```typescript
{
  "ok": true,
  // In development only:
  "devToken": "test-reset-token-xxxxxxxxxxxxxxx"
}
```

### 4.2 Reset Password

#### Endpoint
```
POST /api/auth/reset-password
```

#### Request Body
```typescript
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePass123!",
  "confirmPassword": "NewSecurePass123!"
}
```

#### Response (Success - 200)
```typescript
{
  "ok": true
}
```

## 5. Protected Routes

### Checking Authentication Status

#### Endpoint
```
GET /api/auth/me
```

#### Headers
```
Authorization: Bearer <token>
```

#### Response (Success - 200)
```typescript
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "email_verified_at": "2025-08-11T10:05:00Z"
}
```

### React Router Protected Route Example
```typescript
const PrivateRoute = ({ children }) => {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setAuth(false);
        setLoading(false);
        return;
      }
      
      try {
        const response = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setAuth(response.ok);
      } catch {
        setAuth(false);
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  if (loading) return <div>Loading...</div>;
  return auth ? children : <Navigate to="/login" />;
};
```

## 6. Logout

### Implementation
```typescript
const logout = () => {
  localStorage.removeItem('token');
  // Redirect to login page
  window.location.href = '/login';
};
```

## 7. Error Handling

### Common Error Responses

#### 400 Bad Request
```typescript
{
  "message": "Validation Error",
  "errors": {
    "email": ["The email field is required."],
    "password": ["The password must be at least 8 characters."]
  }
}
```

#### 401 Unauthorized
```typescript
{
  "message": "Unauthenticated."
}
```

#### 403 Forbidden
```typescript
{
  "message": "This action is unauthorized."
}
```

## 8. Security Considerations

1. **JWT Storage**:
   - Store JWT in `localStorage` for persistence across page refreshes
   - Consider `sessionStorage` for enhanced security (cleared when tab closes)

2. **HTTPS**:
   - Always use HTTPS in production
   - Enable HSTS header

3. **Password Requirements**:
   - Minimum 8 characters
   - At least one uppercase letter
   - At least one number
   - At least one special character

4. **Rate Limiting**:
   - Handle 429 Too Many Requests responses
   - Implement exponential backoff for retries

5. **Token Management**:
   - Handle token expiration (typically 24 hours)
   - Implement token refresh if needed
   - Clear tokens on logout

6. **CSRF Protection**:
   - Ensure CSRF protection is enabled on the server
   - Include CSRF token in forms if required

## Example Frontend Auth Context (React)

```typescript
// AuthContext.tsx
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  register: async () => {},
  isAuthenticated: false
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          setUser(await response.json());
        }
      } catch (error) {
        console.error('Failed to load user', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (email, password) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();
    localStorage.setItem('token', data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/login';
  };

  const register = async (userData) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }

    return response.json();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        register,
        isAuthenticated: !!user
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

## Usage in Components

```typescript
// Login.jsx
import { useState } from 'react';
import { useAuth } from './AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      await login(email, password);
      // Redirect to dashboard or home page
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit">Log In</button>
    </form>
  );
};

export default Login;
```

## Conclusion

This document provides a comprehensive guide to implementing authentication in the frontend. The API follows RESTful principles and uses JWT for stateless authentication. Always ensure proper error handling and security measures are in place when implementing these flows.
