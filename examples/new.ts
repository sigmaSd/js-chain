import { _ } from "../mod.ts";

const name: string = _("jsr.json")
  .pipe(Deno.readTextFileSync)
  .pipe(JSON.parse)
  .name
  .tap(console.log)
  .expect("failed to get name from jsr.json");

console.log(name.length);
