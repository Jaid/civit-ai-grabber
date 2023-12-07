import type {Merge, Simplify} from 'type-fest'

type MergeThree<LowPriorityType, MediumPriorityType, HighPriorityType> = Simplify<Merge<LowPriorityType, Merge<MediumPriorityType, HighPriorityType>>>

export type InputOptionsSetup = {
  defaultsType?: Record<string, unknown>
  optionalOptions?: Record<string, unknown>
  requiredOptions?: Record<string, unknown>
}

export type InputOptions<Setup extends InputOptionsSetup> = {
  defaultsType: Setup["defaultsType"]
  merged: MergeThree<Setup["defaultsType"], Partial<Setup["optionalOptions"]>, Setup["requiredOptions"]>
  optionalOptions: Partial<Setup["optionalOptions"]>
  parameter: MergeThree<Partial<Setup["defaultsType"]>, Partial<Setup["optionalOptions"]>, Setup["requiredOptions"]>
  requiredOptions: Setup["requiredOptions"]
}
