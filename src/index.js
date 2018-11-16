/* eslint-disable complexity, max-statements, max-depth */
import { dirname, extname, relative, resolve, sep } from "path"
import chalk from "chalk"

import figures from "figures"
import terminalSpinner from "ora"
import { rollup, watch } from "rollup"

import extractTypes from "./extractTypes"
import getBanner from "./getBanner"
import getEntries from "./getEntries"
import getFormattedSize from "./getFormattedSize"
import getOutputMatrix from "./getOutputMatrix"
import getRollupInputOptions from "./getRollupInputOptions"
import getRollupOutputOptions from "./getRollupOutputOptions"
import getTasks from "./getTasks"

const WATCH_OPTS = {
  exclude: "node_modules/**"
}

export default async function index(opts) {
  const pkg = require(resolve(opts.root, "package.json"))

  const options = {
    ...opts,
    name: pkg.name || dirname(opts.root),
    version: pkg.version || "0.0.0",
    banner: getBanner(pkg),
    output: getOutputMatrix(opts, pkg)
  }

  options.entries = getEntries(options)

  const tasks = getTasks(options)

  if (options.watch) {
    console.log(chalk.bold(`Watching ${options.name}-${options.version}...`))
  } else {
    console.log(chalk.bold(`Building ${options.name}-${options.version}...`))
  }

  for (const task of tasks) {
    // We are unable to watch and regenerate TSC defintion files in watcher
    if (!options.watch || task.format !== "tsc") {
      console.log(
        `${chalk.yellow(figures.star)} [${chalk.blue(
          task.target.toUpperCase()
        )}] ${chalk.blue(relative(task.root, task.input))} ${
          figures.pointer
        } ${chalk.green(task.output)} [${chalk.green(task.format.toUpperCase())}]`
      )
    }
  }

  if (options.watch) {
    const rollupTasks = []

    for (const task of tasks) {
      if (task.format !== "tsc") {
        rollupTasks.push({
          output: getRollupOutputOptions(task),
          watch: WATCH_OPTS,
          ...getRollupInputOptions(task)
        })
      }
    }

    watch(rollupTasks).on("event", (watchEvent) => {
      if (watchEvent.code === "FATAL" || watchEvent.code === "ERROR") {
        console.error(`${chalk.red(figures.cross)} ${formatError(watchEvent.error)}`)
        if (watchEvent.code === "FATAL") {
          process.exit(1)
        }
      } else if (watchEvent.code === "BUNDLE_END") {
        watchEvent.output.forEach((output) => {
          console.log(
            `${chalk.green(figures.tick)} Written ${relative(options.root, output)} in ${
              watchEvent.duration
            }ms`
          )
        })
      }
    })
  } else {
    // Parallel execution. Confuses console messages right now. Not clearly faster.
    // Probably needs some better parallel execution
    // e.g. via https://github.com/facebook/jest/tree/master/packages/jest-worker
    // await Promise.all(tasks.map(executeTask))

    for (const task of tasks) {
      await executeTask(task)
    }
  }
}

async function executeTask(task) {
  return task.format === "tsc" ? bundleTypes(task) : bundleTo(task)
}

function generateMessage(post, { name, version, root, target, input, output, format }) {
  return `[${chalk.blue(target.toUpperCase())}] ${chalk.blue(relative(root, input))} ${
    figures.pointer
  } ${chalk.green(output)} [${chalk.green(format.toUpperCase())}] ${post}`
}

function formatError(error) {
  const lines = error.toString().split("\n")
  // Format in red color + replace working directory with empty string
  lines[0] = chalk.red(lines[0].replace(process.cwd() + sep, ""))
  return lines.join("\n")
}

function handleError(error, progress) {
  const formattedMsg = formatError(error)
  if (progress) {
    progress.fail(formattedMsg)
  } else if (process.env.NODE_ENV === "test") {
    throw new Error(formattedMsg)
  } else {
    console.error(formattedMsg)
  }

  if (process.env.NODE_ENV !== "test") {
    process.exit(1)
  }
}

function formatDuration(start) {
  const NS_PER_SEC = 1e9
  const NS_TO_MS = 1e6
  const diff = process.hrtime(start)
  const nano = diff[0] * NS_PER_SEC + diff[1]
  const ms = Math.round(nano / NS_TO_MS)

  return ` in ${ms}ms`
}

function bundleTypes(options) {
  if ([ ".ts", ".tsx" ].includes(extname(options.input))) {
    const start = process.hrtime()

    let progress = null
    if (!options.quiet) {
      progress = terminalSpinner({
        interval: 30,
        text: generateMessage("...", options)
      }).start()
    }

    try {
      // Unfortunately there is no async API here.
      extractTypes(options)
    } catch (typeError) {
      handleError(typeError, progress)
    }

    if (!options.quiet) {
      progress.succeed(generateMessage(`Done${formatDuration(start)}`, options))
    }
  }
}

async function bundleTo(options) {
  let progress = null
  if (!options.quiet) {
    progress = terminalSpinner({
      text: `${generateMessage("...", options)}`,
      interval: 30
    }).start()
  }

  const start = process.hrtime()

  let bundle = null
  try {
    bundle = await rollup(getRollupInputOptions(options))
  } catch (bundleError) {
    handleError(bundleError, progress)
  }

  let result = null
  try {
    result = await bundle.write(getRollupOutputOptions(options))
  } catch (writeError) {
    handleError(writeError, progress)
  }

  if (!options.quiet) {
    progress.succeed(
      generateMessage(
        (await getFormattedSize(result.code, options.output, options.target !== "cli")) +
          formatDuration(start),
        options
      )
    )
  }
}
