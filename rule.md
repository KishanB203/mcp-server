# MERN Coding Standards (React + Node.js + SQL Support)

## 1. General Principles

* Follow **clean code** practices: readability, simplicity, maintainability.
* Use **consistent formatting** (Prettier + ESLint).
* Prefer **modular, reusable components/functions**.
* Avoid code duplication (DRY principle).
* Write meaningful comments only where necessary.

---

## 2. Project Structure

### React

```
src/
  components/
  pages/
  hooks/
  services/
  utils/
  styles/
  context/
```

### Node (Express)

```
src/
  controllers/
  routes/
  services/
  models/
  repositories/   // Added for SQL support
  middlewares/
  utils/
  config/
  database/       // DB connection configs (Mongo + SQL)
```

---

## 3. Naming Conventions

* Use **camelCase** for variables and functions
* Use **PascalCase** for React components and classes
* Use **UPPER_CASE** for constants

### File Names

* React components: `UserProfile.jsx`
* Hooks: `useAuth.js`
* Services: `userService.js`
* Repositories: `userRepository.js`

---

## 4. React Coding Standards

### 4.1 Component Design

* Use **functional components** with hooks
* Keep components small and focused
* Avoid large monolithic components

### 4.2 Hooks

* Use built-in hooks (`useState`, `useEffect`)
* Create custom hooks for reusable logic
* Optimize with `useMemo`, `useCallback`

### 4.3 State Management

* Local state → UI logic
* Global state → Context API / Redux
* Avoid deeply nested state

### 4.4 Props

* Validate using PropTypes or TypeScript
* Avoid excessive prop drilling

### 4.5 API Calls

* Use **services layer**
* Centralize API logic
* Handle loading & error states

### 4.6 Styling

* Use CSS modules / styled-components / Tailwind
* Avoid inline styles unless necessary

---

## 5. Node.js (Express) Standards

### 5.1 Architecture

* Follow **MVC pattern**
* Controllers → thin
* Business logic → services
* DB logic → repositories (for SQL)

### 5.2 Routing

* Use separate route files
* Follow REST conventions

```
GET    /users
POST   /users
GET    /users/:id
PUT    /users/:id
DELETE /users/:id
```

### 5.3 Error Handling

* Centralized error middleware

```
{
  success: false,
  message: "Error message"
}
```

### 5.4 Middleware

* Authentication
* Logging
* Validation

### 5.5 Validation

* Use Joi / express-validator
* Validate body, params, query

---

## 6. Database Standards

### 6.1 MongoDB (Mongoose)

* Use Mongoose models
* Keep schema clean and structured
* Use indexes where necessary
* Avoid deeply nested documents

Example:

```
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now }
});
```

---

### 6.2 MySQL / SQL Databases

#### ORM

* Use **Prisma (recommended)** or Sequelize

#### Project Pattern

* Use **Repository Layer** for DB queries
* Keep SQL logic out of controllers/services

#### Example Schema (Prisma)

```
model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  createdAt DateTime @default(now())
}
```

#### Repository Example

```
export const getUserById = async (id) => {
  return prisma.user.findUnique({ where: { id } });
};
```

#### Service Example

```
export const fetchUser = async (id) => {
  const user = await getUserById(id);
  if (!user) throw new Error("User not found");
  return user;
};
```

---

### 6.3 SQL Best Practices

* Normalize schema (avoid redundancy)
* Use foreign keys and constraints
* Use indexes for performance
* Avoid N+1 queries
* Use pagination (`LIMIT`, `OFFSET`)

---

### 6.4 Transactions

* Use transactions for critical operations

```
await prisma.$transaction([
  prisma.user.update(...),
  prisma.order.create(...)
]);
```

---

### 6.5 Migrations

* Use migration tools (Prisma / Sequelize CLI)
* Never modify production DB manually

---

### 6.6 Security (SQL)

* Prevent SQL injection (use ORM / parameterized queries)
* Avoid raw queries unless necessary

---

### 6.7 Hybrid Database Strategy

* MongoDB → flexible/unstructured data
* MySQL → relational/transactional data

---

## 7. API Design Standards

* RESTful APIs
* Versioning (`/api/v1`)
* Proper HTTP status codes

| Code | Meaning      |
| ---- | ------------ |
| 200  | OK           |
| 201  | Created      |
| 400  | Bad Request  |
| 401  | Unauthorized |
| 404  | Not Found    |
| 500  | Server Error |

---

## 8. Security Best Practices

* JWT authentication
* Password hashing (bcrypt)
* Proper CORS setup
* Use `.env` for secrets
* Input sanitization

---

## 9. Logging & Monitoring

* Use winston / pino
* Log errors and events
* Avoid sensitive data in logs

---

## 10. Testing

* Unit tests (Jest / Mocha)
* API testing (Supertest)
* Maintain ≥ 70% coverage

---

## 11. Performance

* Lazy loading (React)
* Optimize assets
* Use caching (Redis)
* Optimize DB queries

---

## 12. Git Standards

* Use meaningful commits:

```
feat: add user login
fix: resolve token issue
refactor: optimize API logic
```

* Use feature branches
* Follow PR review process

---

## 13. Code Quality Tools

* ESLint
* Prettier
* Husky (pre-commit hooks)

---

## 14. Environment Management

* Use `.env` files
* Do not commit secrets
* Separate configs (dev/staging/prod)

---

## 15. Documentation

* Swagger/OpenAPI for APIs
* Maintain README.md
* Include setup instructions

---

## 16. Best Practices Summary

* Keep code modular and reusable
* Separate concerns (UI, logic, data)
* Use MongoDB + SQL appropriately
* Follow consistent structure and naming
* Write testable and maintainable code

---
