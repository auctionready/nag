/**
 * Generates src/endpoint-definition.ts from the backend's OpenAPI document.
 *
 * Usage:
 *   pnpm --filter @nag/api-client generate
 *   pnpm --filter @nag/api-client generate -- --file ./openapi.json
 *
 * Env:
 *   OPENAPI_URL  URL to fetch the OpenAPI doc from.
 *                Defaults to http://localhost:5266/swagger/v1/swagger.json
 *                (the Nag.Api Development profile — Swagger is DEBUG-only).
 */
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { OpenAPIObject } from "openapi3-ts/oas31";
import { generateZodClientFromOpenAPI } from "openapi-zod-client";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(HERE, "..");
const TEMPLATE_PATH = resolve(HERE, "endpoint-template.hbs");
const OUTPUT_PATH = resolve(PKG_ROOT, "src/endpoint-definition.ts");
const DEFAULT_URL = "http://localhost:5266/swagger/v1/swagger.json";

const parseArgs = (argv: readonly string[]) => {
  const fileIdx = argv.indexOf("--file");
  return { file: fileIdx !== -1 ? argv[fileIdx + 1] : undefined };
};

const loadSpec = async (file: string | undefined): Promise<OpenAPIObject> => {
  if (file) {
    console.log(`Reading OpenAPI spec from ${file}`);
    return JSON.parse(await readFile(file, "utf8")) as OpenAPIObject;
  }
  const url = process.env.OPENAPI_URL ?? DEFAULT_URL;
  console.log(`Fetching OpenAPI spec from ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch OpenAPI doc from ${url}: ${res.status} ${res.statusText}. ` +
        `Is the backend running in Debug? Try 'dotnet run --project backend/Nag.Api'.`,
    );
  }
  return (await res.json()) as OpenAPIObject;
};

/**
 * openapi-zod-client emits `z.string().datetime(...)` for `format: date-time`
 * fields. We rewrite those to parse as Date so consumers never touch ISO strings.
 */
const injectDateTransforms = (source: string): string =>
  source
    .replace(
      /z\.string\(\)\.datetime\(([^)]*)\)/g,
      "z.iso.datetime($1).transform((s) => new Date(s))",
    )
    .replace(
      /z\.string\(\)\.date\(\)/g,
      "z.iso.date().transform((s) => new Date(s))",
    );

const runPrettier = (path: string) =>
  new Promise<void>((resolveP, rejectP) => {
    const child = spawn("pnpm", ["exec", "prettier", "--write", path], {
      cwd: PKG_ROOT,
      stdio: "inherit",
    });
    child.on("exit", (code) =>
      code === 0 ? resolveP() : rejectP(new Error(`prettier exited ${code}`)),
    );
    child.on("error", rejectP);
  });

const main = async () => {
  const { file } = parseArgs(process.argv.slice(2));
  const openApiDoc = await loadSpec(file);

  console.log(`Generating endpoint definitions via openapi-zod-client...`);
  const generated = await generateZodClientFromOpenAPI({
    openApiDoc,
    templatePath: TEMPLATE_PATH,
    disableWriteToFile: true,
    options: {
      withAlias: true,
      shouldExportAllSchemas: true,
    },
  });

  const withDates = injectDateTransforms(generated);
  await writeFile(OUTPUT_PATH, withDates, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);

  await runPrettier(OUTPUT_PATH);
  console.log("Done.");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
