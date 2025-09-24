// Set Dynamoose log level to only show warnings and errors
process.env.DYNAMOOSE_LOG_LEVEL = "warn";

import { InitializeApp } from './app'
import { Logger } from './utils'
import { PORT, NODE_ENV } from './config'
import http from 'http'
import { Server as IOServer } from 'socket.io'
import { ProcessingService } from './services'

let io

export const getIO = () => io

//Initialize server
(async () => {
	try {
		const app = await InitializeApp()
		const server = http.createServer(app)
		io = new IOServer(server, { cors: { origin: '*' } })

		// Socket connection handling
		io.on('connection', socket => {
			Logger.info('Socket connected', socket.id)

			socket.on('subscribe', ({ jobId }) => {
				// on subscription, send current state and register
				const job = ProcessingService.getJob(jobId)
				if (job) socket.emit('update', job)
				const listener = (update) => { if (update.id === jobId) socket.emit('update', update) }
				ProcessingService.on(jobId, listener)

				socket.on('disconnect', () => ProcessingService.off(jobId, listener))
				socket.on('cancel', async ({ jobId }) => {
					try { await ProcessingService.cancel(jobId); socket.emit('cancelled', { jobId }) } catch (e) { socket.emit('error', { message: e.message }) }
				})
			})
		})

		server.listen(PORT, () => {
			Logger.success(`Server Running on ${PORT}, environment: ${NODE_ENV}`)
		})
	}
	catch (err) {
		Logger.error('Bootstrap server error' + err.message)
		throw (err)
	}
})()