import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * Architect Agent
 * Responsibilities:
 *   - Generate clean architecture folder structure
 *   - Create domain/application/infrastructure/ui layers
 *   - Enforce architecture rules from /rules/architecture.md
 *   - Validate that generated code follows structural patterns
 */

export class ArchitectAgent {
  constructor() {
    this.name = "ArchitectAgent";
    this.role = "Software Architect";
  }

  /**
   * Generate a clean architecture scaffold for a feature
   * @param {string} featureName  e.g. "employee-management"
   * @param {string} rootDir      project root directory (default: cwd)
   */
  generateArchitecture(featureName, rootDir = process.cwd()) {
    console.error(`[${this.name}] Generating architecture for: ${featureName}`);

    const slug = this.toSlug(featureName);
    const structure = this.buildStructure(slug, rootDir);

    // Create directories
    for (const dir of structure.directories) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create placeholder files with proper templates
    for (const file of structure.files) {
      if (!fs.existsSync(file.path)) {
        fs.writeFileSync(file.path, file.content, "utf8");
      }
    }

    return {
      agent: this.name,
      featureName,
      slug,
      structure,
      message: `✅ Architecture scaffold created for "${featureName}"`,
    };
  }

  buildStructure(slug, rootDir) {
    const src = path.join(rootDir, "src");
    const Pascal = this.toPascal(slug);

    const directories = [
      path.join(src, "domain", slug),
      path.join(src, "application", slug, "use-cases"),
      path.join(src, "application", slug, "dtos"),
      path.join(src, "infrastructure", slug),
      path.join(src, "ui", slug, "components"),
      path.join(src, "ui", slug, "pages"),
    ];

    const files = [
      // Domain layer — pure business logic, no dependencies
      {
        path: path.join(src, "domain", slug, `${Pascal}.js`),
        content: this.domainEntityTemplate(Pascal, slug),
      },
      {
        path: path.join(src, "domain", slug, `I${Pascal}Repository.js`),
        content: this.repositoryInterfaceTemplate(Pascal),
      },

      // Application layer — use cases / orchestration
      {
        path: path.join(src, "application", slug, "use-cases", `Get${Pascal}UseCase.js`),
        content: this.useCaseTemplate(`Get${Pascal}`, Pascal),
      },
      {
        path: path.join(src, "application", slug, "use-cases", `Create${Pascal}UseCase.js`),
        content: this.useCaseTemplate(`Create${Pascal}`, Pascal),
      },
      {
        path: path.join(src, "application", slug, "dtos", `${Pascal}DTO.js`),
        content: this.dtoTemplate(Pascal),
      },

      // Infrastructure layer — DB, API adapters
      {
        path: path.join(src, "infrastructure", slug, `${Pascal}Repository.js`),
        content: this.repositoryImplTemplate(Pascal),
      },

      // UI layer — React components
      {
        path: path.join(src, "ui", slug, "pages", `${Pascal}Page.jsx`),
        content: this.pageTemplate(Pascal, slug),
      },
      {
        path: path.join(src, "ui", slug, "components", `${Pascal}List.jsx`),
        content: this.listComponentTemplate(Pascal, slug),
      },
      {
        path: path.join(src, "ui", slug, "components", `${Pascal}Form.jsx`),
        content: this.formComponentTemplate(Pascal, slug),
      },

      // Tests
      {
        path: path.join(src, "domain", slug, `${Pascal}.test.js`),
        content: this.domainTestTemplate(Pascal, slug),
      },
      {
        path: path.join(src, "application", slug, "use-cases", `Get${Pascal}UseCase.test.js`),
        content: this.useCaseTestTemplate(`Get${Pascal}`, Pascal),
      },
    ];

    return { directories, files };
  }

  // ─── Templates ──────────────────────────────────────────────

  domainEntityTemplate(Pascal, slug) {
    return `/**
 * ${Pascal} Domain Entity
 * Pure business logic — no framework dependencies.
 * @layer Domain
 */
export class ${Pascal} {
  constructor({ id, name, createdAt = new Date(), updatedAt = new Date() }) {
    this.id = id;
    this.name = name;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Validate business rules
   * @throws {Error} if entity state is invalid
   */
  validate() {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error("${Pascal} name is required");
    }
    if (this.name.length > 255) {
      throw new Error("${Pascal} name must be 255 characters or less");
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
`;
  }

  repositoryInterfaceTemplate(Pascal) {
    return `/**
 * I${Pascal}Repository — Repository Interface (Contract)
 * Define the contract; implement in infrastructure layer.
 * @layer Domain
 */
export class I${Pascal}Repository {
  /** @returns {Promise<${Pascal}[]>} */
  async findAll() { throw new Error("Not implemented"); }

  /** @returns {Promise<${Pascal}|null>} */
  async findById(id) { throw new Error("Not implemented"); }

  /** @returns {Promise<${Pascal}>} */
  async save(entity) { throw new Error("Not implemented"); }

  /** @returns {Promise<void>} */
  async deleteById(id) { throw new Error("Not implemented"); }
}
`;
  }

  useCaseTemplate(UseCaseName, Pascal) {
    return `/**
 * ${UseCaseName} Use Case
 * Orchestrates domain logic. No HTTP/DB knowledge here.
 * @layer Application
 */
export class ${UseCaseName}UseCase {
  /** @param {import('../../domain/${UseCaseName.replace("Get","").replace("Create","")}/I${Pascal}Repository').I${Pascal}Repository} repository */
  constructor(repository) {
    this.repository = repository;
  }

  async execute(input) {
    // TODO: implement use case logic
    // 1. Validate input
    // 2. Call repository
    // 3. Return result / throw domain error
    throw new Error("${UseCaseName}UseCase.execute() not implemented");
  }
}
`;
  }

  dtoTemplate(Pascal) {
    return `/**
 * ${Pascal}DTO — Data Transfer Object
 * Used to validate and shape data crossing application boundaries.
 * @layer Application
 */
export class ${Pascal}DTO {
  constructor({ id, name }) {
    this.id = id;
    this.name = name;
  }

  static fromEntity(entity) {
    return new ${Pascal}DTO({ id: entity.id, name: entity.name });
  }

  static fromRequest(body) {
    return new ${Pascal}DTO({ id: body.id, name: body.name });
  }
}
`;
  }

  repositoryImplTemplate(Pascal) {
    return `import { I${Pascal}Repository } from "../../domain/${Pascal.toLowerCase()}/I${Pascal}Repository.js";

/**
 * ${Pascal}Repository — Concrete Implementation
 * Adapts domain interface to actual data source (REST API, DB, etc.)
 * @layer Infrastructure
 */
export class ${Pascal}Repository extends I${Pascal}Repository {
  constructor(httpClient) {
    super();
    this.client = httpClient;
  }

  async findAll() {
    const res = await this.client.get("/${Pascal.toLowerCase()}s");
    return res.data;
  }

  async findById(id) {
    const res = await this.client.get(\`/${Pascal.toLowerCase()}s/\${id}\`);
    return res.data;
  }

  async save(entity) {
    if (entity.id) {
      const res = await this.client.put(\`/${Pascal.toLowerCase()}s/\${entity.id}\`, entity);
      return res.data;
    }
    const res = await this.client.post("/${Pascal.toLowerCase()}s", entity);
    return res.data;
  }

  async deleteById(id) {
    await this.client.delete(\`/${Pascal.toLowerCase()}s/\${id}\`);
  }
}
`;
  }

  pageTemplate(Pascal, slug) {
    return `import React from "react";
import { ${Pascal}List } from "../components/${Pascal}List";
import { ${Pascal}Form } from "../components/${Pascal}Form";

/**
 * ${Pascal}Page — Top-level page component
 * @layer UI
 */
export default function ${Pascal}Page() {
  return (
    <div className="${slug}-page">
      <header>
        <h1>${Pascal}</h1>
      </header>
      <main>
        <${Pascal}List />
        <${Pascal}Form />
      </main>
    </div>
  );
}
`;
  }

  listComponentTemplate(Pascal, slug) {
    return `import React, { useEffect, useState } from "react";

/**
 * ${Pascal}List — Displays a list of ${Pascal} items
 * @layer UI > Components
 */
export function ${Pascal}List() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // TODO: wire up to use case / service
    setLoading(false);
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (items.length === 0) return <div>No ${slug} items found.</div>;

  return (
    <ul className="${slug}-list">
      {items.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
`;
  }

  formComponentTemplate(Pascal, slug) {
    return `import React, { useState } from "react";

/**
 * ${Pascal}Form — Create / Edit form for ${Pascal}
 * @layer UI > Components
 */
export function ${Pascal}Form({ onSubmit, initialValues = {} }) {
  const [values, setValues] = useState({ name: "", ...initialValues });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setValues((v) => ({ ...v, [e.target.name]: e.target.value }));
  };

  const validate = () => {
    const errs = {};
    if (!values.name.trim()) errs.name = "Name is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit?.(values);
  };

  return (
    <form onSubmit={handleSubmit} className="${slug}-form">
      <div>
        <label htmlFor="${slug}-name">Name</label>
        <input
          id="${slug}-name"
          name="name"
          value={values.name}
          onChange={handleChange}
        />
        {errors.name && <span className="error">{errors.name}</span>}
      </div>
      <button type="submit">Save</button>
    </form>
  );
}
`;
  }

  domainTestTemplate(Pascal, slug) {
    return `import { ${Pascal} } from "./${Pascal}.js";

describe("${Pascal} Domain Entity", () => {
  describe("constructor", () => {
    it("creates a valid ${Pascal} entity", () => {
      const entity = new ${Pascal}({ id: "1", name: "Test ${Pascal}" });
      expect(entity.id).toBe("1");
      expect(entity.name).toBe("Test ${Pascal}");
    });
  });

  describe("validate()", () => {
    it("passes for valid entity", () => {
      const entity = new ${Pascal}({ id: "1", name: "Valid" });
      expect(() => entity.validate()).not.toThrow();
    });

    it("throws when name is empty", () => {
      const entity = new ${Pascal}({ id: "1", name: "" });
      expect(() => entity.validate()).toThrow("${Pascal} name is required");
    });

    it("throws when name exceeds 255 chars", () => {
      const entity = new ${Pascal}({ id: "1", name: "x".repeat(256) });
      expect(() => entity.validate()).toThrow("255 characters or less");
    });
  });

  describe("toJSON()", () => {
    it("serializes correctly", () => {
      const entity = new ${Pascal}({ id: "1", name: "Test" });
      const json = entity.toJSON();
      expect(json).toMatchObject({ id: "1", name: "Test" });
    });
  });
});
`;
  }

  useCaseTestTemplate(UseCaseName, Pascal) {
    return `import { ${UseCaseName}UseCase } from "./${UseCaseName}UseCase.js";

describe("${UseCaseName}UseCase", () => {
  let mockRepository;
  let useCase;

  beforeEach(() => {
    mockRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      deleteById: jest.fn(),
    };
    useCase = new ${UseCaseName}UseCase(mockRepository);
  });

  it("executes successfully", async () => {
    // TODO: implement test
    expect(useCase).toBeDefined();
  });
});
`;
  }

  // ─── Utilities ────────────────────────────────────────────────
  toSlug(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  toPascal(slug) {
    return slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");
  }
}

export default new ArchitectAgent();
