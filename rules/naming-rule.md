# Naming Rules

> Claude MUST follow these naming conventions when generating code, files, and folders.

## File & Folder Naming

| Type | Convention | Example |
|------|-----------|---------|
| Domain entity | `PascalCase.js` | `Employee.js` |
| Repository interface | `I{Name}Repository.js` | `IEmployeeRepository.js` |
| Repository impl | `{Name}Repository.js` | `EmployeeRepository.js` |
| Use case | `{Verb}{Name}UseCase.js` | `CreateEmployeeUseCase.js` |
| DTO | `{Name}DTO.js` | `EmployeeDTO.js` |
| React page | `{Name}Page.jsx` | `EmployeePage.jsx` |
| React component | `{Name}.jsx` | `EmployeeList.jsx` |
| React hook | `use{Name}.js` | `useEmployees.js` |
| Utility / helper | `camelCase.js` | `dateUtils.js` |
| Test file | `{filename}.test.js` | `Employee.test.js` |
| Config file | `camelCase.js` | `appConfig.js` |
| Constant file | `SCREAMING_SNAKE_CASE.js` | `API_CONSTANTS.js` |

## Variable Naming

```js
// ✅ Boolean variables: is/has/can/should prefix
const isLoading = true;
const hasError = false;
const canEdit = user.role === "admin";
const shouldRedirect = !isAuthenticated;

// ✅ Arrays: plural nouns
const employees = [];
const selectedIds = [];

// ✅ Objects/instances: noun or noun phrase (camelCase)
const employeeRecord = {};
const currentUser = {};

// ✅ Constants: SCREAMING_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const DEFAULT_PAGE_SIZE = 20;
const API_BASE_URL = process.env.API_URL;

// ❌ Avoid abbreviations (except universally accepted ones)
const emp = {};       // ❌ — use: employee
const mgr = {};       // ❌ — use: manager
const res = {};       // ⚠️  acceptable only for HTTP responses
const err = {};       // ⚠️  acceptable in catch blocks
const id = "";        // ✅ universally understood
const url = "";       // ✅ universally understood
const api = {};       // ✅ universally understood
```

## Function Naming

```js
// ✅ Functions: verb + noun (camelCase)
getEmployee(id)
createEmployee(data)
updateEmployeeStatus(id, status)
deleteEmployee(id)
validateEmployeeData(data)

// ✅ Event handlers: handle + Event
handleSubmit(event)
handleClick(event)
handleInputChange(event)

// ✅ Async functions: same as sync — async is implied by context
async fetchEmployees()
async saveEmployee(data)

// ❌ Avoid vague names
doStuff()         // ❌
process(data)     // ❌ — what process?
handleData(x)     // ❌ — handle what data?
```

## Class Naming

```js
// ✅ Classes: PascalCase nouns
class Employee {}
class EmployeeRepository {}
class CreateEmployeeUseCase {}
class ProductOwnerAgent {}

// ✅ Abstract/interface classes: I prefix
class IEmployeeRepository {}
class INotificationService {}

// ❌ Avoid
class employeeManager {}   // ❌ not PascalCase
class ManageEmployee {}    // ❌ verb-first
```

## React Component Naming

```jsx
// ✅ Components: PascalCase
function EmployeeList() {}
function EmployeeForm() {}
function EmployeePage() {}

// ✅ Props: camelCase, descriptive
<EmployeeList
  employees={employees}          // noun, plural
  isLoading={isLoading}          // boolean: is prefix
  onEmployeeSelect={handleSelect} // event handler: on prefix
  maxItems={50}                   // descriptive
/>

// ✅ Custom hooks: useCamelCase
function useEmployees() {}
function useEmployeeForm(initialValues) {}
```

## Branch Naming

```
feature/{task-id}-{kebab-case-task-name}
```

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/{id}-{name}` | `feature/123-add-employee-form` |
| Bug fix | `bugfix/{id}-{name}` | `bugfix/456-fix-login-redirect` |
| Hotfix | `hotfix/{id}-{name}` | `hotfix/789-patch-security-header` |
| Chore | `chore/{name}` | `chore/update-dependencies` |

Rules:
- All lowercase
- Hyphens as separators (no underscores, no spaces)
- Task ID always included for feature/bugfix/hotfix
- Max 60 characters total

## Commit Message Naming

```
{type}: {description} [#{task-id}]
```

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructure (no behavior change) |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Build/config/tooling changes |
| `style` | Formatting only |

Examples:
```
feat: add employee creation form [#123]
fix: resolve login redirect loop [#456]
test: add unit tests for EmployeeUseCase [#123]
docs: update API setup instructions
```

## Database / API Naming

- **API endpoints:** `kebab-case`, plural nouns: `/api/employees`, `/api/work-items`
- **JSON fields:** `camelCase`: `{ firstName, lastName, createdAt }`
- **Database columns:** `snake_case`: `first_name`, `created_at`
- **Environment variables:** `SCREAMING_SNAKE_CASE`: `ADO_PAT`, `FIGMA_TOKEN`
