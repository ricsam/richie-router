import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateRouteTree } from "./index";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

test("generateRouteTree emits nested child assemblies before parents", async () => {
  const coreModulePath = new URL("../../core/src/index.ts", import.meta.url).pathname;
  const rootDir = await mkdtemp(path.join(tmpdir(), "richie-router-tooling-"));
  tempDirectories.push(rootDir);

  const routesDir = path.join(rootDir, "routes");
  await mkdir(path.join(routesDir, "b", "$projectId", "$branchName", "schedules", "$scheduleId"), { recursive: true });

  const routeFileContent = "export const Route = {} as any;\n";
  await Promise.all([
    writeFile(path.join(routesDir, "__root.tsx"), routeFileContent),
    writeFile(path.join(routesDir, "b", "$projectId", "$branchName", "route.tsx"), routeFileContent),
    writeFile(path.join(routesDir, "b", "$projectId", "$branchName", "index.tsx"), routeFileContent),
    writeFile(path.join(routesDir, "b", "$projectId", "$branchName", "schedules", "route.tsx"), routeFileContent),
    writeFile(path.join(routesDir, "b", "$projectId", "$branchName", "schedules", "index.tsx"), routeFileContent),
    writeFile(path.join(routesDir, "b", "$projectId", "$branchName", "schedules", "$scheduleId", "route.tsx"), routeFileContent),
    writeFile(path.join(routesDir, "b", "$projectId", "$branchName", "schedules", "$scheduleId", "index.tsx"), routeFileContent),
    writeFile(
      path.join(rootDir, "router-schema.ts"),
      [
        `import { defineRouterSchema } from ${JSON.stringify(coreModulePath)};`,
        "",
        "export const routerSchema = defineRouterSchema({}, {",
        "  passthrough: ['/api/$'],",
        "  headBasePath: '/meta',",
        "});",
        "export type RouterSchema = typeof routerSchema;",
        "",
      ].join("\n"),
    ),
  ]);

  const routeTreePath = path.join(rootDir, "route-tree.gen.ts");
  const routeManifestPath = path.join(rootDir, "route-manifest.gen.ts");
  const routesJsonPath = path.join(rootDir, "spa-routes.gen.json");

  await generateRouteTree({
    routesDir,
    routerSchema: path.join(rootDir, "router-schema.ts"),
    output: routeTreePath,
    manifestOutput: routeManifestPath,
    jsonOutput: routesJsonPath,
    quoteStyle: "double",
    semicolons: true,
  });

  const routeTreeContent = await readFile(routeTreePath, "utf8");
  const routeManifestContent = await readFile(routeManifestPath, "utf8");
  const routesJsonContent = JSON.parse(await readFile(routesJsonPath, "utf8")) as {
    hostedRouting?: {
      headBasePath: string;
      passthrough: string[];
    };
  };

  const childAssembly = "const BSplatprojectIdSplatbranchNameSchedulesSplatscheduleIdRouteRouteWithChildren =";
  const parentAssembly = "const BSplatprojectIdSplatbranchNameSchedulesRouteRouteChildren =";

  expect(routeTreeContent.indexOf(childAssembly)).toBeGreaterThan(-1);
  expect(routeTreeContent.indexOf(parentAssembly)).toBeGreaterThan(-1);
  expect(routeTreeContent.indexOf(childAssembly)).toBeLessThan(routeTreeContent.indexOf(parentAssembly));

  expect(routeManifestContent.indexOf(childAssembly)).toBeGreaterThan(-1);
  expect(routeManifestContent.indexOf(parentAssembly)).toBeGreaterThan(-1);
  expect(routeManifestContent.indexOf(childAssembly)).toBeLessThan(routeManifestContent.indexOf(parentAssembly));
  expect(routeTreeContent).toContain("getRouterSchemaHostedRouting(routerSchema)");
  expect(routeManifestContent).toContain("getRouterSchemaHostedRouting(routerSchema)");
  expect(routesJsonContent.hostedRouting).toEqual({
    headBasePath: "/meta",
    passthrough: ["/meta", "/api/$"],
  });
});

test("generateRouteTree can load router schema imports through a custom resolver", async () => {
  const coreModulePath = new URL("../../core/src/index.ts", import.meta.url).pathname;
  const rootDir = await mkdtemp(path.join(tmpdir(), "richie-router-tooling-resolver-"));
  tempDirectories.push(rootDir);

  const routesDir = path.join(rootDir, "routes");
  await mkdir(routesDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(routesDir, "__root.tsx"), "export const Route = {} as any;\n"),
    writeFile(path.join(routesDir, "index.tsx"), "export const Route = {} as any;\n"),
    writeFile(
      path.join(rootDir, "router-schema.ts"),
      [
        'import { defineRouterSchema } from "@richie-router/core";',
        "",
        "export const routerSchema = defineRouterSchema({}, {",
        "  passthrough: ['/api/$'],",
        "  headBasePath: '/meta',",
        "});",
        "",
      ].join("\n"),
    ),
  ]);

  const routesJsonPath = path.join(rootDir, "spa-routes.gen.json");

  await generateRouteTree({
    routesDir,
    routerSchema: path.join(rootDir, "router-schema.ts"),
    output: path.join(rootDir, "route-tree.gen.ts"),
    jsonOutput: routesJsonPath,
    resolveRouterSchemaModule({ specifier }) {
      if (specifier === "@richie-router/core") {
        return coreModulePath;
      }
      return null;
    },
  });

  const routesJsonContent = JSON.parse(await readFile(routesJsonPath, "utf8")) as {
    hostedRouting?: {
      headBasePath: string;
      passthrough: string[];
    };
  };

  expect(routesJsonContent.hostedRouting).toEqual({
    headBasePath: "/meta",
    passthrough: ["/meta", "/api/$"],
  });
});
