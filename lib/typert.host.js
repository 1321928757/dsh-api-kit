/**
 * dsh-api-kit Typert Host manifest.
 *
 * T01 keeps the manifest intentionally empty. The real API Kit RPC surface is
 * added only after its Registry and security model have been implemented.
 */
import { z } from 'zod'

// Keep a real zod v4 codec available for the loader contract, even though T01
// has no invocation yet. Later tasks can reuse this shape for JSON payloads.
const json$codec = {
  mode: 'strict',
  typeSymbol: 'dsh-api-kit#Json',
  schema: z.record(z.string(), z.unknown()),
}

export const TYPERT = {
  package: 'dsh-api-kit',
  face: 'host',
  schemas: [],
  invocations: [],
  model: {
    services: [],
    events: [],
    objects: [],
  },
  // Make the deliberately unused codec visible to static readers without
  // adding a fake business invocation to the public manifest.
  _t01: { jsonCodecTypeSymbol: json$codec.typeSymbol },
}

export default TYPERT
