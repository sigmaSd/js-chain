import { _ } from "../mod.ts";

const imports = _("deno.json")
  .pipe(Deno.readTextFileSync)
  .pipe(JSON.parse)
  .imports
  .must("failed to read deno.json imports");

const packageJson = _("package.json")
  .pipe(Deno.readTextFileSync)
  .pipe(JSON.parse)
  .must("failed to read package.json");

if (!packageJson.dependencies) packageJson.dependencies = {};
packageJson.dependencies = { ...packageJson.dependencies, ...imports };

_(packageJson)
  .pipe(($) => JSON.stringify($, null, 2))
  .tap(($) => Deno.writeTextFileSync("package.json", $))
  .must("failed to write to package.json");

_("deno.json")
  .pipe(Deno.removeSync);
