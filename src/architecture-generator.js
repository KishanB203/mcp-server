import fs from "fs";
import path from "path";

function toSlug(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function toPascal(slug = "") {
  return String(slug)
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeIfMissing(filePath, content) {
  if (fs.existsSync(filePath)) return false;
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
  return true;
}

function nowIso() {
  return new Date().toISOString();
}

export class ArchitectureGenerator {
  /**
   * Generates a clean-architecture structure under src/:
   *   domain/, application/, infrastructure/, ui/
   *
   * @param {{featureName:string, rootDir?:string}} options
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
    const addFile = (p, content) => {
      const created = writeIfMissing(p, content);
      files.push({ path: p, created });
    };

    addFile(
      path.join(srcRoot, "domain", slug, `${Pascal}.js`),
      domainEntity({ Pascal })
    );
    addFile(
      path.join(srcRoot, "domain", slug, `errors.js`),
      domainErrors()
    );
    addFile(
      path.join(srcRoot, "application", slug, "ports", `${Pascal}RepositoryPort.js`),
      repositoryPort({ Pascal, slug })
    );
    addFile(
      path.join(srcRoot, "application", slug, "use-cases", `Create${Pascal}.js`),
      createUseCase({ Pascal, slug })
    );
    addFile(
      path.join(srcRoot, "application", slug, "use-cases", `List${Pascal}.js`),
      listUseCase({ Pascal, slug })
    );
    addFile(
      path.join(srcRoot, "infrastructure", slug, `InMemory${Pascal}Repository.js`),
      inMemoryRepo({ Pascal, slug })
    );
    addFile(
      path.join(srcRoot, "ui", slug, `index.js`),
      uiIndex({ Pascal, slug })
    );
    addFile(
      path.join(srcRoot, "ui", slug, `${Pascal}Service.js`),
      uiService({ Pascal, slug })
    );

    return {
      featureName,
      slug,
      createdAt: nowIso(),
      structure: { directories, files },
    };
  }
}

export const architectureGenerator = new ArchitectureGenerator();

function domainEntity({ Pascal }) {
  return `export class ${Pascal} {
  constructor({ id, name, createdAt, updatedAt }) {
    if (!id) throw new Error("${Pascal}.id is required");
    if (!name) throw new Error("${Pascal}.name is required");
    this.id = String(id);
    this.name = String(name);
    this.createdAt = createdAt ? new Date(createdAt) : new Date();
    this.updatedAt = updatedAt ? new Date(updatedAt) : new Date();
  }

  rename(nextName) {
    if (!nextName || !String(nextName).trim()) throw new Error("${Pascal}.name is required");
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

function domainErrors() {
  return `export class NotFoundError extends Error {
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

function repositoryPort({ Pascal }) {
  return `export class ${Pascal}RepositoryPort {
  async list() {
    throw new Error("${Pascal}RepositoryPort.list not implemented");
  }

  async create(entity) {
    throw new Error("${Pascal}RepositoryPort.create not implemented");
  }
}
`;
}

function createUseCase({ Pascal, slug }) {
  return `import crypto from "crypto";
import { ${Pascal} } from "../../../domain/${slug}/${Pascal}.js";
import { ValidationError } from "../../../domain/${slug}/errors.js";

export class Create${Pascal} {
  constructor(repository) {
    this.repository = repository;
  }

  async execute(input) {
    const name = input?.name ? String(input.name).trim() : "";
    if (!name) throw new ValidationError("name is required");

    const entity = new ${Pascal}({
      id: crypto.randomUUID(),
      name,
    });

    const created = await this.repository.create(entity);
    return created.toJSON ? created.toJSON() : created;
  }
}
`;
}

function listUseCase({ Pascal, slug }) {
  return `export class List${Pascal} {
  constructor(repository) {
    this.repository = repository;
  }

  async execute() {
    const items = await this.repository.list();
    return items.map((i) => (i?.toJSON ? i.toJSON() : i));
  }
}
`;
}

function inMemoryRepo({ Pascal, slug }) {
  return `import { ${Pascal} } from "../../domain/${slug}/${Pascal}.js";
import { ${Pascal}RepositoryPort } from "../../application/${slug}/ports/${Pascal}RepositoryPort.js";

export class InMemory${Pascal}Repository extends ${Pascal}RepositoryPort {
  constructor(seed = []) {
    super();
    this.items = seed.map((s) => (s instanceof ${Pascal} ? s : new ${Pascal}(s)));
  }

  async list() {
    return [...this.items];
  }

  async create(entity) {
    const e = entity instanceof ${Pascal} ? entity : new ${Pascal}(entity);
    this.items.push(e);
    return e;
  }
}
`;
}

function uiService({ Pascal, slug }) {
  return `import { InMemory${Pascal}Repository } from "../../infrastructure/${slug}/InMemory${Pascal}Repository.js";
import { Create${Pascal} } from "../../application/${slug}/use-cases/Create${Pascal}.js";
import { List${Pascal} } from "../../application/${slug}/use-cases/List${Pascal}.js";

export function create${Pascal}Service() {
  const repository = new InMemory${Pascal}Repository();
  const create = new Create${Pascal}(repository);
  const list = new List${Pascal}(repository);
  return { create, list };
}
`;
}

function uiIndex({ Pascal, slug }) {
  return `export { create${Pascal}Service } from "./${Pascal}Service.js";
export const route = "/${slug}";
`;
}

