# Architecture Rules

> Claude MUST follow this architecture when generating project structure and code.

## Overview

This project follows **Clean Architecture** (also known as Hexagonal or Onion Architecture).  
The goal: business logic is independent of frameworks, databases, and UI.

```
src/
├── domain/          ← Pure business logic. No dependencies on anything external.
├── application/     ← Use cases. Orchestrates domain. No HTTP/DB knowledge.
├── infrastructure/  ← Adapters: DB, REST clients, file system, third-party APIs.
└── ui/              ← React components, pages, hooks. No business logic here.
```

## Layer Rules (Dependency Direction)

```
UI → Application → Domain
Infrastructure → Application → Domain
```

- **Domain** must NEVER import from application, infrastructure, or UI.
- **Application** may import from domain only.
- **Infrastructure** may import from application and domain.
- **UI** may import from application (use cases/DTOs). Must NOT import directly from infrastructure.

## Layer Responsibilities

### Domain (`src/domain/`)

- Contains: Entities, Value Objects, Domain Events, Repository Interfaces.
- Zero external dependencies (no axios, no React, no DB drivers).
- All business rules and validations live here.
- Tests are pure unit tests — no mocking needed.

```
src/domain/employee/
├── Employee.js              ← Entity
├── IEmployeeRepository.js   ← Repository interface (contract)
└── Employee.test.js
```

### Application (`src/application/`)

- Contains: Use Cases, DTOs, Application Services.
- Depends on domain interfaces (never implementations).
- One use case = one user action (e.g., `CreateEmployeeUseCase`, `GetEmployeesUseCase`).
- No HTTP, no database queries, no React hooks.

```
src/application/employee/
├── use-cases/
│   ├── GetEmployeeUseCase.js
│   ├── CreateEmployeeUseCase.js
│   └── DeleteEmployeeUseCase.js
├── dtos/
│   └── EmployeeDTO.js
└── use-cases/*.test.js
```

### Infrastructure (`src/infrastructure/`)

- Contains: Concrete repository implementations, API clients, adapters.
- Implements domain repository interfaces.
- This is where axios, database drivers, and file I/O live.

```
src/infrastructure/employee/
└── EmployeeRepository.js    ← implements IEmployeeRepository
```

### UI (`src/ui/`)

- Contains: React pages, components, hooks, styles.
- Calls use cases or DTOs — never raw API endpoints directly.
- No business logic or validation — delegate to application layer.

```
src/ui/employee/
├── pages/
│   └── EmployeePage.jsx
└── components/
    ├── EmployeeList.jsx
    └── EmployeeForm.jsx
```

## File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Entity | `PascalCase.js` | `Employee.js` |
| Repository interface | `I{Name}Repository.js` | `IEmployeeRepository.js` |
| Repository impl | `{Name}Repository.js` | `EmployeeRepository.js` |
| Use case | `{Verb}{Name}UseCase.js` | `CreateEmployeeUseCase.js` |
| DTO | `{Name}DTO.js` | `EmployeeDTO.js` |
| React page | `{Name}Page.jsx` | `EmployeePage.jsx` |
| React component | `{Name}.jsx` (PascalCase) | `EmployeeList.jsx` |

## What to Avoid

- ❌ God classes/files that do everything
- ❌ Business logic in React components
- ❌ Direct database queries in UI layer
- ❌ Use cases that import axios or React
- ❌ Circular dependencies between layers
- ❌ Passing raw HTTP response objects between layers (map to DTOs first)
