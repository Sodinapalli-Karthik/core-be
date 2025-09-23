// s3.js - Connection only
import AWS from 'aws-sdk';
const { Logger } = require('../utils');

import {
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
} from "../config";

let s3Instance = null;

export const connectS3 = async () => {
  try {
    // Configure AWS S3
    const s3Config = {
      region: AWS_REGION,
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
      signatureVersion: 'v4', // Required for some S3 operations
    };

    // Create S3 instance
    s3Instance = new AWS.S3(s3Config);

    // Test the connection by listing buckets (optional)
    try {
      await s3Instance.listBuckets().promise();
      Logger.success(`Connected to AWS S3 successfully in region: ${AWS_REGION}`);
    } catch (testError) {
      Logger.warn('S3 connection configured but unable to test (may be due to permissions)');
    }

    return s3Instance;
  } catch (error) {
    Logger.error("S3 connection error:", error);
    throw error;
  }
};

// Get the S3 instance
export const getS3 = () => {
  if (!s3Instance) {
    throw new Error('S3 not initialized. Call connectS3() first.');
  }
  return s3Instance;
};
