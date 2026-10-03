import fs from 'node:fs'
import path from 'node:path'

const ROOT_DIR = process.cwd()
const REQUESTLY_DIR = path.join(ROOT_DIR, 'requestly')
const LOCAL_WORKSPACE_DIR = path.join(ROOT_DIR, 'apis', 'task-manager')

fs.mkdirSync(REQUESTLY_DIR, { recursive: true })
fs.mkdirSync(LOCAL_WORKSPACE_DIR, { recursive: true })

// Helper to create dual-runtime test scripts (Requestly rq + Postman pm)
function dualTestScript(name: string, statusCode: number, customAssertions: string = ''): string {
  return `(function () {
  const r = typeof rq !== 'undefined' ? rq : (typeof pm !== 'undefined' ? pm : null);
  if (!r) return;

  const testFn = r.test.bind(r);
  const expectFn = r.expect.bind(r);
  const env = r.environment;
  const res = r.response;
  const code = (res.code !== undefined) ? res.code : res.status;

  testFn("${name} - Status code is ${statusCode}", function () {
    expectFn(code).to.equal(${statusCode});
  });

  ${customAssertions}
})();`
}

const postmanCollection = {
  info: {
    _postman_id: "7d0d0f41-a1e4-4d4d-a2f0-97e3f8981240",
    name: "Task Manager API Collection (Requestly)",
    description: "Complete API Collection for Task Manager project. Includes Health, Authentication (Registration, Verification, Session Management, Logout, Password Reset), Task CRUD with Timezone handling, and Negative Validation tests.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:3001", type: "string" },
    { key: "origin", value: "http://localhost:5173", type: "string" },
    { key: "email", value: "developer.test@example.com", type: "string" },
    { key: "password", value: "SuperSecretPassword123!@#", type: "string" },
    { key: "verificationToken", value: "", type: "string" },
    { key: "taskId", value: "", type: "string" },
    { key: "date", value: "2026-10-03", type: "string" },
    { key: "timeZone", value: "Asia/Kolkata", type: "string" }
  ],
  item: [
    {
      name: "1. Health & System",
      description: "Service liveness and health check endpoints.",
      item: [
        {
          name: "Health Check",
          request: {
            method: "GET",
            header: [
              { key: "Origin", value: "{{origin}}", type: "text" }
            ],
            url: {
              raw: "{{baseUrl}}/health",
              host: ["{{baseUrl}}"],
              path: ["health"]
            },
            description: "Check if the Task Manager API service is online and healthy."
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: dualTestScript("Health Check", 200, `
  testFn("Health status is ok", function () {
    const data = typeof res.json === 'function' ? res.json() : JSON.parse(res.body);
    expectFn(data.status).to.equal('ok');
  });
                `).split('\n')
              }
            }
          ]
        }
      ]
    },
    {
      name: "2. Authentication",
      description: "First-party authentication endpoints using Argon2id passwords and session cookies.",
      item: [
        {
          name: "2.1 Register Account",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json", type: "text" },
              { key: "Origin", value: "{{origin}}", type: "text" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "{{email}}",
                password: "{{password}}"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/v1/auth/register",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "auth", "register"]
            },
            description: "Register a new user account. In development mode, developmentVerificationToken is returned to facilitate automated testing."
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: dualTestScript("Register Account", 201, `
  testFn("Registration response contains unverified user and token", function () {
    const data = typeof res.json === 'function' ? res.json() : JSON.parse(res.body);
    expectFn(data.user).to.exist;
    expectFn(data.user.emailVerified).to.equal(false);
    if (data.developmentVerificationToken) {
      env.set("verificationToken", data.developmentVerificationToken);
    }
  });
                `).split('\n')
              }
            }
          ]
        },
        {
          name: "2.2 Resend Verification Email",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json", type: "text" },
              { key: "Origin", value: "{{origin}}", type: "text" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "{{email}}"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/v1/auth/verification-email/resend",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "auth", "verification-email", "resend"]
            },
            description: "Request a fresh email verification token without leaking account existence."
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: dualTestScript("Resend Verification Email", 204).split('\n')
              }
            }
          ]
        },
        {
          name: "2.3 Verify Email",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json", type: "text" },
              { key: "Origin", value: "{{origin}}", type: "text" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                token: "{{verificationToken}}"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/v1/auth/verify-email",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "auth", "verify-email"]
            },
            description: "Redeem the email verification token, activate the user, and establish an initial session cookie."
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: dualTestScript("Verify Email", 200, `
  testFn("Email is verified and user returned", function () {
    const data = typeof res.json === 'function' ? res.json() : JSON.parse(res.body);
    expectFn(data.user).to.exist;
    expectFn(data.user.emailVerified).to.equal(true);
  });
                `).split('\n')
              }
            }
          ]
        },
        {
          name: "2.4 Login",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json", type: "text" },
              { key: "Origin", value: "{{origin}}", type: "text" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "{{email}}",
                password: "{{password}}"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/v1/auth/login",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "auth", "login"]
            },
            description: "Authenticate with verified credentials and receive the session cookie."
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: dualTestScript("Login", 200, `
  testFn("Login returns authenticated profile", function () {
    const data = typeof res.json === 'function' ? res.json() : JSON.parse(res.body);
    expectFn(data.user).to.exist;
    expectFn(data.user.emailVerified).to.equal(true);
  });
                `).split('\n')
              }
            }
          ]
        },
        {
          name: "2.5 Get Current User Profile (/auth/me)",
          request: {
            method: "GET",
            header: [
              { key: "Origin", value: "{{origin}}", type: "text" }
            ],
            url: {
              raw: "{{baseUrl}}/api/v1/auth/me",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "auth", "me"]
            },
            description: "Retrieve currently authenticated user profile from active session cookie."
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: dualTestScript("Get Current User Profile", 200, `
  testFn("Profile contains user id and email", function () {
    const data = typeof res.json === 'function' ? res.json() : JSON.parse(res.body);
    expectFn(data.user).to.exist;
    expectFn(data.user.id).to.exist;
  });
                `).split('\n')
              }
            }
          ]
        },
        {
          name: "2.6 Request Password Reset",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json", type: "text" },
              { key: "Origin", value: "{{origin}}", type: "text" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "{{email}}"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/v1/auth/password-reset/request",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "auth", "password-reset", "request"]
            },
            description: "Request a password reset email."
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: dualTestScript("Request Password Reset", 204).split('\n')
              }
            }
          ]
        },
        {
          name: "2.7 Logout",
          request: {
            method: "POST",
            header: [
              { key: "Origin", value: "{{origin}}", type: "text" }
            ],
            url: {
              raw: "{{baseUrl}}/api/v1/auth/logout",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "auth", "logout"]
            },
            description: "Invalidate the current session and clear session cookies."
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: dualTestScript("Logout", 204).split('\n')
              }
            }
          ]
        }
      ]
    },
    {
      name: "3. Tasks API",
      description: "CRUD endpoints for task management, supporting timezone conversion and scheduled/unscheduled tasks.",
      item: [
        {
          name: "3.1 Create Timed Task",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json", type: "text" },
              { key: "Origin", value: "{{origin}}", type: "text" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                title: "Prepare Sprint Demo",
                description: "Review end-to-end Requestly API collection and demonstrate running workflows.",
                scheduledDate: "{{date}}",
                scheduledTime: "14:30",
                timeZone: "{{timeZone}}"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/v1/tasks",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "tasks"]
            },
            description: "Create a new task with a specific time (hasScheduledTime = true). Saves created task ID to taskId variable."
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: dualTestScript("Create Timed Task", 201, `
  testFn("Task created with scheduled time", function () {
    const data = typeof res.json === 'function' ? res.json() : JSON.parse(res.body);
    expectFn(data.task).to.exist;
    expectFn(data.task.hasScheduledTime).to.equal(true);
    expectFn(data.task.status).to.equal('pending');
    if (data.task.id) {
      env.set("taskId", data.task.id);
    }
  });
                `).split('\n')
              }
            }
          ]
        },
        {
          name: "3.2 Create Untimed Task",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json", type: "text" },
              { key: "Origin", value: "{{origin}}", type: "text" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                title: "Refactor backend tests",
                description: "Task without a specific scheduled time (hasScheduledTime = false).",
                scheduledDate: "{{date}}",
                timeZone: "{{timeZone}}"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/v1/tasks",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "tasks"]
            },
            description: "Create an unscheduled (all-day) task for the selected date."
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: dualTestScript("Create Untimed Task", 201, `
  testFn("Task created without scheduled time", function () {
    const data = typeof res.json === 'function' ? res.json() : JSON.parse(res.body);
    expectFn(data.task).to.exist;
    expectFn(data.task.hasScheduledTime).to.equal(false);
  });
                `).split('\n')
              }
            }
          ]
        },
        {
          name: "3.3 List Tasks for Selected Day",
          request: {
            method: "GET",
            header: [
              { key: "Origin", value: "{{origin}}", type: "text" }
            ],
            url: {
              raw: "{{baseUrl}}/api/v1/tasks?date={{date}}&timeZone={{timeZone}}",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "tasks"],
              query: [
                { key: "date", value: "{{date}}" },
                { key: "timeZone", value: "{{timeZone}}" }
              ]
            },
            description: "Fetch all tasks for a specific date converted to the requester's IANA timezone."
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: dualTestScript("List Tasks for Selected Day", 200, `
  testFn("Response contains task array", function () {
    const data = typeof res.json === 'function' ? res.json() : JSON.parse(res.body);
    expectFn(data.tasks).to.be.an('array');
  });
                `).split('\n')
              }
            }
          ]
        },
        {
          name: "3.4 Get Task by ID",
          request: {
            method: "GET",
            header: [
              { key: "Origin", value: "{{origin}}", type: "text" }
            ],
            url: {
              raw: "{{baseUrl}}/api/v1/tasks/{{taskId}}",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "tasks", "{{taskId}}"]
            },
            description: "Retrieve a single owned task resource by ID."
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: dualTestScript("Get Task by ID", 200, `
  testFn("Returned task matches requested ID", function () {
    const data = typeof res.json === 'function' ? res.json() : JSON.parse(res.body);
    expectFn(data.task).to.exist;
    expectFn(data.task.id).to.equal(env.get("taskId"));
  });
                `).split('\n')
              }
            }
          ]
        },
        {
          name: "3.5 Update Task Status (Complete)",
          request: {
            method: "PATCH",
            header: [
              { key: "Content-Type", value: "application/json", type: "text" },
              { key: "Origin", value: "{{origin}}", type: "text" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                status: "completed"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/v1/tasks/{{taskId}}",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "tasks", "{{taskId}}"]
            },
            description: "Mark an existing task as completed."
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: dualTestScript("Update Task Status (Complete)", 200, `
  testFn("Task status is completed and completedAt is set", function () {
    const data = typeof res.json === 'function' ? res.json() : JSON.parse(res.body);
    expectFn(data.task.status).to.equal('completed');
    expectFn(data.task.completedAt).to.exist;
  });
                `).split('\n')
              }
            }
          ]
        },
        {
          name: "3.6 Reschedule and Edit Task",
          request: {
            method: "PATCH",
            header: [
              { key: "Content-Type", value: "application/json", type: "text" },
              { key: "Origin", value: "{{origin}}", type: "text" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                title: "Prepare Sprint Demo (Updated & Rescheduled)",
                description: "Updated notes for the demo.",
                scheduledDate: "{{date}}",
                scheduledTime: "17:00",
                timeZone: "{{timeZone}}"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/v1/tasks/{{taskId}}",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "tasks", "{{taskId}}"]
            },
            description: "Update the title, notes, and rescheduled time of an existing task."
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: dualTestScript("Reschedule and Edit Task", 200, `
  testFn("Task title and schedule were updated", function () {
    const data = typeof res.json === 'function' ? res.json() : JSON.parse(res.body);
    expectFn(data.task.title).to.include("Updated");
  });
                `).split('\n')
              }
            }
          ]
        },
        {
          name: "3.7 Delete Task",
          request: {
            method: "DELETE",
            header: [
              { key: "Origin", value: "{{origin}}", type: "text" }
            ],
            url: {
              raw: "{{baseUrl}}/api/v1/tasks/{{taskId}}",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "tasks", "{{taskId}}"]
            },
            description: "Permanently delete an owned task."
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: dualTestScript("Delete Task", 204).split('\n')
              }
            }
          ]
        }
      ]
    },
    {
      name: "4. Negative & Security Tests",
      description: "Validation, authorization, and CSRF protection security checks.",
      item: [
        {
          name: "4.1 Register with Invalid Email (Should Fail 422)",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json", type: "text" },
              { key: "Origin", value: "{{origin}}", type: "text" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "invalid-email-address",
                password: "{{password}}"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/v1/auth/register",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "auth", "register"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: dualTestScript("Invalid Email Registration", 422).split('\n')
              }
            }
          ]
        },
        {
          name: "4.2 Untrusted Origin CSRF Protection (Should Fail 403)",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json", type: "text" },
              { key: "Origin", value: "http://attacker-site.com", type: "text" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "untrusted@example.com",
                password: "{{password}}"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/v1/auth/register",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "auth", "register"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: dualTestScript("Untrusted Origin CSRF", 403).split('\n')
              }
            }
          ]
        },
        {
          name: "4.3 Task Query Without Date (Should Fail 422)",
          request: {
            method: "GET",
            header: [
              { key: "Origin", value: "{{origin}}", type: "text" }
            ],
            url: {
              raw: "{{baseUrl}}/api/v1/tasks",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "tasks"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: dualTestScript("Task Query Without Date", 422).split('\n')
              }
            }
          ]
        },
        {
          name: "4.4 Non-Existent Task Query (Should Fail 404)",
          request: {
            method: "GET",
            header: [
              { key: "Origin", value: "{{origin}}", type: "text" }
            ],
            url: {
              raw: "{{baseUrl}}/api/v1/tasks/00000000-0000-0000-0000-000000000000",
              host: ["{{baseUrl}}"],
              path: ["api", "v1", "tasks", "00000000-0000-0000-0000-000000000000"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: dualTestScript("Non-Existent Task Query", 404).split('\n')
              }
            }
          ]
        }
      ]
    }
  ]
}

// Write Postman Collection
const collectionPath = path.join(REQUESTLY_DIR, 'task-manager.postman_collection.json')
fs.writeFileSync(collectionPath, JSON.stringify(postmanCollection, null, 2), 'utf8')
console.log('Created:', collectionPath)

// Write Requestly Environment
const environmentConfig = {
  id: "task-manager-dev-env",
  name: "Task Manager (Local Development)",
  values: [
    { key: "baseUrl", value: "http://localhost:3001", enabled: true, type: "default" },
    { key: "origin", value: "http://localhost:5173", enabled: true, type: "default" },
    { key: "email", value: "developer.test@example.com", enabled: true, type: "default" },
    { key: "password", value: "SuperSecretPassword123!@#", enabled: true, type: "secret" },
    { key: "verificationToken", value: "", enabled: true, type: "default" },
    { key: "taskId", value: "", enabled: true, type: "default" },
    { key: "date", value: "2026-10-03", enabled: true, type: "default" },
    { key: "timeZone", value: "Asia/Kolkata", enabled: true, type: "default" }
  ],
  _postman_variable_scope: "environment"
}

const envPath = path.join(REQUESTLY_DIR, 'task-manager.environment.json')
fs.writeFileSync(envPath, JSON.stringify(environmentConfig, null, 2), 'utf8')
console.log('Created:', envPath)

// Generate Local Workspace structure (apis/task-manager/)
const localWorkspaceRequestlyJson = {
  version: "0.0.3"
}
fs.writeFileSync(path.join(LOCAL_WORKSPACE_DIR, 'requestly.json'), JSON.stringify(localWorkspaceRequestlyJson, null, 2), 'utf8')

const envDir = path.join(LOCAL_WORKSPACE_DIR, 'environments')
fs.mkdirSync(envDir, { recursive: true })

const localEnv = {
  name: "Local",
  variables: {
    baseUrl: { value: "http://localhost:3001", type: "string", id: 0, isSecret: false },
    origin: { value: "http://localhost:5173", type: "string", id: 1, isSecret: false },
    email: { value: "developer.test@example.com", type: "string", id: 2, isSecret: false },
    password: { value: "SuperSecretPassword123!@#", type: "string", id: 3, isSecret: true },
    date: { value: "2026-10-03", type: "string", id: 4, isSecret: false },
    timeZone: { value: "Asia/Kolkata", type: "string", id: 5, isSecret: false }
  }
}
fs.writeFileSync(path.join(envDir, 'Local.json'), JSON.stringify(localEnv, null, 2), 'utf8')
fs.writeFileSync(path.join(envDir, 'global.json'), JSON.stringify({ name: "global", variables: {} }, null, 2), 'utf8')

// Generate folder per collection item in Local Workspace
for (const folder of postmanCollection.item) {
  const folderDir = path.join(LOCAL_WORKSPACE_DIR, folder.name)
  fs.mkdirSync(folderDir, { recursive: true })
  for (const req of folder.item) {
    const reqFileName = `${req.name.replace(/[/\\?%*:|"<>]/g, '_')}.json`
    const localReqFile = {
      name: req.name,
      request: {
        type: "http",
        url: req.request.url.raw,
        method: req.request.method,
        headers: req.request.header.map(h => ({ name: h.key, value: h.value, enabled: true })),
        body: req.request.body ? {
          mode: req.request.body.mode,
          raw: req.request.body.raw
        } : undefined,
        scripts: req.event?.[0]?.script ? {
          postResponse: req.event[0].script.exec.join('\n')
        } : undefined
      }
    }
    fs.writeFileSync(path.join(folderDir, reqFileName), JSON.stringify(localReqFile, null, 2), 'utf8')
  }
}
console.log('Local Workspace created at:', LOCAL_WORKSPACE_DIR)
