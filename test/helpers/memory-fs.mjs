import path from 'node:path'

function makeError(code, message = code) {
  const error = new Error(message)
  error.code = code
  return error
}

export function createMemoryFs(options = {}) {
  const files = new Map()
  const directories = new Set()
  const calls = []
  const failures = new Map()

  const normalize = (value) => path.resolve(String(value))
  const record = (operation, target, extra = {}) => calls.push({ operation, path: normalize(target), ...extra })
  const shouldFail = (operation, target) => {
    const key = `${operation}:${normalize(target)}`
    const genericKey = operation
    const failure = failures.get(key) ?? failures.get(genericKey)
    if (!failure) return
    if (failure.times !== Infinity) failure.times -= 1
    if (failure.times <= 0) failures.delete(key)
    throw typeof failure.error === 'function' ? failure.error() : failure.error
  }
  const ensureParent = (target) => {
    const parent = path.dirname(normalize(target))
    if (!directories.has(parent)) throw makeError('ENOENT', `directory does not exist: ${parent}`)
  }

  const api = {
    async readFile(target, encoding) {
      const resolved = normalize(target)
      record('readFile', resolved, { encoding })
      shouldFail('readFile', resolved)
      if (!files.has(resolved)) throw makeError('ENOENT', resolved)
      const content = files.get(resolved)
      return encoding ? content : Buffer.from(content)
    },
    async writeFile(target, data, encoding) {
      const resolved = normalize(target)
      record('writeFile', resolved, { encoding })
      shouldFail('writeFile', resolved)
      ensureParent(resolved)
      files.set(resolved, typeof data === 'string' ? data : Buffer.from(data).toString())
    },
    async appendFile(target, data, encoding) {
      const resolved = normalize(target)
      record('appendFile', resolved, { encoding })
      shouldFail('appendFile', resolved)
      ensureParent(resolved)
      const previous = files.get(resolved) ?? ''
      files.set(resolved, previous + (typeof data === 'string' ? data : Buffer.from(data).toString()))
    },
    async rename(source, target) {
      const from = normalize(source)
      const to = normalize(target)
      record('rename', from, { target: to })
      shouldFail('rename', to)
      if (files.has(to)) throw makeError('EEXIST', `destination exists: ${to}`)
      ensureParent(to)
      if (!files.has(from)) throw makeError('ENOENT', from)
      files.set(to, files.get(from))
      files.delete(from)
    },
    async mkdir(target, options = {}) {
      const resolved = normalize(target)
      record('mkdir', resolved, { options })
      shouldFail('mkdir', resolved)
      if (options.recursive) {
        const chain = []
        let current = resolved
        while (current && current !== path.dirname(current)) {
          chain.push(current)
          current = path.dirname(current)
        }
        for (const item of chain.reverse()) directories.add(item)
      } else {
        const parent = path.dirname(resolved)
        if (parent !== resolved && !directories.has(parent)) throw makeError('ENOENT', parent)
        directories.add(resolved)
      }
    },
    async unlink(target) {
      const resolved = normalize(target)
      record('unlink', resolved)
      shouldFail('unlink', resolved)
      if (!files.delete(resolved)) throw makeError('ENOENT', resolved)
    },
    async copyFile(source, target) {
      const from = normalize(source)
      const to = normalize(target)
      record('copyFile', from, { target: to })
      shouldFail('copyFile', to)
      ensureParent(to)
      if (!files.has(from)) throw makeError('ENOENT', from)
      files.set(to, files.get(from))
    },
    async readdir(target) {
      const resolved = normalize(target)
      record('readdir', resolved)
      shouldFail('readdir', resolved)
      if (!directories.has(resolved)) throw makeError('ENOENT', resolved)
      const names = new Set()
      for (const file of files.keys()) {
        if (path.dirname(file) === resolved) names.add(path.basename(file))
      }
      return [...names]
    },
  }

  const mkdirRoot = options.root ?? path.parse(process.cwd()).root
  directories.add(normalize(mkdirRoot))

  return Object.freeze({
    ...api,
    calls,
    files,
    directories,
    setFile(target, content) {
      const resolved = normalize(target)
      const parent = path.dirname(resolved)
      directories.add(parent)
      files.set(resolved, String(content))
    },
    getFile(target) {
      return files.get(normalize(target))
    },
    hasFile(target) {
      return files.has(normalize(target))
    },
    fail(operation, error = makeError('EIO', `${operation} failed`), times = 1, target) {
      const key = target === undefined ? operation : `${operation}:${normalize(target)}`
      failures.set(key, { error, times: times === Infinity ? Infinity : Math.max(1, times) })
    },
    clearFailures() {
      failures.clear()
    },
    resetCalls() {
      calls.length = 0
    },
  })
}
