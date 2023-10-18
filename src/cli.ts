import type {ArgumentsCamelCase, Argv, CommandBuilder} from 'yargs'

import * as collectInvokeImportsCommand from './command/collectInvokeImports.js'
import * as deleteCommand from './command/delete.js'
import * as grabCommand from './command/grab.js'
import yargs from 'yargs'
import {hideBin} from 'yargs/helpers'

const cli = yargs(hideBin(process.argv))
cli.detectLocale(false)
cli.strict()
cli.parserConfiguration({
  'strip-aliased': true,
  'strip-dashed': true,
})
cli.scriptName(process.env.npm_package_name!)
cli.completion()
cli.command(grabCommand)
cli.command(collectInvokeImportsCommand)
cli.command(deleteCommand)
cli.demandCommand()
cli.help()
cli.wrap(Math.min(100, cli.terminalWidth()))
cli.parse()
