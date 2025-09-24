import EventEmitter from 'events'
import { v4 as uuidv4 } from 'uuid'
import { TranscriptionService } from './transcriptionService'
import { Logger } from '../utils'
import { S3Service } from './s3Service'
import { S3_BUCKET } from '../config'
import { QueueService } from '.'
import { THREADS } from '../models'

const emitter = new EventEmitter()
const jobs = new Map()
const metrics = {
  jobsCreated: 0,
  jobsCompleted: 0,
  jobsFailed: 0,
  jobsCancelled: 0,
}

const createJobRecord = (payload) => ({
  id: uuidv4(),
  status: 'pending',
  s3Url: payload.s3Url,
  createdAt: Date.now(),
  progress: 0,
  transcription: null,
  highlights: null,
})

export const ProcessingService = {
  createJob: (payload) => {
    const job = createJobRecord(payload)
    jobs.set(job.id, job)
    emitter.emit('update', job)
  metrics.jobsCreated += 1

    // Persist initial job in DynamoDB THREADS table
    try {
      const thread = {
        userId: payload.userId || 'system',
        req: {
          filedetails: payload.filedetails || { name: payload.s3Url || '', filetype: 'video', size: 0, s3url: payload.s3Url },
          params: payload.params || {},
          service: 'transcription'
        },
        res: {},
        execution: [{ action: 'created', params: {} }],
        ttl: Math.floor(Date.now()/1000) + (60*60*24) // 24h
      }
      QueueService.create(thread)
        .then(saved => {
          job.threadId = saved.threadId || saved.id || null
        })
        .catch(e => Logger.error('Failed to persist job', e.message))
    } catch (e) {
      Logger.error('QueueService persist failed', e.message)
    }

    return job
  },

  cancel: async (jobId) => {
    const job = jobs.get(jobId)
    if (!job) throw new Error('Job not found')
    // mark as cancelled; if there are running async ops, set a flag
    job.cancelRequested = true
    job.status = 'cancelled'
    job.progress = job.progress || 0
    emitter.emit('update', job)
    metrics.jobsCancelled += 1
    // persist cancellation to DB if thread exists
    try { if (job.threadId) await THREADS.update({ threadId: job.threadId }, { res: { cancelled: true }, execution: [...(job.execution||[]), { action: 'cancelled' } ] }) } catch (e) { Logger.error('Failed to persist cancellation', e.message) }
    return job
  },

  getJob: (jobId) => jobs.get(jobId),

  on: (jobId, listener) => emitter.on('update', listener),
  off: (jobId, listener) => emitter.removeListener('update', listener),

  start: async (jobId) => {
    const job = jobs.get(jobId)
    if (!job) throw new Error('Job not found')
    job.status = 'processing'
    job.progress = 5
    emitter.emit('update', job)

  try {
      // Simulate progressive updates
      const progressInterval = setInterval(() => {
        if (job.progress < 80) {
          job.progress += Math.floor(Math.random() * 10) + 5
          if (job.progress > 80) job.progress = 80
          emitter.emit('update', job)
          // persist progress to DB if threadId exists (non-blocking)
          if (job.threadId) {
            THREADS.update({ threadId: job.threadId }, { res: { progress: job.progress }, execution: [...(job.execution||[]), { action: 'progress', params: { progress: job.progress } }] }).catch(e => Logger.error('Failed to persist progress', e.message))
          }
        }
      }, 2000)

      const transcription = await TranscriptionService.transcribe(job.s3Url, (p) => {
        if (job.cancelRequested) throw new Error('Job cancelled')
        job.progress = Math.max(job.progress, p)
        emitter.emit('update', job)
        // persist incremental progress
        if (job.threadId) THREADS.update({ threadId: job.threadId }, { res: { progress: job.progress }, execution: [...(job.execution||[]), { action: 'progress', params: { progress: job.progress } }] }).catch(e => Logger.error('Failed to persist progress', e.message))
      })

      clearInterval(progressInterval)

  job.transcription = transcription

      // Generate highlights (simple heuristic: sentences with most words)
      const highlights = TranscriptionService.extractHighlights(transcription)
      job.highlights = highlights

      // Persist artifacts to S3 (transcript.json, highlights.json)
  try {
        const bucket = process.env.S3_BUCKET || S3_BUCKET || 'default-bucket'
        const transcriptKey = `artifacts/${job.id}/transcript.json`
        const highlightsKey = `artifacts/${job.id}/highlights.json`

        const transcriptBuffer = Buffer.from(JSON.stringify(transcription, null, 2))
        const highlightsBuffer = Buffer.from(JSON.stringify(highlights, null, 2))

        const tRes = await S3Service.uploadFile(bucket, transcriptKey, transcriptBuffer, 'application/json')
        const hRes = await S3Service.uploadFile(bucket, highlightsKey, highlightsBuffer, 'application/json')

        job.transcriptUrl = tRes.Location
        job.highlightsUrl = hRes.Location
      } catch (s3err) {
        Logger.error('Failed to upload artifacts to S3', s3err)
        // continue — artifacts are optional for now
        job.s3Error = s3err.message
      }

  job.progress = 100
  job.status = 'done'
  emitter.emit('update', job)
  metrics.jobsCompleted += 1

      // Persist final job state to DynamoDB
      try {
        if (job.threadId) {
          await QueueService.updateOne({ threadId: job.threadId }, { res: { transcription: job.transcription, highlights: job.highlights, transcriptUrl: job.transcriptUrl, highlightsUrl: job.highlightsUrl }, execution: [...(job.execution||[]), { action: 'completed' } ] })
        }
      } catch (e) {
        Logger.error('Failed to update job in DB', e.message)
      }

      return job
    } catch (err) {
  Logger.error('Processing failed', err)
  job.status = 'failed'
  job.error = err.message
  emitter.emit('update', job)
  metrics.jobsFailed += 1
      return job
    }
  }
}

export const Metrics = () => metrics
