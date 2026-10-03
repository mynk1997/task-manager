import { createApp } from './app.js'
import { config } from './config.js'
import { pool } from './db/client.js'

const app = createApp()
const server = app.listen(config.port, () => {
  console.info(`Task Manager API listening on http://localhost:${config.port}`)
})

async function shutdown() {
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
