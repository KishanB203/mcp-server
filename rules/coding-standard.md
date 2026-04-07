# Coding Standards

> Claude MUST follow these standards when generating any code for this project.

## General Principles

1. **Readability over cleverness** — Code is read more often than written. Prefer clear, explicit code.
2. **Single Responsibility** — Each function, class, and module does one thing well.
3. **DRY (Don't Repeat Yourself)** — Extract reusable logic into shared utilities.
4. **YAGNI (You Aren't Gonna Need It)** — Don't add code for hypothetical future use.
5. **Fail fast** — Validate inputs early and throw clear errors.

## JavaScript / Node.js Rules

### Imports
- Use ES Modules (`import`/`export`), never CommonJS `require()`.
- Group imports: (1) Node built-ins, (2) npm packages, (3) local modules.
- Import only what you use — no wildcard `import *` unless necessary.

### Variables
- Use `const` by default. Use `let` only when reassignment is needed. Never use `var`.
- Name booleans with `is`, `has`, `can`, `should` prefix: `isLoading`, `hasError`.
- Avoid abbreviations unless universally understood (`id`, `url`, `api`).

### Functions
- Maximum function length: **30 lines**. Extract if longer.
- Maximum parameters: **3**. Use an options object for more.
- Always use `async/await` over `.then()` chains.
- Always handle promise rejections — never fire-and-forget.

```js
// ✅ Good
async function createEmployee(options) {
  const { name, department, salary } = options;
  if (!name) throw new Error("Employee name is required");
  return repository.save({ name, department, salary });
}

// ❌ Bad
function createEmployee(n, d, s, cb) {
  repo.save(n, d, s).then(cb);
}
```

### Error Handling
- Always wrap async API calls in try/catch.
- Throw `Error` objects with descriptive messages — never throw strings.
- Log errors to `console.error()`, never `console.log()`.
- Remove all `console.log()` debug statements before committing.

### Objects & Arrays
- Use object destructuring: `const { id, name } = user;`
- Use array destructuring: `const [first, ...rest] = items;`
- Use spread for shallow copies: `const updated = { ...user, name };`
- Never mutate function parameters.

### Classes
- Use classes only for stateful agents/services. Prefer plain functions otherwise.
- Always define a constructor if the class has dependencies.
- Use private-by-convention prefix `_` for internal methods.

## React / JSX Rules (UI Layer)

- One component per file.
- Component file names are **PascalCase**: `EmployeeList.jsx`.
- Use functional components with hooks — no class components.
- Props must be destructured at the top of the component.
- Avoid inline object/function creation in JSX (causes re-renders).
- Always provide a `key` prop on list items.

```jsx
// ✅ Good
export function EmployeeList({ employees, onSelect }) {
  return (
    <ul>
      {employees.map((emp) => (
        <li key={emp.id} onClick={() => onSelect(emp)}>
          {emp.name}
        </li>
      ))}
    </ul>
  );
}

// ❌ Bad
export default function(props) {
  return <ul>{props.employees.map(e => <li>{e.name}</li>)}</ul>
}
```

## Comments

- Write comments for **why**, not **what**. Code explains what; comments explain intent.
- JSDoc for all exported functions:

```js
/**
 * Fetch an employee by ID
 * @param {string} id - The employee UUID
 * @returns {Promise<Employee>}
 * @throws {Error} if employee not found
 */
export async function getEmployee(id) { ... }
```

## Formatting

- Indentation: **2 spaces** (no tabs).
- Max line length: **100 characters**.
- Trailing newline at end of every file.
- Use Prettier defaults (single quotes, semicolons).

## Security

- Never hardcode credentials, tokens, or API keys — use environment variables.
- Sanitize all user input before use in queries or HTML.
- Never log sensitive data (passwords, tokens, PII).
