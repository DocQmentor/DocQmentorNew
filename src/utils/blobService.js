import { ContainerClient } from "@azure/storage-blob";
import { sasToken } from "../sasToken";

const CONTAINER_URL = "https://docqmentor2blob.blob.core.windows.net/docqmentor2";
const BLOB_SERVICE_URL_WITH_SAS = `${CONTAINER_URL}?${sasToken}`;
const CONTAINER_NAME = "docqmentor2";

export const getVendorFolders = async (domain) => {
  if (!domain) return [];

  try {
    const containerClient = new ContainerClient(BLOB_SERVICE_URL_WITH_SAS);
    const vendorFolders = new Set();

    for await (const item of containerClient.listBlobsByHierarchy("/", { prefix: `${domain}/` })) {
      if (item.kind === "prefix") {
        const vendorName = item.name.replace(`${domain}/`, "").replace("/", "");
        vendorFolders.add(vendorName);
      }
    }
    return Array.from(vendorFolders);
  } catch (error) {
    console.error("Error fetching vendor folders (Check SAS permissions):", error);
    return [];
  }
};

// Helper: matches azureUploader logic
const extractFolderName = (filename) => {
  const splitCamelCase = (text) => text.replace(/([a-z])([A-Z])/g, "$1 $2");
  const baseName = filename.substring(0, filename.lastIndexOf(".")) || filename;
  // Common patterns to remove:
  let parts = baseName.split(/[\s\-_]+/);
  // Filter out unwanted parts (numbers, "copy", etc.)
  const filteredParts = parts.filter(
    (part) =>
      !/^\d+$/.test(part) && // pure numbers
      !/^copy$/i.test(part) && // "copy" in any case
      !/^-/.test(part) // parts starting with hyphen
  );
  let cleaned = filteredParts.join(" ");
  cleaned = splitCamelCase(cleaned);
  return cleaned.trim().toUpperCase();
};

export const checkFileExists = async (modelType, fileName) => {
  try {
    const containerClient = new ContainerClient(BLOB_SERVICE_URL_WITH_SAS);

    const folderName = extractFolderName(fileName);
    const prefix = `${modelType}/${folderName}/`;

    // List files in that specific folder
    // The upload logic is: modelType/folderName/uuid-filename
    // So we scan specifically for the filename at the END of the blob path
    for await (const blob of containerClient.listBlobsFlat({ prefix: prefix })) {
      if (blob.name.endsWith(`-${fileName}`) || blob.name.endsWith(`/${fileName}`)) {
        return true;
      }
    }
    return false;
  } catch (e) {
    console.error("Error checking blob existence:", e);
    return false; // Fail safe: allow upload if check fails
  }
};