/*

Used to find files based on a glob pattern.
Primarily used for the manifest deployment list.

*/

import fs from "node:fs/promises";
import { minimatch } from "minimatch";
import path from "node:path";

// check if a file matches any or all (strict mode) patterns in a list
var filterFile = function(file, patterns, strict) {
  return patterns[strict ? "every" : "some"](function(p) {
    return minimatch(file, p, { matchBase: true, nocase: true });
  });
};

// implements glob matching for a directory based on a list of patterns
// returns all files that match
export async function expand(from, patterns, dir = ".") {
  if (typeof patterns == "string") {
    patterns = [ patterns ];
  }
  var fullDir = path.join(from, dir);
  try {
    var files = await fs.readdir(fullDir);
    // skip hidden files and node modules
    files = files.filter(f => f[0] != "." && f != "node_modules");
  } catch (err) {
    console.log(`Unable to read directory ${fullDir} - does it exist?`);
    return [];
  }
  var matching = [];
  var affirmative = patterns.filter(p => p[0] != "!");
  var negative = patterns.filter(p => p[0] == "!");
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var full = path.join(from, dir, f);
    var relative = path.relative(from, full);
    try {
      var stat = await fs.stat(full);
      if (stat.isDirectory()) {
        var children = await expand(from, patterns, relative);
        matching.push(...children);
      } else {
        var matched = filterFile(relative, affirmative);
        var notExcluded = filterFile(relative, negative, true);
        if (matched && notExcluded) {
          matching.push(full);
        }
      }
    } catch (err) {
      console.log(err);
      console.log(`Unable to expand matches for path ${f}`);
    }
  }
  return matching;
};
