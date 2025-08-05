Heist
=====

    "I love it when a plan comes together."

Heist is a minimum viable replacement for Grunt that leverages the features available in modern Node. It is primarily intended to sequence and orchestrate tasks in a build system.

Install with:

.. code:: sh
    npm install -g heist

Getting started
---------------

When you run the ``heist`` command, it will search upward from the current directory until it finds a ``heistfile.js`` that contains task definitions. Running ``heist --list`` will show all the defined tasks from that file, including their descriptions if possible. You can provide a list of tasks to execute after the ``heist`` command.

.. code:: sh

    $ heist --list
    Available tasks:
    ----------------
    - bundle: Build client-side scripts with Rollup
    - css: Compile styles using PostCSS
    - html: Generate HTML files
    - serve: Run an 11ty dev server and enable watch tasks

    $ heist bundle css

    Executing task: bundle
    Wrote src/js/main.js -> build/app.js

    Executing task: css
    Wrote src/css/seed.css to build/style.css

If you don't specify tasks after the command, Heist will look for a task named "default" and execute that. Tasks can also have "targets" appended to them, which is useful for switching their behavior between different presets, like running a bundler with tighter constraints in "prod" mode:

.. code:: sh

    $ heist bundle:prod

    Executing task: bundle
    Minifying and obfuscating scripts...
    Wrote src/js/main.js -> build/app.js

If you need finer-grained control of a task, you may want to use ``parseArgs`` from the "node:util" module (or the command parser of your choice) to add support for flags. Unlike npm scripts, since your code runs in the same process as the main Heist runner, you don't need to add a ``--`` delimiter before any custom flags.

Writing tasks
-------------

A heistfile should be an ES module that exports a single function, which takes the Heist instance as its argument and then uses its API to define one or more tasks:

.. code:: js

    export default function(heist) {

      heist.defineTask("say-hello", "Greets the user when run", function(target = "world", context) {
        console.log(`Hello, ${name}!`);
      });

    }

Each task function receives the ``target`` (if any) and a shared ``context`` object in its arguments, which can be used to pass values between different tasks through the build process. Tasks can also be loaded from a folder of JS files. Once defined, sequences can be composed together by calling ``heist.defineTask()`` with an array of task names in the place of a function:

.. code:: js

    export default function(heist) {

      // ./lib contains files defining "a", "b", and "c" tasks
      await heist.loadTasks("lib");

      // give a single name to a sequence of tasks
      heist.defineTask("abc", "Runs a -> b -> c", ["a", "b", "c"]);

      // tasks can use `context` to pass information to later code
      heist.defineTask("toggleFlag", function(target, context) {
        if (context.flag) {
          context.flag = false;
        } else {
          context.flag = true;
        }
      });

      // and they can dynamically run other tasks
      heist.defineTask("testFlag", async function(target, context) {
        if (context.flag) await heist.run("abc")
      });

    }

Tasks will be executed with the working directory set to the location of the heistfile for easier path management. Heist will also `await` any tasks defined as async functions, or those that return promises. If you want to run tasks in parallel, you can take advantage of JavaScript's ``Promise`` class:

.. code:: js

    heist.defineTask("parallel-one-two", async function() {
      await Promise.all([
        heist.run("one"),
        heist.run("two")
      ]);
    });


Remember, just because a task has completed, it doesn't mean that it can't continue to run code later in the event loop. For example, we can take advantage of this to add a watch task that yields back to Heist, but still responds to events by triggering the CSS processor:

.. code:: js

    heist.defineTask("watch", function() {
      var watcher = fs.watch("src", {
        recursive: true;
      });

      // this will persist even after the task "completes"
      watcher.on("change", function(_, filename) {
        if (filename.match(/\.css$/)) {
          heist.run("css");
        }
      });
    });

API
===

``Heist.defineTask(name, [description], functionOrTaskList)``
---

Adds a task definition to the Heist runner. Description is optional but useful when listing options at the command line. ``functionOrTaskList`` can be either a function with ``target`` and ``context`` arguments, or a list of task names to run in sequence.

``Heist.loadTasks(foldername)`` (async)
---

Loads all .js files in a folder, using the same structure as a heistfile (i.e., exporting a single function containing task definitions).

``Heist.run(taskNameOrArray, context = {})`` (async)
---

Execute a task or tasks by name, with an optional context object. If you're using this to execute a subtask, you can either pass in the same ``context`` object that the parent task received, or provide entirely new context data.

``Heist.find(patterns, folder = ".")`` (async)
---

Locate files matching a `minimatch <https://github.com/isaacs/minimatch>`_ globbing pattern. Defaults to searching from the same directory as the heistfile, but can be scoped down to a subdirectory with the ``folder`` argument, which can make it substantially faster. This function ignores any file or directory that starts with a ``.``, as well as the ``node_modules`` folder. Provided because it's one of the few file system operations that remains clunky in the Node standard library.