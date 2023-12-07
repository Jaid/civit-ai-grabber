import type {ArgumentsCamelCase, CommandBuilder} from 'yargs'

export type YargsArgs<BuilderType> = BuilderType extends CommandBuilder<any, infer U> ? ArgumentsCamelCase<U> : never

export type YargsArgsCustom<BuilderType> = Omit<YargsArgs<BuilderType>, "$0" | "_">
