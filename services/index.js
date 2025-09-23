import { WrapperService } from "./dynamoService";
import { S3Service } from "./s3Service";

import { THREADS } from "../models";

export { S3Service };

export const QueueService = WrapperService(THREADS);
