/**
 * @module services/architecture-generator
 *
 * Scaffolds a clean-architecture directory structure under `src/` for a named
 * feature.  Creates four layers:
 *
 *   Domain        — pure business entities, no framework dependencies
 *   Application   — use cases, ports (repository interfaces)
 *   Infrastructure — concrete repository implementations
 *   UI            — service composition / entry point for the feature
 *
 * Files are written only when they do not already exist, making the generator
 * safe to re-run without overwriting manual edits.
 */

import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts text to a URL-safe kebab-case slug (max 50 chars).
 *
 * @param {string} text
 * @returns {string}
 */
function toSlug(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

/**
 * Converts a kebab-case slug to PascalCase.
 *
 * @param {string} slug  e.g. "employee-management"
 * @returns {string}     e.g. "EmployeeManagement"
 */
function toPascal(slug = "") {
  return String(slug)
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

/**
 * Creates a directory (and all parents) if it does not exist.
 *
 * @param {string} dirPath
 */
function mkdirp(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Writes `content` to `filePath` only if the file does not already exist.
 * Ensures the parent directory exists first.
 *
 * @param {string} filePath
 * @param {string} content
 * @returns {boolean}  `true` if the file was created, `false` if it already existed
 */
function writeIfMissing(filePath, content) {
  if (fs.existsSync(filePath)) return false;
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// File templates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {{ Pascal: string }} opts
 * @returns {string}
 */
function domainEntity({ Pascal }) {
  return `/**
 * ${Pascal} — Domain Entity
 * Pure business logic — no framework or infrastructure dependencies.
 * @layer Domain
 */
export class ${Pascal} {
  constructor({ id, name, createdAt, updatedAt }) {
    if (!id) throw new Error("${Pascal}.id is required");
    if (!name) throw new Error("${Pascal}.name is required");
    this.id = String(id);
    this.name = String(name);
    this.createdAt = createdAt ? new Date(createdAt) : new Date();
    this.updatedAt = updatedAt ? new Date(updatedAt) : new Date();
  }

  /**
   * Renames the entity, updating the timestamp.
   * @param {string} nextName
   * @returns {this}
   */
  rename(nextName) {
    if (!nextName || !String(nextName).trim()) {
      throw new Error("${Pascal}.name is required");
    }
    this.name = String(nextName).trim();
    this.updatedAt = new Date();
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
`;
}

/** @returns {string} */
function domainErrors() {
  return `/**
 * Domain-layer error types.
 * Throw these from use cases so the UI / API layer can handle them uniformly.
 */

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message = "Validation error") {
    super(message);
    this.name = "ValidationError";
  }
}
`;
}

/**
 * @param {{ Pascal: string }} opts
 * @returns {string}
 */
function repositoryPort({ Pascal }) {
  return `/**
 * ${Pascal}RepositoryPort — Abstract repository interface.
 * Implement this in the Infrastructure layer; inject into use cases.
 * @layer Application > Ports
 */
export class ${Pascal}RepositoryPort {
  /** @returns {Promise<${Pascal}[]>} */
  async list() {
    throw new Error("${Pascal}RepositoryPort.list not implemented");
  }

  /**
   * @param {${Pascal}} entity
   * @returns {Promise<${Pascal}>}
   */
  async create(entity) {
    throw new Error("${Pascal}RepositoryPort.create not implemented");
  }
}
`;
}

/**
 * @param {{ Pascal: string, slug: string }} opts
 * @returns {string}
 */
function createUseCase({ Pascal, slug }) {
  return `import crypto from "crypto";
import { ${Pascal} } from "../../../domain/${slug}/${Pascal}.js";
import { ValidationError } from "../../../domain/${slug}/errors.js";

/**
 * Create${Pascal} — Use Case
 * Validates input and persists a new ${Pascal} entity.
 * @layer Application > Use Cases
 */
export class Create${Pascal} {
  /** @param {import("../ports/${Pascal}RepositoryPort.js").${Pascal}RepositoryPort} repository */
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * @param {{ name: string }} input
   * @returns {Promise<object>}  Plain JSON representation of the created entity
   */
  async execute(input) {
    const name = input?.name ? String(input.name).trim() : "";
    if (!name) throw new ValidationError("name is required");

    const entity = new ${Pascal}({ id: crypto.randomUUID(), name });
    const created = await this.repository.create(entity);
    return created.toJSON ? created.toJSON() : created;
  }
}
`;
}

/**
 * @param {{ Pascal: string }} opts
 * @returns {string}
 */
function listUseCase({ Pascal }) {
  return `/**
 * List${Pascal} — Use Case
 * Returns all ${Pascal} entities as plain JSON objects.
 * @layer Application > Use Cases
 */
export class List${Pascal} {
  /** @param {import("../ports/${Pascal}RepositoryPort.js").${Pascal}RepositoryPort} repository */
  constructor(repository) {
    this.repository = repository;
  }

  /** @returns {Promise<object[]>} */
  async execute() {
    const items = await this.repository.list();
    return items.map((i) => (i?.toJSON ? i.toJSON() : i));
  }
}
`;
}

/**
 * @param {{ Pascal: string, slug: string }} opts
 * @returns {string}
 */
function inMemoryRepo({ Pascal, slug }) {
  return `import { ${Pascal} } from "../../domain/${slug}/${Pascal}.js";
import { ${Pascal}RepositoryPort } from "../../application/${slug}/ports/${Pascal}RepositoryPort.js";

/**
 * InMemory${Pascal}Repository — In-memory repository (for dev / testing).
 * Replace with a real HTTP / DB adapter in production.
 * @layer Infrastructure
 */
export class InMemory${Pascal}Repository extends ${Pascal}RepositoryPort {
  /** @param {Array<{id:string,name:string}>} [seed] */
  constructor(seed = []) {
    super();
    this.items = seed.map((s) => (s instanceof ${Pascal} ? s : new ${Pascal}(s)));
  }

  async list() {
    return [...this.items];
  }

  /** @param {${Pascal}} entity */
  async create(entity) {
    const e = entity instanceof ${Pascal} ? entity : new ${Pascal}(entity);
    this.items.push(e);
    return e;
  }
}
`;
}

/**
 * @param {{ Pascal: string, slug: string }} opts
 * @returns {string}
 */
function uiService({ Pascal, slug }) {
  return `import { InMemory${Pascal}Repository } from "../../infrastructure/${slug}/InMemory${Pascal}Repository.js";
import { Create${Pascal} } from "../../application/${slug}/use-cases/Create${Pascal}.js";
import { List${Pascal} } from "../../application/${slug}/use-cases/List${Pascal}.js";

/**
 * create${Pascal}Service — Composes the repository and use cases for the UI layer.
 * Swap out InMemory${Pascal}Repository for a real adapter when connecting a back-end.
 * @layer UI
 *
 * @returns {{ create: Create${Pascal}, list: List${Pascal} }}
 */
export function create${Pascal}Service() {
  const repository = new InMemory${Pascal}Repository();
  return {
    create: new Create${Pascal}(repository),
    list: new List${Pascal}(repository),
  };
}
`;
}

/**
 * @param {{ Pascal: string, slug: string }} opts
 * @returns {string}
 */
function uiIndex({ Pascal, slug }) {
  return `export { create${Pascal}Service } from "./${Pascal}Service.js";

/** Default route path for this feature. */
export const route = "/${slug}";
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ArchitectureGenerator
// ─────────────────────────────────────────────────────────────────────────────

export class ArchitectureGenerator {
  /**
   * Generates a clean-architecture directory structure under `{rootDir}/src/`.
   *
   * @param {{ featureName: string, rootDir?: string }} options
   * @returns {{ featureName: string, slug: string, createdAt: string, structure: { directories: string[], files: Array<{path:string,created:boolean}> } }}
   * @throws {Error} if `featureName` is missing
   */
  generate({ featureName, rootDir = process.cwd() }) {
    if (!featureName) throw new Error("featureName is required");

    const slug = toSlug(featureName);
    const Pascal = toPascal(slug);
    const srcRoot = path.join(rootDir, "src");

    const directories = [
      path.join(srcRoot, "domain", slug),
      path.join(srcRoot, "application", slug),
      path.join(srcRoot, "application", slug, "use-cases"),
      path.join(srcRoot, "application", slug, "ports"),
      path.join(srcRoot, "infrastructure", slug),
      path.join(srcRoot, "ui", slug),
    ];
    directories.forEach(mkdirp);

    const files = [];
    const addFile = (filePath, content) => {
      const created = writeIfMissing(filePath, content);
      files.push({ path: filePath, created });
    };

    // Domain layer
    addFile(path.join(srcRoot, "domain", slug, `${Pascal}.js`), domainEntity({ Pascal }));
    addFile(path.join(srcRoot, "domain", slug, "errors.js"), domainErrors());

    // Application layer — ports
    addFile(
      path.join(srcRoot, "application", slug, "ports", `${Pascal}RepositoryPort.js`),
      repositoryPort({ Pascal, slug })
    );

    // Application layer — use cases
    addFile(
      path.join(srcRoot, "application", slug, "use-cases", `Create${Pascal}.js`),
      createUseCase({ Pascal, slug })
    );
    addFile(
      path.join(srcRoot, "application", slug, "use-cases", `List${Pascal}.js`),
      listUseCase({ Pascal, slug })
    );

    // Infrastructure layer
    addFile(
      path.join(srcRoot, "infrastructure", slug, `InMemory${Pascal}Repository.js`),
      inMemoryRepo({ Pascal, slug })
    );

    // UI layer
    addFile(path.join(srcRoot, "ui", slug, `${Pascal}Service.js`), uiService({ Pascal, slug }));
    addFile(path.join(srcRoot, "ui", slug, "index.js"), uiIndex({ Pascal, slug }));

    return {
      featureName,
      slug,
      createdAt: new Date().toISOString(),
      structure: { directories, files },
    };
  }
}

/** Singleton instance used by the workflow and MCP handlers. */
export const architectureGenerator = new ArchitectureGenerator();
