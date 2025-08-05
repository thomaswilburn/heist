#!/usr/bin/env node

import { styleText, parseArgs } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import { expand } from "./expand.js";
import findUpward from "./findUpward.js";
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
        console.log(styleText(["underline"], `\nExecuting task: ${name}`));
        await this.tasks[name](target, context, this);
      }
    }
  }

  async find(patterns, from = this.home) {
    var files = await expand(from, patterns);
    return files.map(f => path.relative(from, f));
  }
}

var heistfile = await findUpward("heistfile.js");
if (!heistfile) {
  console.error("Unable to locate heistfile.js - exiting.");
  process.exit();
}
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