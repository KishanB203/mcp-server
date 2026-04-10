# Backend Coding Standards (Node.js + Express - Clean Architecture)

## 1. General Principles
- Follow clean code practices
- Maintain separation of concerns
- Use layered architecture (Clean Architecture)
- Keep business logic independent from frameworks

---

## 2. Project Structure (Clean Architecture)
```
src/
  application/
    ports/repository/
    usecases/
  domain/
    entities/schema/
    models/
  infrastructure/
    config/
    helper/
    logger/
    orm/typeorm/
    repositories/
    webserver/express/
  interface/
    controller/
    routes/
```

---

## 3. Layer Responsibilities

### Application Layer
- Contains business use cases
- Defines interfaces (ports)
- No dependency on external frameworks

### Domain Layer
- Core business logic
- Entities and models
- No external dependencies

### Infrastructure Layer
- Database, ORM (TypeORM)
- External services
- Logging, configs, helpers
- Implements repository interfaces

### Interface Layer
- Controllers (handle requests/responses)
- Routes (API endpoints)

---

## 4. Naming Conventions
- camelCase → variables/functions
- PascalCase → classes
- UPPER_CASE → constants

---

## 5. Architecture Rules
- Controllers should be thin
- Usecases contain business logic
- Repositories implement data access
- Dependency Injection preferred

---

## 6. Routing
- Keep routes RESTful

Example:
```
GET    /users
POST   /users
GET    /users/:id
PUT    /users/:id
DELETE /users/:id
```

---

## 7. Middleware
- Authentication
- Logging
- Validation

---

## 8. Validation
- Use Joi / express-validator
- Validate request body, params, query

---

## 9. Error Handling
- Centralized error handler
- Standard response format:

```
{
  success: false,
  message: "Error message"
}
```

---

## 10. API Design
- RESTful conventions
- Versioning (/api/v1)
- Proper HTTP status codes

---

## 11. Security
- JWT authentication
- bcrypt password hashing
- Use .env for secrets
- Enable CORS
- Sanitize inputs

---

## 12. Logging & Monitoring
- Use winston / pino
- Log errors and events
- Avoid sensitive data logging

---

## 13. Testing
- Unit tests (Jest / Mocha)
- API testing (Supertest)
- Maintain ≥70% coverage

---

## 14. Performance
- Optimize API responses
- Use caching (Redis)
- Avoid unnecessary DB calls

---

## 15. Git Standards
- Commit format:
  feat: add feature
  fix: fix issue
  refactor: improve code

- Use feature branches
- PR review process

---

## 16. Environment Management
- Use .env files
- Separate configs (dev/staging/prod)

---

## 17. Documentation
- Swagger/OpenAPI
- Maintain README

---

## 18. Best Practices Summary
- Follow Clean Architecture strictly
- Keep domain independent
- Usecases drive application logic
- Infrastructure handles external concerns
