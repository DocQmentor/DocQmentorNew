import axios from "axios";

const containerName = "docqmentor2";
const storageAccountUrl = "https://docqmentor2blob.blob.core.windows.net";
const sasToken =
  "?sv=2024-11-04&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=2026-05-31T18:29:59Z&st=2025-05-21T09:45:27Z&spr=https&sig=UO0XVGFTlz3IpM6Q5LIkrTkCDQcr3Rx%2FeXn3FEvsQJM%3D";

const splitCamelCase = (text) =>
  text.replace(/([a-z])([A-Z])/g, "$1 $2");

const extractFolderName = (filename) => {
  const baseName = filename.substring(0, filename.lastIndexOf(".")) || filename;
  let cleaned = baseName.replace(/[\d_-]+/g, " ");
  cleaned = splitCamelCase(cleaned);
  return cleaned
    .trim()
    .split(/\s+/)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(" ");
};

export const uploadToAzure = async (file, onProgress) => {
  const fileName = file.name;
  const folderName = extractFolderName(fileName);
  const blobPath = `${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}`;
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
        "https://docap.azurewebsites.net/api/DocQmentorFunc?code=n4SOThz-nkfGfs96hGTtAsvm3ZS2wt7O3pqELLzWqi38AzFuUm090A==",
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
