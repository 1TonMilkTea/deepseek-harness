import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import KdeHarnessMpLoginController, {
  employeeScopeKey, employeeSessionRoot, migrateLegacySessionsOnce, KDE_HARNESS_MP_EMPLOYEE_SCOPE_MARKER,
} from '../src/index.ts'

const LIST_TOOL = 'mcp__1tmt__kdeListOrganizations'
const LOGIN_TOOL = 'mcp__1tmt__harnessLogin'

async function mockPersistence() {
  const baseRoot = await mkdtemp(join(tmpdir(), 'kde-harness-mp-login-'))
  return {
    baseRoot,
    sessionPersistence: {
      getBaseRoot: () => baseRoot,
      closeOpenWriters: vi.fn(async () => {}),
      bindRoot: vi.fn(async () => {}),
    },
  }
}

async function harness(
  execute: ReturnType<typeof vi.fn>,
  sessionPersistence: {
    getBaseRoot(): string
    closeOpenWriters(): Promise<void>
    bindRoot(absoluteRoot: string): Promise<void>
  } = {
    getBaseRoot: () => join(tmpdir(), 'kde-harness-mp-login-unused'),
    closeOpenWriters: vi.fn(async () => {}),
    bindRoot: vi.fn(async () => {}),
  },
): Promise<KdeHarnessMpLoginController> {
  const home = await mkdtemp(join(tmpdir(), 'kde-harness-mp-login-home-'))
  vi.stubEnv('DSH_HOME', home)
  vi.stubEnv('DSH_1TMT_MCP_URL', '')

  const ctx = new Context()
  ctx.provide('typert', {
    lookups: { configure: () => () => {} },
    contexts: { configureHost: () => () => {} },
  } as never)
  ctx.provide('tools', { execute } as never)
  ctx.provide('sessionPersistence', sessionPersistence as never)
  ctx.logger = { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() } as never

  const fiber = Object.assign(Promise.resolve(), {
    dispose: vi.fn(async () => {}),
  })
  vi.spyOn(ctx, 'plugin').mockImplementation((() => fiber) as never)

  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
      return {
        ok: true,
        json: async () => ({ token: 'session-token', clientId: 'client-1', expiresInSeconds: 43200 }),
      }
    }
    return { ok: true, status: 204 }
  }))

  const controller = new KdeHarnessMpLoginController(ctx, {
    listOrganizationsTool: LIST_TOOL,
    harnessLoginTool: LOGIN_TOOL,
  })
  await controller.setBackendConfig({ baseUrl: 'http://127.0.0.1:8081' }, AbortSignal.timeout(2000))
  return controller
}

describe('KdeHarnessMpLoginController', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('lists organizations from an MCP object value', async () => {
    const execute = vi.fn(async () => ({
      isError: false,
      value: {
        organizations: [
          { id: 12, name: 'Org A', number: 'A' },
          { id: 'bad' },
          null,
          ['skip'],
        ],
      },
      content: [],
    }))
    const controller = await harness(execute)
    expect(controller.isLoggedIn()).toBe(false)
    expect(controller.status()).toEqual({ loggedIn: false })
    expect(await controller.getBackendConfig()).toMatchObject({
      baseUrl: 'http://127.0.0.1:8081',
      configured: true,
      mcpReady: true,
    })

    const listed = await controller.listOrganizations(AbortSignal.timeout(1000))
    expect(listed.organizations).toEqual([{ id: 12, name: 'Org A', number: 'A' }])
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      name: LIST_TOOL,
      arguments: {},
    }))
  })

  it('maps Kingdee data rows with OrgId fields from MCP text', async () => {
    const execute = vi.fn(async () => ({
      isError: false,
      value: {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: [
              { OrgId: 117977, OrgNumber: '000', OrgName: '合并账簿' },
              { OrgId: 1, OrgNumber: '100', OrgName: '昆山蒲公英智能科技有限公司' },
            ],
            message: '',
          }),
        }],
      },
      content: [],
    }))
    const listed = await (await harness(execute)).listOrganizations(AbortSignal.timeout(1000))
    expect(listed.organizations).toEqual([
      { id: 117977, name: '合并账簿', number: '000' },
      { id: 1, name: '昆山蒲公英智能科技有限公司', number: '100' },
    ])
  })

  it('unwraps organizations from MCP text content', async () => {
    const execute = vi.fn(async () => ({
      isError: false,
      value: {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'ok',
            organizations: [{ id: 12, name: 'Org A', number: 'A' }],
          }),
        }],
      },
      content: [],
    }))
    const listed = await (await harness(execute)).listOrganizations(AbortSignal.timeout(1000))
    expect(listed.organizations).toEqual([{ id: 12, name: 'Org A', number: 'A' }])
  })

  it('unwraps organizations from MCP structuredContent', async () => {
    const execute = vi.fn(async () => ({
      isError: false,
      value: {
        content: [],
        structuredContent: { organizations: [{ id: 8, name: 'Org B', number: 'B' }] },
      },
      content: [],
    }))
    const listed = await (await harness(execute)).listOrganizations(AbortSignal.timeout(1000))
    expect(listed.organizations).toEqual([{ id: 8, name: 'Org B', number: 'B' }])
  })

  it('parses a JSON string tool value and skips unnamed fields', async () => {
    const execute = vi.fn(async () => ({
      isError: false,
      value: JSON.stringify({ organizations: [{ id: 3 }] }),
      content: [],
    }))
    const listed = await (await harness(execute)).listOrganizations(AbortSignal.timeout(1000))
    expect(listed.organizations).toEqual([{ id: 3, name: '', number: '' }])
  })

  it('rejects a tool error, a non-object value, invalid JSON, and a missing list', async () => {
    const toolError = await harness(vi.fn(async () => ({
      isError: true,
      error: { message: 'unknown tool' },
      content: [],
    })))
    await expect(toolError.listOrganizations(AbortSignal.timeout(1000)))
      .rejects.toMatchObject({ code: 'kde-harness-mp/login-failed', message: 'unknown tool' })

    const arrayValue = await harness(vi.fn(async () => ({ isError: false, value: [], content: [] })))
    await expect(arrayValue.listOrganizations(AbortSignal.timeout(1000)))
      .rejects.toBeInstanceOf(RemoteError)

    const badJson = await harness(vi.fn(async () => ({ isError: false, value: '{', content: [] })))
    await expect(badJson.listOrganizations(AbortSignal.timeout(1000)))
      .rejects.toMatchObject({ message: 'MCP tool result is not JSON' })

    const missing = await harness(vi.fn(async () => ({ isError: false, value: {}, content: [] })))
    await expect(missing.listOrganizations(AbortSignal.timeout(1000)))
      .rejects.toMatchObject({ message: 'organization list is missing' })

    const emptyBlocks = await harness(vi.fn(async () => ({
      isError: false,
      value: { content: [null, [], { type: 'text', text: '' }] },
      content: [],
    })))
    await expect(emptyBlocks.listOrganizations(AbortSignal.timeout(1000)))
      .rejects.toMatchObject({ message: 'organization list is missing' })
  })

  it('requires a backend Base URL before listing organizations', async () => {
    const home = await mkdtemp(join(tmpdir(), 'kde-harness-mp-login-home-'))
    vi.stubEnv('DSH_HOME', home)
    vi.stubEnv('DSH_1TMT_MCP_URL', '')
    const ctx = new Context()
    ctx.provide('typert', {
      lookups: { configure: () => () => {} },
      contexts: { configureHost: () => () => {} },
    } as never)
    ctx.provide('tools', { execute: vi.fn() } as never)
    ctx.provide('sessionPersistence', {
      getBaseRoot: () => home,
      closeOpenWriters: vi.fn(async () => {}),
      bindRoot: vi.fn(async () => {}),
    } as never)
    ctx.logger = { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() } as never
    const controller = new KdeHarnessMpLoginController(ctx, {
      listOrganizationsTool: LIST_TOOL,
      harnessLoginTool: LOGIN_TOOL,
    })
    await expect(controller.listOrganizations(AbortSignal.timeout(1000)))
      .rejects.toMatchObject({ code: 'kde-harness-mp/backend-required' })
    expect(await controller.getBackendConfig()).toEqual({
      baseUrl: '',
      configured: false,
      mcpReady: false,
    })
  })

  it('unwraps employee login from MCP text content', async () => {
    const { sessionPersistence, baseRoot } = await mockPersistence()
    const execute = vi.fn(async () => ({
      isError: false,
      value: {
        content: [{
          type: 'text',
          text: JSON.stringify({
            employee: { empinfoId: 9, staffNumber: 'E01', name: 'Ada', orgId: 12, orgName: 'Org A', userId: 7 },
          }),
        }],
      },
      content: [],
    }))
    const controller = await harness(execute, sessionPersistence)
    const logged = await controller.harnessLogin({
      orgId: 12,
      staffNumber: 'E01',
      password: 'secret',
    }, AbortSignal.timeout(1000))
    expect(logged.employee.staffNumber).toBe('E01')
    expect(controller.isLoggedIn()).toBe(true)
    expect(sessionPersistence.bindRoot).toHaveBeenCalledWith(employeeSessionRoot(baseRoot, '12__E01'))
  })

  it('records a successful Harness platform login, migrates once, and rejects a missing employee object', async () => {
    const { sessionPersistence, baseRoot } = await mockPersistence()
    const legacy = join(baseRoot, '--work--')
    await mkdir(legacy, { recursive: true })
    await writeFile(join(legacy, 'keep.txt'), 'legacy')

    const execute = vi.fn(async () => ({
      isError: false,
      value: {
        employee: {
          empinfoId: 9,
          staffNumber: 'E01',
          name: 'Ada',
          orgId: 12,
          orgName: 'Org A',
          userId: 7,
        },
      },
      content: [],
    }))
    const controller = await harness(execute, sessionPersistence)
    const logged = await controller.harnessLogin({
      orgId: 12,
      staffNumber: 'E01',
      password: 'secret',
    }, AbortSignal.timeout(1000))
    expect(logged.employee).toEqual({
      empinfoId: '9',
      staffNumber: 'E01',
      name: 'Ada',
      orgId: '12',
      orgName: 'Org A',
      userId: '7',
    })
    expect(controller.isLoggedIn()).toBe(true)
    expect(controller.status()).toEqual({
      loggedIn: true,
      employee: logged.employee,
    })
    expect(sessionPersistence.closeOpenWriters).toHaveBeenCalled()
    expect(sessionPersistence.bindRoot).toHaveBeenCalledWith(employeeSessionRoot(baseRoot, '12__E01'))
    expect(vi.mocked(sessionPersistence.closeOpenWriters).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(sessionPersistence.bindRoot).mock.invocationCallOrder[0]!)
    expect(await readFile(join(baseRoot, KDE_HARNESS_MP_EMPLOYEE_SCOPE_MARKER), 'utf8')).toContain('"firstEmployeeKey":"12__E01"')
    expect(await readdir(employeeSessionRoot(baseRoot, '12__E01'))).toContain('--work--')
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      name: LOGIN_TOOL,
      arguments: { orgId: 12, staffNumber: 'E01', password: 'secret' },
    }))

    const again = await controller.harnessLogin({
      orgId: 12,
      staffNumber: 'E01',
      password: 'secret',
    }, AbortSignal.timeout(1000))
    expect(again.employee).toEqual(logged.employee)
    expect(sessionPersistence.bindRoot).toHaveBeenCalledTimes(1)

    await expect(controller.harnessLogin({
      orgId: 99,
      staffNumber: 'E02',
      password: 'other',
    }, AbortSignal.timeout(1000))).rejects.toMatchObject({
      code: 'kde-harness-mp/employee-switch-requires-restart',
    })

    await controller.logout()
    expect(controller.isLoggedIn()).toBe(false)
    expect(controller.status()).toEqual({ loggedIn: false })
    expect(sessionPersistence.closeOpenWriters).toHaveBeenCalledTimes(2)
    expect(sessionPersistence.bindRoot).toHaveBeenLastCalledWith(baseRoot)
    expect(vi.mocked(sessionPersistence.closeOpenWriters).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(sessionPersistence.bindRoot).mock.invocationCallOrder.at(-1)!)

    const { sessionPersistence: missingPersistence } = await mockPersistence()
    const missing = await harness(vi.fn(async () => ({
      isError: false,
      value: { employee: null },
      content: [],
    })), missingPersistence)
    await expect(missing.harnessLogin({
      orgId: 1,
      staffNumber: 'x',
      password: 'y',
    }, AbortSignal.timeout(1000))).rejects.toMatchObject({ message: 'employee login result is missing' })
  })

  it('fills empty employee strings when optional fields are absent', async () => {
    const { sessionPersistence } = await mockPersistence()
    const execute = vi.fn(async () => ({
      isError: false,
      value: { employee: { empinfoId: 'E-1' } },
      content: [],
    }))
    const logged = await (await harness(execute, sessionPersistence)).harnessLogin({
      orgId: 1,
      staffNumber: 'x',
      password: 'y',
    }, AbortSignal.timeout(1000))
    expect(logged.employee).toEqual({
      empinfoId: 'E-1',
      staffNumber: '',
      name: '',
      orgId: '',
      orgName: '',
      userId: '',
    })
  })

  it('moves a later session into the employee project directory that already exists', async () => {
    const { baseRoot } = await mockPersistence()
    const employeeRoot = employeeSessionRoot(baseRoot, '1__004')
    const project = '--D-work--'
    await mkdir(join(employeeRoot, project), { recursive: true })
    await writeFile(join(employeeRoot, project, 'kept.txt'), 'already')
    const legacy = join(baseRoot, project, 'session-new')
    await mkdir(legacy, { recursive: true })
    await writeFile(join(legacy, 'log.txt'), 'new')
    await migrateLegacySessionsOnce(baseRoot, employeeRoot, '1__004')
    expect(await readFile(join(employeeRoot, project, 'session-new', 'log.txt'), 'utf8')).toBe('new')
    expect(await readFile(join(employeeRoot, project, 'kept.txt'), 'utf8')).toBe('already')
    await expect(readdir(join(baseRoot, project))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readdir(baseRoot)).toEqual(expect.arrayContaining([KDE_HARNESS_MP_EMPLOYEE_SCOPE_MARKER, 'employees']))
  })

  it('skips legacy migration when the scope marker already exists', async () => {
    const { baseRoot, sessionPersistence } = await mockPersistence()
    const firstRoot = employeeSessionRoot(baseRoot, '12__E01')
    await migrateLegacySessionsOnce(baseRoot, firstRoot, '12__E01')
    const leftover = join(baseRoot, '--later--')
    await mkdir(leftover, { recursive: true })
    await migrateLegacySessionsOnce(baseRoot, employeeSessionRoot(baseRoot, '99__E02'), '99__E02')
    expect(await readdir(baseRoot)).toEqual(expect.arrayContaining(['--later--', KDE_HARNESS_MP_EMPLOYEE_SCOPE_MARKER]))
    expect(employeeScopeKey({
      empinfoId: '1',
      staffNumber: 'E02',
      name: 'Bob',
      orgId: '99',
      orgName: 'Org B',
      userId: '2',
    })).toBe('99__E02')

    const execute = vi.fn(async () => ({
      isError: false,
      value: {
        employee: {
          empinfoId: 2,
          staffNumber: 'E02',
          name: 'Bob',
          orgId: 99,
          orgName: 'Org B',
          userId: 2,
        },
      },
      content: [],
    }))
    await (await harness(execute, sessionPersistence)).harnessLogin({
      orgId: 99,
      staffNumber: 'E02',
      password: 'pw',
    }, AbortSignal.timeout(1000))
    expect(await readdir(baseRoot)).toEqual(expect.arrayContaining(['--later--']))
  })

  it('logout is idempotent when already signed out', async () => {
    const { sessionPersistence } = await mockPersistence()
    const controller = await harness(vi.fn(), sessionPersistence)
    await controller.logout()
    expect(controller.isLoggedIn()).toBe(false)
    expect(sessionPersistence.closeOpenWriters).not.toHaveBeenCalled()
    // setBackendConfig does not touch sessionPersistence.bindRoot for employee scope
    expect(sessionPersistence.bindRoot).not.toHaveBeenCalled()
  })
})
