// s3Service.js - All S3 operations
import { getS3 } from '../app/s3';
const { Logger } = require('../utils');

export const S3Service = {
  // Upload file to S3
  uploadFile: async (bucketName, key, fileBuffer, contentType = 'application/octet-stream') => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      };

      const result = await s3.upload(params).promise();
      Logger.info(`File uploaded successfully: ${result.Location}`);
      return result;
    } catch (error) {
      Logger.error('S3 upload error:', error);
      throw error;
    }
  },

  // Download file from S3
  downloadFile: async (bucketName, key) => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: bucketName,
        Key: key,
      };

      const result = await s3.getObject(params).promise();
      Logger.info(`File downloaded successfully: ${key}`);
      return result;
    } catch (error) {
      Logger.error('S3 download error:', error);
      throw error;
    }
  },

  // Generate presigned URL for file access
  getPresignedUrl: (bucketName, key, expiresIn = 3600) => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: bucketName,
        Key: key,
        Expires: expiresIn, // URL expires in seconds (default: 1 hour)
      };

      const url = s3.getSignedUrl('getObject', params);
      Logger.info(`Presigned URL generated for: ${key}`);
      return url;
    } catch (error) {
      Logger.error('S3 presigned URL error:', error);
      throw error;
    }
  },

  // Generate presigned URL for file upload
  getPresignedUploadUrl: (bucketName, key, expiresIn = 3600, contentType = 'application/octet-stream') => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: bucketName,
        Key: key,
        Expires: expiresIn,
        ContentType: contentType,
      };

      const url = s3.getSignedUrl('putObject', params);
      Logger.info(`Presigned upload URL generated for: ${key}`);
      return url;
    } catch (error) {
      Logger.error('S3 presigned upload URL error:', error);
      throw error;
    }
  },

  // Delete file from S3
  deleteFile: async (bucketName, key) => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: bucketName,
        Key: key,
      };

      const result = await s3.deleteObject(params).promise();
      Logger.info(`File deleted successfully: ${key}`);
      return result;
    } catch (error) {
      Logger.error('S3 delete error:', error);
      throw error;
    }
  },

  // Delete multiple files from S3
  deleteFiles: async (bucketName, keys) => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: bucketName,
        Delete: {
          Objects: keys.map(key => ({ Key: key })),
          Quiet: false
        }
      };

      const result = await s3.deleteObjects(params).promise();
      Logger.info(`${result.Deleted?.length || 0} files deleted successfully`);
      return result;
    } catch (error) {
      Logger.error('S3 bulk delete error:', error);
      throw error;
    }
  },

  // List files in S3 bucket
  listFiles: async (bucketName, prefix = '', maxKeys = 1000) => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
      };

      const result = await s3.listObjectsV2(params).promise();
      Logger.info(`Listed ${result.Contents?.length || 0} files from bucket: ${bucketName}`);
      return result;
    } catch (error) {
      Logger.error('S3 list files error:', error);
      throw error;
    }
  },

  // Check if file exists in S3
  fileExists: async (bucketName, key) => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: bucketName,
        Key: key,
      };

      await s3.headObject(params).promise();
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      Logger.error('S3 file exists check error:', error);
      throw error;
    }
  },

  // Get file metadata
  getFileMetadata: async (bucketName, key) => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: bucketName,
        Key: key,
      };

      const result = await s3.headObject(params).promise();
      Logger.info(`File metadata retrieved for: ${key}`);
      return result;
    } catch (error) {
      Logger.error('S3 get metadata error:', error);
      throw error;
    }
  },

  // Copy file within S3
  copyFile: async (sourceBucket, sourceKey, destinationBucket, destinationKey) => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: destinationBucket,
        CopySource: `${sourceBucket}/${sourceKey}`,
        Key: destinationKey,
      };

      const result = await s3.copyObject(params).promise();
      Logger.info(`File copied from ${sourceBucket}/${sourceKey} to ${destinationBucket}/${destinationKey}`);
      return result;
    } catch (error) {
      Logger.error('S3 copy error:', error);
      throw error;
    }
  },

  // Move file within S3 (copy + delete)
  moveFile: async (sourceBucket, sourceKey, destinationBucket, destinationKey) => {
    try {
      // First copy the file
      await S3Service.copyFile(sourceBucket, sourceKey, destinationBucket, destinationKey);
      
      // Then delete the original
      await S3Service.deleteFile(sourceBucket, sourceKey);
      
      Logger.info(`File moved from ${sourceBucket}/${sourceKey} to ${destinationBucket}/${destinationKey}`);
      return { success: true };
    } catch (error) {
      Logger.error('S3 move error:', error);
      throw error;
    }
  },

  // Get file size
  getFileSize: async (bucketName, key) => {
    try {
      const metadata = await S3Service.getFileMetadata(bucketName, key);
      return metadata.ContentLength;
    } catch (error) {
      Logger.error('S3 get file size error:', error);
      throw error;
    }
  },

  // List all buckets
  listBuckets: async () => {
    try {
      const s3 = getS3();
      const result = await s3.listBuckets().promise();
      Logger.info(`Listed ${result.Buckets?.length || 0} buckets`);
      return result;
    } catch (error) {
      Logger.error('S3 list buckets error:', error);
      throw error;
    }
  }
};
