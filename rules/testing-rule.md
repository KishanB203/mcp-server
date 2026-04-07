# Testing Rules

> Claude MUST include tests when generating code. Every new module needs a corresponding test file.

## Testing Stack

- **Test runner:** Jest
- **React testing:** React Testing Library
- **Mocking:** Jest built-in mocks (`jest.fn()`, `jest.mock()`)
- **Coverage target:** 80% minimum (lines, branches, functions)

## Test File Location & Naming

Place test files **alongside** the source file they test:

```
src/domain/employee/
├── Employee.js
└── Employee.test.js          ← same folder

src/application/employee/use-cases/
├── CreateEmployeeUseCase.js
└── CreateEmployeeUseCase.test.js
```

Naming: `{SourceFile}.test.js` or `{SourceFile}.spec.js`

## Test Structure — AAA Pattern

Every test follows **Arrange → Act → Assert**:

```js
it("creates an employee with valid data", () => {
  // Arrange
  const data = { id: "1", name: "Alice", department: "Engineering" };

  // Act
  const employee = new Employee(data);

  // Assert
  expect(employee.name).toBe("Alice");
  expect(employee.department).toBe("Engineering");
});
```

## Domain Layer Tests

Domain tests are **pure unit tests** — no mocking needed.

```js
describe("Employee", () => {
  describe("constructor", () => {
    it("creates a valid employee", () => {
      const emp = new Employee({ id: "1", name: "Alice" });
      expect(emp.id).toBe("1");
      expect(emp.name).toBe("Alice");
    });
  });

  describe("validate()", () => {
    it("passes for valid employee", () => {
      const emp = new Employee({ id: "1", name: "Alice" });
      expect(() => emp.validate()).not.toThrow();
    });

    it("throws when name is empty", () => {
      const emp = new Employee({ id: "1", name: "" });
      expect(() => emp.validate()).toThrow("name is required");
    });

    it("throws when name exceeds max length", () => {
      const emp = new Employee({ id: "1", name: "x".repeat(256) });
      expect(() => emp.validate()).toThrow("255 characters");
    });
  });
});
```

## Application Layer Tests (Use Cases)

Use cases are tested with **mocked repositories**:

```js
describe("CreateEmployeeUseCase", () => {
  let mockRepository;
  let useCase;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      deleteById: jest.fn(),
    };
    useCase = new CreateEmployeeUseCase(mockRepository);
  });

  it("saves a valid employee and returns it", async () => {
    const input = { name: "Alice", department: "Engineering" };
    const saved = { id: "1", ...input };
    mockRepository.save.mockResolvedValue(saved);

    const result = await useCase.execute(input);

    expect(mockRepository.save).toHaveBeenCalledTimes(1);
    expect(result.name).toBe("Alice");
  });

  it("throws when name is missing", async () => {
    await expect(useCase.execute({ name: "" })).rejects.toThrow("name is required");
    expect(mockRepository.save).not.toHaveBeenCalled();
  });
});
```

## Infrastructure Layer Tests

Use **integration tests** or mock HTTP clients:

```js
import axios from "axios";
jest.mock("axios");

describe("EmployeeRepository", () => {
  it("calls the correct endpoint on findAll()", async () => {
    axios.get.mockResolvedValue({ data: [{ id: "1", name: "Alice" }] });
    const repo = new EmployeeRepository(axios);

    const result = await repo.findAll();

    expect(axios.get).toHaveBeenCalledWith("/employees");
    expect(result).toHaveLength(1);
  });
});
```

## UI / React Component Tests

```js
import { render, screen, fireEvent } from "@testing-library/react";

describe("EmployeeForm", () => {
  it("renders name input", () => {
    render(<EmployeeForm onSubmit={jest.fn()} />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });

  it("calls onSubmit with form data", () => {
    const onSubmit = jest.fn();
    render(<EmployeeForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Alice" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith({ name: "Alice" });
  });

  it("shows validation error for empty name", () => {
    render(<EmployeeForm onSubmit={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });
});
```

## Rules Summary

| Rule | Requirement |
|------|-------------|
| Every new source file | Must have a `.test.js` file |
| Domain entities | Min 3 tests: valid case, missing required field, boundary |
| Use cases | Min 3 tests: success path, validation failure, repository error |
| React components | Min 3 tests: renders, user interaction, error/empty state |
| Test isolation | Each test must be independent — no shared mutable state |
| Mocking | Never call real APIs or DB in unit tests |
| `console.log` | Not allowed in test files |
| `describe` blocks | Group by class/function name |
| `it` descriptions | Start with a verb: "creates", "throws", "returns", "renders" |

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific file
npm test -- Employee.test.js

# Run in watch mode
npm run test:watch
```

## Coverage Thresholds (jest.config.js)

```js
coverageThreshold: {
  global: {
    lines: 80,
    branches: 80,
    functions: 80,
    statements: 80,
  },
},
```
