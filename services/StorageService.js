const { Storage } = require("@google-cloud/storage");

// No key file here: the client finds credentials through ADC
// (gcloud auth application-default login locally, workload identity when deployed)
const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID || undefined });

const uploadFile = async (localPath, destination) => {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) throw new Error("GCS_BUCKET_NAME is not set");

  // Streams the file from disk to GCS
  await storage.bucket(bucketName).upload(localPath, {
    destination,
    contentType: "text/csv",
    resumable: false,
  });

  return `gs://${bucketName}/${destination}`;
};

module.exports = { uploadFile };
