import assert from 'node:assert/strict'
import test from 'node:test'
import { eq } from 'drizzle-orm'
import { db } from '../src/db/client.js'
import { accountTokens, tasks, users } from '../src/db/schema.js'

const BASE_URL = process.env.API_URL ?? 'http://localhost:3001'
const ORIGIN = process.env.APP_ORIGIN ?? 'http://localhost:5173'

interface ApiResponse<T = any> {
  status: number
  headers: Headers
  body: T
  rawCookies: string[]
}

async function apiRequest<T = any>(
  path: string,
  options: {
    method?: string
    body?: any
    headers?: Record<string, string>
    cookie?: string
  } = {}
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Origin: ORIGIN,
    ...options.headers,
  }

  if (options.cookie) {
    headers['Cookie'] = options.cookie
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  let body: any = null
  const text = await response.text()
  if (text.length > 0) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }

  const rawCookies: string[] = []
  const setCookie = response.headers.getSetCookie?.() ?? []
  for (const c of setCookie) {
    rawCookies.push(c)
  }

  return {
    status: response.status,
    headers: response.headers,
    body,
    rawCookies,
  }
}

function extractCookie(rawCookies: string[], name: string): string | undefined {
  for (const c of rawCookies) {
    const parts = c.split(';')
    const [k, v] = parts[0].split('=')
    if (k?.trim() === name) {
      return `${k.trim()}=${v?.trim()}`
    }
  }
  return undefined
}

test('End-to-End API Test Suite for Task Manager', async (t) => {
  const timestamp = Date.now()
  const testEmail = `e2e_user_${timestamp}@example.com`
  const resendTestEmail = `e2e_resend_${timestamp}@example.com`
  const testPassword = 'Password1234!@#'
  const newPassword = 'NewPassword5678!@#'
  let verificationToken = ''
  let sessionCookie = ''
  let createdTaskId = ''

  await t.test('1. System Health Check (GET /health)', async () => {
    const res = await apiRequest('/health', { headers: { Origin: ORIGIN } })
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { status: 'ok' })
  })

  await t.test('2. CSRF / Untrusted Origin Protection', async () => {
    const res = await apiRequest('/api/v1/auth/register', {
      method: 'POST',
      headers: { Origin: 'http://untrusted-site.evil.com' },
      body: { email: testEmail, password: testPassword },
    })
    assert.equal(res.status, 403)
    assert.equal(res.body?.error?.code, 'UNTRUSTED_ORIGIN')
  })

  await t.test('3. Auth Registration Validation (Negative Tests - 422)', async () => {
    // Invalid email
    const invalidEmailRes = await apiRequest('/api/v1/auth/register', {
      method: 'POST',
      body: { email: 'not-an-email', password: testPassword },
    })
    assert.equal(invalidEmailRes.status, 422)
    assert.equal(invalidEmailRes.body?.error?.code, 'VALIDATION_ERROR')

    // Password too short (< 12 chars)
    const shortPasswordRes = await apiRequest('/api/v1/auth/register', {
      method: 'POST',
      body: { email: testEmail, password: 'short' },
    })
    assert.equal(shortPasswordRes.status, 422)
    assert.equal(shortPasswordRes.body?.error?.code, 'VALIDATION_ERROR')
  })

  await t.test('4. Successful User Registration (POST /api/v1/auth/register)', async () => {
    const res = await apiRequest('/api/v1/auth/register', {
      method: 'POST',
      body: { email: testEmail, password: testPassword },
    })
    assert.equal(res.status, 201)
    assert.equal(res.body?.user?.email, testEmail)
    assert.equal(res.body?.user?.emailVerified, false)
    assert.ok(res.body?.developmentVerificationToken, 'Expected developmentVerificationToken in dev mode')
    verificationToken = res.body.developmentVerificationToken
  })

  await t.test('5. Login Before Verification (Should Fail 403)', async () => {
    const res = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: testPassword },
    })
    assert.equal(res.status, 403)
    assert.equal(res.body?.error?.code, 'EMAIL_NOT_VERIFIED')
  })

  await t.test('6. Verify Email with Invalid Token (Should Fail 400)', async () => {
    const res = await apiRequest('/api/v1/auth/verify-email', {
      method: 'POST',
      body: { token: 'invalid_token_which_is_thirty_two_chars_long_1234' },
    })
    assert.equal(res.status, 400)
    assert.equal(res.body?.error?.code, 'INVALID_TOKEN')
  })

  await t.test('7. Verify Email with Valid Token (POST /api/v1/auth/verify-email)', async () => {
    const res = await apiRequest('/api/v1/auth/verify-email', {
      method: 'POST',
      body: { token: verificationToken },
    })
    assert.equal(res.status, 200)
    assert.equal(res.body?.user?.emailVerified, true)

    const cookie = extractCookie(res.rawCookies, 'task_manager_session')
    assert.ok(cookie, 'Expected task_manager_session cookie to be set upon email verification')
    sessionCookie = cookie
  })

  await t.test('8. Resend Verification Email (POST /api/v1/auth/verification-email/resend)', async () => {
    // Register temporary unverified user
    await apiRequest('/api/v1/auth/register', {
      method: 'POST',
      body: { email: resendTestEmail, password: testPassword },
    })

    const res = await apiRequest('/api/v1/auth/verification-email/resend', {
      method: 'POST',
      body: { email: resendTestEmail },
    })
    assert.equal(res.status, 204)
  })

  await t.test('9. Authenticated User Profile (GET /api/v1/auth/me)', async () => {
    const res = await apiRequest('/api/v1/auth/me', {
      cookie: sessionCookie,
    })
    assert.equal(res.status, 200)
    assert.equal(res.body?.user?.email, testEmail)
    assert.equal(res.body?.user?.emailVerified, true)
  })

  await t.test('10. User Logout (POST /api/v1/auth/logout)', async () => {
    const res = await apiRequest('/api/v1/auth/logout', {
      method: 'POST',
      cookie: sessionCookie,
    })
    assert.equal(res.status, 204)
  })

  await t.test('11. Profile Access After Logout (Should Fail 401)', async () => {
    const res = await apiRequest('/api/v1/auth/me', {
      cookie: sessionCookie,
    })
    assert.equal(res.status, 401)
    assert.equal(res.body?.error?.code, 'UNAUTHENTICATED')
  })

  await t.test('12. User Login with Verified Account (POST /api/v1/auth/login)', async () => {
    const res = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: testPassword },
    })
    assert.equal(res.status, 200)
    assert.equal(res.body?.user?.email, testEmail)

    const cookie = extractCookie(res.rawCookies, 'task_manager_session')
    assert.ok(cookie, 'Expected new session cookie on login')
    sessionCookie = cookie
  })

  await t.test('13. Password Reset Flow (Request & Confirm)', async () => {
    // Request reset
    const reqRes = await apiRequest('/api/v1/auth/password-reset/request', {
      method: 'POST',
      body: { email: testEmail },
    })
    assert.equal(reqRes.status, 204)

    // Invalid confirm token returns 400
    const invalidConfirmRes = await apiRequest('/api/v1/auth/password-reset/confirm', {
      method: 'POST',
      body: { token: 'invalid_token_which_is_at_least_32_characters_long_abcdef', password: newPassword },
    })
    assert.equal(invalidConfirmRes.status, 400)
    assert.equal(invalidConfirmRes.body?.error?.code, 'INVALID_TOKEN')
  })

  await t.test('14. Create Task Validation (Missing Required Fields - 422)', async () => {
    const res = await apiRequest('/api/v1/tasks', {
      method: 'POST',
      cookie: sessionCookie,
      body: { title: '' }, // empty title and missing date/timeZone
    })
    assert.equal(res.status, 422)
    assert.equal(res.body?.error?.code, 'VALIDATION_ERROR')
  })

  await t.test('15. Create Timed Task (POST /api/v1/tasks)', async () => {
    const res = await apiRequest('/api/v1/tasks', {
      method: 'POST',
      cookie: sessionCookie,
      body: {
        title: 'Complete Requestly integration testing',
        description: 'Set up collection and verify every API endpoint end-to-end',
        scheduledDate: '2026-10-03',
        scheduledTime: '16:00',
        timeZone: 'Asia/Kolkata',
      },
    })
    assert.equal(res.status, 201)
    assert.equal(res.body?.task?.title, 'Complete Requestly integration testing')
    assert.equal(res.body?.task?.hasScheduledTime, true)
    assert.equal(res.body?.task?.status, 'pending')
    assert.ok(res.body?.task?.id)
    createdTaskId = res.body.task.id
  })

  await t.test('16. Create Untimed Task (POST /api/v1/tasks)', async () => {
    const res = await apiRequest('/api/v1/tasks', {
      method: 'POST',
      cookie: sessionCookie,
      body: {
        title: 'Review collection documentation',
        description: 'Ensure Requestly collections are fully documented with README',
        scheduledDate: '2026-10-03',
        timeZone: 'Asia/Kolkata',
      },
    })
    assert.equal(res.status, 201)
    assert.equal(res.body?.task?.hasScheduledTime, false)
    assert.equal(res.body?.task?.status, 'pending')
  })

  await t.test('17. List Tasks for Selected Day (GET /api/v1/tasks)', async () => {
    const res = await apiRequest('/api/v1/tasks?date=2026-10-03&timeZone=Asia%2FKolkata', {
      cookie: sessionCookie,
    })
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body?.tasks))
    assert.ok(res.body.tasks.length >= 2, 'Expected at least 2 tasks returned')

    const found = res.body.tasks.some((task: any) => task.id === createdTaskId)
    assert.ok(found, 'Created task ID should be present in the day list')
  })

  await t.test('18. Get Task by ID (GET /api/v1/tasks/:id)', async () => {
    const res = await apiRequest(`/api/v1/tasks/${createdTaskId}`, {
      cookie: sessionCookie,
    })
    assert.equal(res.status, 200)
    assert.equal(res.body?.task?.id, createdTaskId)
    assert.equal(res.body?.task?.title, 'Complete Requestly integration testing')
  })

  await t.test('19. Update Task Status to Completed (PATCH /api/v1/tasks/:id)', async () => {
    const res = await apiRequest(`/api/v1/tasks/${createdTaskId}`, {
      method: 'PATCH',
      cookie: sessionCookie,
      body: {
        status: 'completed',
      },
    })
    assert.equal(res.status, 200)
    assert.equal(res.body?.task?.status, 'completed')
    assert.ok(res.body?.task?.completedAt, 'completedAt should be populated')
  })

  await t.test('20. Update Task Schedule and Title (PATCH /api/v1/tasks/:id)', async () => {
    const res = await apiRequest(`/api/v1/tasks/${createdTaskId}`, {
      method: 'PATCH',
      cookie: sessionCookie,
      body: {
        title: 'Complete Requestly integration testing (Updated)',
        description: 'Successfully verified all endpoints with Requestly collection',
        scheduledDate: '2026-10-03',
        scheduledTime: '17:30',
        timeZone: 'Asia/Kolkata',
      },
    })
    assert.equal(res.status, 200)
    assert.equal(res.body?.task?.title, 'Complete Requestly integration testing (Updated)')
  })

  await t.test('21. Delete Task (DELETE /api/v1/tasks/:id)', async () => {
    const res = await apiRequest(`/api/v1/tasks/${createdTaskId}`, {
      method: 'DELETE',
      cookie: sessionCookie,
    })
    assert.equal(res.status, 204)
  })

  await t.test('22. Get Deleted Task (Should Return 404 NOT_FOUND)', async () => {
    const res = await apiRequest(`/api/v1/tasks/${createdTaskId}`, {
      cookie: sessionCookie,
    })
    assert.equal(res.status, 404)
    assert.equal(res.body?.error?.code, 'NOT_FOUND')
  })

  await t.test('23. Unauthenticated Task Access (Should Return 401)', async () => {
    const res = await apiRequest('/api/v1/tasks?date=2026-10-03&timeZone=UTC')
    assert.equal(res.status, 401)
    assert.equal(res.body?.error?.code, 'UNAUTHENTICATED')
  })

  // Cleanup test users and tasks
  if (createdTaskId) {
    await db.delete(tasks).where(eq(tasks.id, createdTaskId))
  }
  await db.delete(users).where(eq(users.email, testEmail))
  await db.delete(users).where(eq(users.email, resendTestEmail))
})
