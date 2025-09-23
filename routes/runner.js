import { Router } from 'express'

import { ping } from '../controllers'

// import { } from '../validations'

import { asyncWrapper, multerUpload } from '../utils'

export const RunnerRouter = Router()

RunnerRouter.get('/ping', asyncWrapper(ping))
