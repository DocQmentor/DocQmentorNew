import axios from "axios";
export const sasToken =
  "?sv=2024-11-04&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=2026-05-31T18:29:59Z&st=2025-05-21T09:45:27Z&spr=https&sig=UO0XVGFTlz3IpM6Q5LIkrTkCDQcr3Rx%2FeXn3FEvsQJM%3D";

const containerName = "docqmentor2";
const storageAccountUrl = "https://docqmentor2blob.blob.core.windows.net";
// const sasToken =
//   "?sv=2024-11-04&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=2026-05-31T18:29:59Z&st=2025-05-21T09:45:27Z&spr=https&sig=UO0XVGFTlz3IpM6Q5LIkrTkCDQcr3Rx%2FeXn3FEvsQJM%3D";

const splitCamelCase = (text) => text.replace(/([a-z])([A-Z])/g, "$1 $2");

const extractFolderName = (filename) => {
  // Remove file extension
  const baseName = filename.substring(0, filename.lastIndexOf(".")) || filename;

  // Common patterns to remove:
  // 1. Numbers and special characters after the main name
  // 2. "- copy", "copy", "-1234" etc.
  // 3. Split camelCase if present

  // First, split on common separators (space, hyphen, underscore)
  let parts = baseName.split(/[\s\-_]+/);

  // Filter out unwanted parts (numbers, "copy", etc.)
  const filteredParts = parts.filter(
    (part) =>
      !/^\d+$/.test(part) && // pure numbers
      !/^copy$/i.test(part) && // "copy" in any case
      !/^-/.test(part) // parts starting with hyphen
  );

  // Rejoin the remaining parts
  let cleaned = filteredParts.join(" ");

  // Handle camelCase if present
  cleaned = splitCamelCase(cleaned);

  // Final cleaning and formatting - return in uppercase
  return cleaned.trim().toUpperCase();
};

export const uploadToAzure = async (file, onProgress) => {
  const fileName = file.name;
  const folderName = extractFolderName(fileName);
  const blobPath = `${encodeURIComponent(folderName)}/${encodeURIComponent(
    fileName
  )}`;
  const blobUrl = `${storageAccountUrl}/${containerName}/${blobPath}${sasToken}`;

  try {
    // Upload file to Azure Blob Storage
    const response = await axios.put(blobUrl, file, {
      headers: {
        "x-ms-blob-type": "BlockBlob",
        "Content-Type": file.type,
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percent);
        }
      },
    });

    if (response.status === 201 || response.status === 200) {
      // Now call Azure Function with full blobUrl and documentName
      await axios.post(
        "https://docqmentorfuncapp.azurewebsites.net/api/DocQmentorFunc?code=8QYoFUxEDeqtrIGoDppeFQQPHT2hVYL1fWbRGvk4egJKAzFudPd6AQ==",
        {
          blobUrl,
          documentName: fileName,
        }
      );

      return {
        fileName,
        folderName,
        uploadedAt: new Date(),
        status: "In Process",
        url: blobUrl,
      };
    } else {
      console.error("Upload failed:", response);
      return null;
    }
  } catch (error) {
    console.error("Azure upload error:", error);
    return null;
  }
};
