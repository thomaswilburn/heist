import path from "node:path";
import fs from "node:fs/promises";

export default async function(filename, here = process.cwd()) {
  while (true) {
    // check for heistfiles at each folder working up
    try {
      var loc = path.join(here, filename);
      var stat = await fs.stat(loc);
      // if it stats, it exists
      return loc;
    } catch (err) {
      // we expect errors for missing files
      var previous = here;
      here = path.resolve(here, "..");
      if (here == previous) return false;
    }
  }
  return false;
}