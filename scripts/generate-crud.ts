import fs from "fs";
import path from "path";

// Adjust these paths if needed
const modelsDir = "src/models";
const controllersDir = "src/api/v1/controllers";
const routesDir = "src/api/v1/routes";
const servicesDir = "src/services";
const schemasDir = "src/schemas";

// ensure directory exists
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// always overwrite file with empty content
function createEmptyFile(file: string) {
  fs.writeFileSync(file, ""); // overwrite
  console.log(`[overwritten] ${file}`);
}

function pascalCase(str: string) {
  return str
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

function main() {
  ensureDir(controllersDir);
  ensureDir(routesDir);
  ensureDir(servicesDir);
  ensureDir(schemasDir);

  const models = fs.readdirSync(modelsDir).filter(f => f.endsWith(".model.ts"));

  models.forEach(modelFile => {
    const base = modelFile.replace(".model.ts", ""); // e.g. ad
    const name = base.toLowerCase();
    const namePascal = pascalCase(base);

    const schemaFile = path.join(schemasDir, `${name}.schema.ts`);
    const serviceFile = path.join(servicesDir, `${name}.service.ts`);
    const controllerFile = path.join(controllersDir, `${name}.controller.ts`);
    const routeFile = path.join(routesDir, `${name}.routes.ts`);

    createEmptyFile(schemaFile);
    createEmptyFile(serviceFile);
    createEmptyFile(controllerFile);
    createEmptyFile(routeFile);
  });
}

main();
