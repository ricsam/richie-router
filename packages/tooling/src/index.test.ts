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
      "export const routerSchema = {};\nexport type RouterSchema = typeof routerSchema;\n",
    ),
  ]);

  const routeTreePath = path.join(rootDir, "route-tree.gen.ts");
  const routeManifestPath = path.join(rootDir, "route-manifest.gen.ts");

  await generateRouteTree({
    routesDir,
    routerSchema: path.join(rootDir, "router-schema.ts"),
    output: routeTreePath,
    manifestOutput: routeManifestPath,
    quoteStyle: "double",
    semicolons: true,
  });

  const routeTreeContent = await readFile(routeTreePath, "utf8");
  const routeManifestContent = await readFile(routeManifestPath, "utf8");

  const childAssembly = "const BSplatprojectIdSplatbranchNameSchedulesSplatscheduleIdRouteRouteWithChildren =";
  const parentAssembly = "const BSplatprojectIdSplatbranchNameSchedulesRouteRouteChildren =";

  expect(routeTreeContent.indexOf(childAssembly)).toBeGreaterThan(-1);
  expect(routeTreeContent.indexOf(parentAssembly)).toBeGreaterThan(-1);
  expect(routeTreeContent.indexOf(childAssembly)).toBeLessThan(routeTreeContent.indexOf(parentAssembly));

  expect(routeManifestContent.indexOf(childAssembly)).toBeGreaterThan(-1);
  expect(routeManifestContent.indexOf(parentAssembly)).toBeGreaterThan(-1);
  expect(routeManifestContent.indexOf(childAssembly)).toBeLessThan(routeManifestContent.indexOf(parentAssembly));
});
