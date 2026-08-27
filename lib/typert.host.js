/**
 * dsh-api-kit Typert Host manifest for the T05 configuration surface.
 * The business service is exposed through the runtime Typert gateway; all
 * values crossing the boundary are strict JSON and safe views only.
 */
import { z } from 'zod'

const argsSchema = z.record(z.string(), z.unknown())
const jsonSchema = z.unknown()
const argsCodec = { mode: 'strict', typeSymbol: 'dsh-api-kit#Args', schema: argsSchema }
const jsonCodec = { mode: 'strict', typeSymbol: 'dsh-api-kit#Json', schema: jsonSchema }

const direct = (name, parameters = []) => ({
  id: `dsh-api-kit#api-kit/${name}`,
  service: 'apiKitConfig',
  namespace: 'api-kit',
  method: name,
  invocation: { kind: 'direct' },
  parameters,
  result: jsonCodec,
})
const argsParameter = { name: 'args', wire: 'args', source: 'json', codec: argsCodec }
const named = (name, parameterNames) => direct(name, parameterNames.map((item) => ({ name: item, wire: item, source: 'json', codec: item === 'input' || item === 'patch' || item === 'operationIds' ? argsCodec : jsonCodec })))
const member = (name, signature, summary) => ({ kind: 'method', name, signature, summary, jsDoc: `/** ${summary} */` })

export const TYPERT = {
  package: 'dsh-api-kit',
  face: 'host',
  schemas: [],
  invocations: [
    direct('listKits', [argsParameter]),
    named('getKit', ['id']),
    named('createKit', ['input']),
    named('updateKit', ['id', 'patch']),
    named('deleteKit', ['id']),
    named('addOperationsToKit', ['kitId', 'operationIds']),
    named('removeOperationsFromKit', ['kitId', 'operationIds']),
    direct('listOperations', [argsParameter]),
    named('getOperation', ['id']),
    named('createOperation', ['input']),
    named('updateOperation', ['id', 'patch']),
    named('deleteOperation', ['id']),
    named('setOperationEnabled', ['id', 'enabled']),
    direct('listServiceTargets', [argsParameter]),
    named('getServiceTarget', ['id']),
    direct('listEnvironments', [argsParameter]),
    named('getEnvironment', ['id']),
    direct('listAuthProfiles', [argsParameter]),
    named('getAuthProfile', ['id']),
  ],
  model: {
    services: [{
      description: 'dsh-api-kit safe configuration service for API Kits, Operations, targets, environments and authentication metadata.',
      summary: 'API Kit configuration service',
      tags: ['api-kit', 'configuration'],
      jsDoc: '/** Safe API Kit configuration service. */',
      key: 'apiKitConfig',
      exportName: 'ApiKitConfigService',
      members: [
        member('listKits', 'listKits(args: object): Promise<object>', 'List safe API Kit summaries.'),
        member('getKit', 'getKit(id: string): Promise<object>', 'Get one safe API Kit with operation summaries.'),
        member('createKit', 'createKit(input: object): Promise<object>', 'Create an API Kit.'),
        member('updateKit', 'updateKit(id: string, patch: object): Promise<object>', 'Patch an API Kit.'),
        member('deleteKit', 'deleteKit(id: string): Promise<boolean>', 'Delete an API Kit.'),
        member('addOperationsToKit', 'addOperationsToKit(kitId: string, operationIds: string[]): Promise<object>', 'Add existing operations to a Kit.'),
        member('removeOperationsFromKit', 'removeOperationsFromKit(kitId: string, operationIds: string[]): Promise<object>', 'Remove operations from a Kit.'),
        member('listOperations', 'listOperations(args: object): Promise<object[]>', 'List safe operation summaries.'),
        member('getOperation', 'getOperation(id: string): Promise<object>', 'Get one complete safe operation definition.'),
        member('createOperation', 'createOperation(input: object): Promise<object>', 'Create a manually defined operation.'),
        member('updateOperation', 'updateOperation(id: string, patch: object): Promise<object>', 'Patch a manually defined operation.'),
        member('deleteOperation', 'deleteOperation(id: string): Promise<boolean>', 'Delete an unreferenced operation.'),
        member('setOperationEnabled', 'setOperationEnabled(id: string, enabled: boolean): Promise<object>', 'Enable or disable one operation.'),
        member('listServiceTargets', 'listServiceTargets(args: object): Promise<object[]>', 'List safe service targets.'),
        member('getServiceTarget', 'getServiceTarget(id: string): Promise<object>', 'Get one safe service target.'),
        member('listEnvironments', 'listEnvironments(args: object): Promise<object[]>', 'List safe environments.'),
        member('getEnvironment', 'getEnvironment(id: string): Promise<object>', 'Get one safe environment.'),
        member('listAuthProfiles', 'listAuthProfiles(args: object): Promise<object[]>', 'List authentication metadata without secret references.'),
        member('getAuthProfile', 'getAuthProfile(id: string): Promise<object>', 'Get authentication metadata without secrets.'),
      ],
      types: [],
    }],
    events: [],
    objects: [],
  },
}

export default TYPERT
