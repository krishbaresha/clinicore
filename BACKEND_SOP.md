# 🏥 ClinicFlow — Backend Development SOP & Security Rules

> **Version:** 1.0 | **Last Updated:** 2026-08-17
> **Purpose:** These Standard Operating Procedures MUST be followed by every developer (human or AI) when building, modifying, or extending the ClinicFlow backend.

---

## 📌 Golden Rules (NEVER Violate)

1. **NEVER store passwords in plaintext** — Always use `bcrypt` with minimum 12 salt rounds
2. **NEVER expose API keys in frontend code** — All secrets go in `.env` (server-side only)
3. **NEVER trust client input** — Validate AND sanitize every single field on the server
4. **NEVER return stack traces in production** — Use generic error messages for clients
5. **NEVER skip authentication checks** — Every API endpoint must verify the session/token
6. **NEVER use string concatenation for SQL** — Always use parameterized queries / ORM
7. **NEVER commit `.env` files** — They MUST be in `.gitignore`
8. **NEVER give more permissions than needed** — Principle of least privilege everywhere

---

## 🏗️ Architecture Requirements

### Tech Stack (Recommended)
```
Backend:     Node.js + Express.js (or Fastify)
Database:    PostgreSQL (or MySQL)
ORM:         Prisma (or Knex.js)
Auth:        JWT (Access + Refresh tokens) with httpOnly cookies
Validation:  Zod (or Joi)
Rate Limit:  express-rate-limit
CORS:        cors package with strict origin whitelist
Logging:     winston (or pino)
```

### Project Structure
```
backend/
├── .env                    # Secrets (NEVER commit)
├── .env.example            # Template without real values (commit this)
├── prisma/
│   └── schema.prisma       # Database schema
├── src/
│   ├── server.js           # Entry point
│   ├── config/
│   │   ├── db.js           # Database connection
│   │   └── env.js          # Environment variable validation
│   ├── middleware/
│   │   ├── auth.js         # JWT verification middleware
│   │   ├── authorize.js    # Role-based access control
│   │   ├── rateLimiter.js  # Rate limiting
│   │   ├── validate.js     # Request validation middleware
│   │   └── errorHandler.js # Global error handler
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── patients.routes.js
│   │   ├── visits.routes.js
│   │   ├── store.routes.js
│   │   └── settings.routes.js
│   ├── controllers/        # Route handlers (thin — call services)
│   ├── services/           # Business logic
│   ├── validators/         # Zod schemas for each endpoint
│   └── utils/
│       ├── logger.js
│       └── helpers.js
└── tests/
    ├── auth.test.js
    └── ...
```

---

## 🔐 Authentication & Authorization Rules

### Password Security
```javascript
// ✅ CORRECT — bcrypt with 12 rounds
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 12;

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
```
```javascript
// ❌ WRONG — NEVER do this
if (user.password === inputPassword)  // plaintext comparison
if (user.password === md5(input))     // MD5 is broken
```

### JWT Token Rules
| Rule | Implementation |
|------|---------------|
| Access Token lifespan | **15 minutes** maximum |
| Refresh Token lifespan | **7 days** maximum |
| Token storage | **httpOnly, Secure, SameSite=Strict** cookie |
| Token signing algorithm | **RS256** (asymmetric) or **HS256** with 256-bit secret |
| Token payload | User ID + role ONLY (no passwords, no PII) |

```javascript
// ✅ CORRECT — httpOnly cookie
res.cookie('accessToken', token, {
  httpOnly: true,      // JS cannot read it
  secure: true,        // HTTPS only
  sameSite: 'Strict',  // No cross-site sending
  maxAge: 15 * 60 * 1000,  // 15 min
});
```
```javascript
// ❌ WRONG — NEVER send token in response body for localStorage
res.json({ token: jwt });  // Frontend localStorage = XSS target
```

### Role-Based Access Control (RBAC)
```javascript
// Middleware: authorize('owner', 'doctor')
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// Usage in routes:
router.get('/settings', auth, authorize('owner'), settingsController.get);
router.post('/patients', auth, authorize('owner', 'receptionist', 'doctor'), patientController.create);
router.delete('/users/:id', auth, authorize('owner'), userController.delete);
```

---

## 🛡️ Input Validation Rules

### Every Endpoint MUST Have Validation
```javascript
// ✅ CORRECT — Zod schema validation
const createPatientSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().regex(/^03\d{9}$/, 'Invalid Pakistani phone number'),
  cnic: z.string().regex(/^\d{5}-\d{7}-\d{1}$/).optional().or(z.literal('')),
  age: z.number().int().min(0).max(150),
  gender: z.enum(['male', 'female', 'other']),
  relation_name: z.string().trim().min(2).max(100).optional(),
});
```

### Sanitization Checklist
| Field Type | Sanitization |
|-----------|-------------|
| Strings | `.trim()`, max length, regex whitelist |
| Numbers | Parse to int/float, min/max range |
| Emails | Lowercase, validate format, max 255 chars |
| Phone | Regex pattern (Pakistani: `/^03\d{9}$/`) |
| CNIC | Regex pattern (`/^\d{5}-\d{7}-\d{1}$/`) |
| Currency | Parse to integer (paisa/cents), never float |
| Dates | ISO 8601 format only, range check |
| IDs | UUID format validation |
| Search queries | Escape special regex chars, max 100 chars |
| File uploads | Whitelist extensions, max size, virus scan |

### SQL Injection Prevention
```javascript
// ✅ CORRECT — Parameterized query (Prisma)
const patient = await prisma.patient.findMany({
  where: { full_name: { contains: searchQuery } }
});

// ✅ CORRECT — Parameterized query (raw SQL)
const result = await db.query(
  'SELECT * FROM patients WHERE full_name ILIKE $1',
  [`%${searchQuery}%`]
);
```
```javascript
// ❌ NEVER — String concatenation
const result = await db.query(
  `SELECT * FROM patients WHERE full_name LIKE '%${searchQuery}%'`
);
```

---

## 🌐 API Design Rules

### Response Format (Standard for ALL endpoints)
```javascript
// Success
{ "success": true, "data": { ... } }
{ "success": true, "data": [...], "pagination": { "page": 1, "total": 50 } }

// Error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Patient not found" } }
```

### HTTP Status Codes
| Code | When to Use |
|------|------------|
| `200` | Success (GET, PUT, PATCH) |
| `201` | Created (POST) |
| `204` | Deleted (DELETE) |
| `400` | Validation error / Bad request |
| `401` | Not authenticated (no token / expired token) |
| `403` | Forbidden (wrong role) |
| `404` | Resource not found |
| `409` | Conflict (duplicate email, etc.) |
| `429` | Rate limited |
| `500` | Server error (log it, return generic message) |

### Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

// General API: 100 requests per 15 minutes
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

// Login: 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts' } }
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);
```

---

## 🔒 Security Headers & CORS

```javascript
const helmet = require('helmet');
const cors = require('cors');

app.use(helmet());  // Sets 15+ security headers automatically

app.use(cors({
  origin: ['https://your-clinic-domain.com'],  // NEVER use '*' in production
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
```

---

## 🗄️ Database Rules

### Schema Design Principles
1. Every table MUST have `id` (UUID), `created_at`, `updated_at`
2. Use **foreign keys** with `ON DELETE CASCADE` or `ON DELETE RESTRICT`
3. **Index** every column used in WHERE, JOIN, or ORDER BY
4. Store currency as **INTEGER** (paisa), not DECIMAL/FLOAT
5. Use **ENUM types** for status fields (waiting, completed, etc.)
6. **Soft delete** for patients, visits, sales (add `deleted_at` column)
7. **Audit log table** for critical actions (who did what, when)

### Backup Rules
1. Daily automated PostgreSQL `pg_dump` backups
2. Backup files encrypted before email/cloud storage
3. Test backup restoration monthly
4. Keep 30 days of rolling backups

---

## 🆕 New Feature Development Checklist

When adding ANY new feature, follow this checklist:

### Before Writing Code
- [ ] Define all API endpoints needed (method, path, request body, response)
- [ ] Define database schema changes (new tables, columns, indexes)
- [ ] Identify which roles can access each endpoint
- [ ] Identify all user inputs and their validation rules

### While Writing Code
- [ ] Create Zod validation schema for every new endpoint
- [ ] Add `auth` middleware to every protected route
- [ ] Add `authorize(roles)` middleware with correct role list
- [ ] Use parameterized queries / ORM — NO string concatenation
- [ ] Sanitize all string inputs (trim, max length)
- [ ] Return correct HTTP status codes
- [ ] Log errors with context (but never log passwords/tokens)
- [ ] Handle edge cases (empty arrays, null values, missing relations)

### After Writing Code
- [ ] Run `npm run build` — zero errors
- [ ] Test with invalid inputs (empty, too long, wrong type, SQL injection strings)
- [ ] Test with unauthorized user (wrong role, expired token, no token)
- [ ] Test with valid inputs — correct response
- [ ] Check no secrets/passwords appear in API responses
- [ ] Check no sensitive data in error messages
- [ ] Update API documentation

---

## 🚨 Error Handling Rules

```javascript
// Global error handler — LAST middleware
app.use((err, req, res, next) => {
  // Log full error for debugging
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip,
  });

  // NEVER send stack traces to client in production
  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred.' }
    });
  }

  // Development — show full error for debugging
  res.status(500).json({
    success: false,
    error: { code: 'SERVER_ERROR', message: err.message, stack: err.stack }
  });
});
```

---

## 📋 Environment Variables Template

```env
# .env.example (COMMIT THIS — without real values)

# Server
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/clinicflow

# JWT
JWT_ACCESS_SECRET=your-256-bit-secret-here
JWT_REFRESH_SECRET=another-256-bit-secret-here

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxx

# CORS
FRONTEND_URL=http://localhost:5173

# Backup
BACKUP_ENCRYPTION_KEY=your-encryption-key
```

---

## 🔄 Migration from localStorage to Backend

When migrating from current frontend localStorage to the backend:

1. **Phase 1:** Build all API endpoints + database
2. **Phase 2:** Create a migration script that reads localStorage JSON and inserts into PostgreSQL
3. **Phase 3:** Update frontend to call API instead of localStorage
4. **Phase 4:** Remove all `localStorage` calls from frontend
5. **Phase 5:** Add real bcrypt password hashing (replace djb2)
6. **Phase 6:** Deploy backend to cloud (Railway, Render, or VPS)

---

> **Remember:** Security is not a feature — it's a foundation. Every shortcut now becomes a vulnerability later.
