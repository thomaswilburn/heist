#!/usr/bin/env node

import { parseArgs } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import { expand } from "./expand.js";

var argv = parseArgs({
  allowPositionals: true,
  strict: false
});

class Heist {
  tasks = {};

  constructor(plan) {
    this.plan = plan;
    this.home = path.dirname(plan);
  }

  static async findHeistfile() {
    var here = process.cwd();
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
      console.error("Unable to locate Heistfile.js - exiting.");
      process.exit();
    }
    return heistfile;
  }

  async init() {
    var { default: imported } = await import(this.plan);
    await imported(this);
  }

  defineTask(name, fn) {
    this.tasks[name] = fn;
  }

  async loadTasks(folder) {
    var dir = path.resolve(this.home, folder);
    var files = await fs.readdir(dir);
    for (var f of files) {
      var mod = path.resolve(dir, f);
      var stat = await fs.stat(mod);
      if (stat.isDirectory()) continue;
      var { default: imported } = await import(mod);
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
      this.logTask(name);
      if (task instanceof Array) {
        try {
          await this.run(task, context);
        } catch (err) {
          console.error(err);
        }
      } else {
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
if (argv.positionals.length) {
  heist.run(argv.positionals);
} else {
  heist.run();
}