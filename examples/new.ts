import { _ } from "../mod.ts";

const name: string = _("jsr.json")
  .pipe(Deno.readTextFileSync)
  .pipe(JSON.parse)
  .namez.A
  .must("failed to get name from jsr.json")
  .tap(console.log)
  .unwrap();

console.log(name.length);
