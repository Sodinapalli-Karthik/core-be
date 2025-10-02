import { connectS3 } from '../app/s3'
import { ProcessingService } from '../services'
import { TranscriptionService } from '../services/transcriptionService'

// Quick simulation: mock transcribe to return a small transcription and progress
TranscriptionService.transcribe = async (s3Url, progressCb = () => {}) => {
  console.log('Mock transcribe called for', s3Url)
  progressCb(10)
  await new Promise(r => setTimeout(r, 200))
  progressCb(50)
  await new Promise(r => setTimeout(r, 200))
  progressCb(90)
  await new Promise(r => setTimeout(r, 200))
  progressCb(100)
  return {
    duration: 10,
    segments: [
      { speaker: 'Speaker 1', start: 0, end: 5, text: 'Hello world' },
      { speaker: 'Speaker 2', start: 5, end: 10, text: 'This is a test' }
    ]
  }
}

const run = async () => {
  await connectS3()
  const s3Url = 'file://' + process.cwd() + '/utils/uploads/test/local_only_1758749888480_4540151-hd_1920_1080_30fps.mp4'
  const job = ProcessingService.createJob({ s3Url, userId: 'simulator', filedetails: { name: 'local.mp4', s3url: s3Url } })
  console.log('Created job', job.id)

  // listen locally to updates
  ProcessingService.on(job.id, (update) => {
    console.log('JOB UPDATE:', update.id, update.status, update.progress)
  })

  const res = await ProcessingService.start(job.id)
  console.log('Processing finished with status', res.status)
  process.exit(0)
}

run().catch(e => { console.error(e); process.exit(1) })
