#!/usr/bin/env node

import { parseArgs } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import { expand } from "./expand.js";
import { pathToFileURL, fileURLToPath } from "node:url";

var argv = parseArgs({
  allowPositionals: true,
  strict: false
});

class Heist {
  tasks = {};

  constructor(location) {
    this.plan = location;
    this.home = path.dirname(location);
  }

  static async findHeistfile(here = process.cwd()) {
    var heistfile = false;
    while (here != "/") {
      // check for heistfiles at each folder working up
      try {
        var loc = path.join(here, "heistfile.js");
        var stat = await fs.stat(loc);
        // if it stats, it exists
        return loc;
      } catch (err) {
        // we expect errors for missing files
        here = path.resolve(here, "..");
      }
    }
    if (!heistfile) {
      console.error("Unable to locate heistfile.js - exiting.");
      process.exit();
    }
  }

  async init() {
    var file = pathToFileURL(this.plan).href;
    var { default: imported } = await import(file);
    await imported(this);
  }

  defineTask(name, description, fn) {
    if (typeof description != "string") {
      fn = description;
      description = "";
    }
    this.tasks[name] = fn;
    if (description) {
      fn.description = description;
    } else if (fn instanceof Array) {
      fn.description = fn.join(" -> ");
    }
  }

  async loadTasks(folder) {
    var dir = path.resolve(this.home, folder);
    var files = await fs.readdir(dir);
    for (var f of files) {
      var mod = path.resolve(dir, f);
      var stat = await fs.stat(mod);
      if (stat.isDirectory()) continue;
      var url = pathToFileURL(mod).href;
      var { default: imported } = await import(url);
      await imported(this);
    }
  }

  logTask(name) {
    var tag = `Executing task: ${name}`;
    console.log(`\n${tag}\n${"".padStart(tag.length, "-")}`);
  }

  async run(taskList = "default", context = {}) {
    process.chdir(this.home);
    if (typeof taskList == "string") {
      taskList = [ taskList ];
    }
    for (var t of taskList) {
      var [name, target] = t.split(":");
      var task = this.tasks[name];
      if (!task) {
        console.error(`Task not found: ${name}`);
        continue;
      }
      if (task instanceof Array) {
        try {
          await this.run(task, context);
        } catch (err) {
          console.error(err);
        }
      } else {
        this.logTask(name);
        await this.tasks[name](target, context, this);
      }
    }
  }

  async find(patterns) {
    var files = await expand(this.home, patterns);
    return files.map(f => path.relative(this.home, f));
  }
}

var heistfile = await Heist.findHeistfile();
var heist = new Heist(heistfile);
await heist.init();
if (argv.values.help || argv.values.list) {
  var taskList = Object.keys(heist.tasks).filter(t => t != "default").sort();
  console.log(`
Available tasks:
----------------
${taskList.map(t => `- ${[t, heist.tasks[t].description].filter(f => f).join(": ")}`).join("\n")}

  `.trim())
} else if (argv.positionals.length) {
  heist.run(argv.positionals);
} else {
  heist.run();
}