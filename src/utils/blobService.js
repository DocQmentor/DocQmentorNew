import { BlobServiceClient } from "@azure/storage-blob";

const BLOB_SERVICE_URL_WITH_SAS =
  "https://docqmentor2blob.blob.core.windows.net/?sv=2024-11-04&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=2026-05-31T18:29:59Z&st=2025-05-21T09:45:27Z&spr=https&sig=UO0XVGFTlz3IpM6Q5LIkrTkCDQcr3Rx%2FeXn3FEvsQJM%3D";

const CONTAINER_NAME = "docqmentor2";

export const getVendorFolders = async () => {
  const blobServiceClient = new BlobServiceClient(BLOB_SERVICE_URL_WITH_SAS);
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

  const folderSet = new Set();

  for await (const blob of containerClient.listBlobsFlat()) {
    const folderName = blob.name.split("/")[0];
    folderSet.add(folderName);
  }

  return Array.from(folderSet);
};