// import axios from "axios";
// // import { sasToken } from "../sasToken"; 

// export const sasToken =
//  "?sv=2024-11-04&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=2026-05-31T18:29:59Z&st=2025-05-21T09:45:27Z&spr=https&sig=UO0XVGFTlz3IpM6Q5LIkrTkCDQcr3Rx%2FeXn3FEvsQJM%3D";

// const containerName = "docqmentor2";
// const storageAccountUrl = "https://docqmentor2blob.blob.core.windows.net";
// // const sasToken =
// //  "?sv=2024-11-04&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=2026-05-31T18:29:59Z&st=2025-05-21T09:45:27Z&spr=https&sig=UO0XVGFTlz3IpM6Q5LIkrTkCDQcr3Rx%2FeXn3FEvsQJM%3D";

// const splitCamelCase = (text) => text.replace(/([a-z])([A-Z])/g, "$1 $2");

// const extractFolderName = (filename) => {
//  // Remove file extension
//  const baseName = filename.substring(0, filename.lastIndexOf(".")) || filename;

//  // Common patterns to remove:
//  // 1. Numbers and special characters after the main name
//  // 2. "- copy", "copy", "-1234" etc.
//  // 3. Split camelCase if present

//  // First, split on common separators (space, hyphen, underscore)
//  let parts = baseName.split(/[\s\-_]+/);

//  // Filter out unwanted parts (numbers, "copy", etc.)
//  const filteredParts = parts.filter(
//   (part) =>
//    !/^\d+$/.test(part) && // pure numbers
//    !/^copy$/i.test(part) && // "copy" in any case
//    !/^-/.test(part) // parts starting with hyphen
//  );

//  // Rejoin the remaining parts
//  let cleaned = filteredParts.join(" ");

//  // Handle camelCase if present
//  cleaned = splitCamelCase(cleaned);

//  // Final cleaning and formatting - return in uppercase
//  return cleaned.trim().toUpperCase();
// };

// export const uploadToAzure = async (file, modelType, userId, userName, onProgress) => {
//  const originalFileName = file.name;
//  const folderName = extractFolderName(originalFileName);

//  // ✅ Generate a unique blob file name using timestamp
// const timestamp = Date.now();
// const uniqueFileName = `${timestamp}-${file.name}`;

// const blobPath = `${encodeURIComponent(modelType)}/${encodeURIComponent(folderName)}/${encodeURIComponent(uniqueFileName)}`;
// const blobUrl = `${storageAccountUrl}/${containerName}/${blobPath}${sasToken}`;

//  try {
//   // Upload to Azure Blob
//   const response = await axios.put(blobUrl, file, {
//    headers: {
//     "x-ms-blob-type": "BlockBlob",
//     "Content-Type": file.type,
//    },
//    onUploadProgress: (progressEvent) => {
//     if (onProgress && progressEvent.total) {
//      const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
//      onProgress(percent);
//     }
//    },
//   });

//   if (response.status === 201 || response.status === 200) {
//    // ✅ Send blobUrl and originalFileName to Azure Function
//    await axios.post(
//     " https://docqmentorfuncapp.azurewebsites.net/api/DocQmentorFunc?code=H4sgHod2tb26Mmhl_h4DfLQe428vjXDrlIo_Npk7sSr6AzFuPY_B6Q==",
//     {
//      blobUrl,
//      documentName: originalFileName, 
//      uploadedBy: {
//       id: userId,
//       name: userName,
//     },// ✅ send original name
//     }
//    );

//    return {
//     fileName: originalFileName, // shown in UI
//     uniqueBlobName: uniqueFileName, // stored internally
//     folderName,
//     uploadedAt: new Date(),
//     status: "In Process",
//     url: blobUrl,
//    };
//   } else {
//    console.error("Upload failed:", response);
//    return null;
//   }
//  } catch (error) {
//   console.error("Azure upload error:", error);
//   return null;
//  }
// };

// import { BlobServiceClient } from "@azure/storage-blob";
// import { v4 as uuidv4 } from "uuid";
// import axios from "axios";

// // Azure info
// const BLOB_SERVICE_URL_WITH_SAS = "https://docqmentor2blob.blob.core.windows.net/?sv=2024-11-04&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=2026-05-31T18:29:59Z&st=2025-05-21T09:45:27Z&spr=https&sig=UO0XVGFTlz3IpM6Q5LIkrTkCDQcr3Rx%2FeXn3FEvsQJM%3D";
// const CONTAINER_NAME = "docqmentor2";
// const AZURE_FUNCTION_URL = "https://docqmentorfuncapp.azurewebsites.net/api/DocQmentorFunc?code=H4sgHod2tb26Mmhl_h4DfLQe428vjXDrlIo_Npk7sSr6AzFuPY_B6Q==";

// // Folder name helper
// const splitCamelCase = (text) => text.replace(/([a-z])([A-Z])/g, "$1 $2");

// const extractFolderName = (filename) => {
//   const baseName = filename.substring(0, filename.lastIndexOf(".")) || filename;
//   let parts = baseName.split(/[\s\-_]+/);
//   const filteredParts = parts.filter(part => !/^\d+$/.test(part) && !/^copy$/i.test(part) && !/^-/.test(part));
//   let cleaned = filteredParts.join(" ");
//   cleaned = splitCamelCase(cleaned);
//   return cleaned.trim().toUpperCase();
// };

// // Upload function
// export const uploadToAzure = async (file, modelType, userId, userName, onProgress   ) => {
//   const blobServiceClient = new BlobServiceClient(BLOB_SERVICE_URL_WITH_SAS);
//   const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

//   // Folder
//   const folderName = extractFolderName(file.name);
//   const folderPrefix = `${modelType}/${folderName}/`;

//   // Check if folder exists (optional, can skip if just uploading)
//   let folderExists = false;
//   for await (const blob of containerClient.listBlobsFlat({ prefix: folderPrefix })) {
//     folderExists = true;
//     break;
//   }

//   // Unique blob name
//   const uniqueFileName = file.name; // keep original name
//   const filePath = `${modelType}/${folderName}/${uniqueFileName}`;
//   const blockBlobClient = containerClient.getBlockBlobClient(filePath);

//   try {
//     await blockBlobClient.uploadData(file, {
//       blobHTTPHeaders: { blobContentType: file.type },
//       onProgress: (ev) => {
//         if (onProgress && ev.loadedBytes && file.size) {
//           const percent = Math.round((ev.loadedBytes * 100) / file.size);
//           onProgress(percent);
//         }
//       },
//     });

//     const blobUrl = blockBlobClient.url;

//     // Generate unique uploadId for Cosmos
//     const uploadId = uuidv4();

//     // Send metadata to backend
//     // await axios.post(AZURE_FUNCTION_URL, {
//     //   uploadId,           // ✅ unique ID per upload
//     //   blobUrl,
//     //   documentName: file.name,
//     //   modelType,       
//     //   uploadedBy: { id: userId, name: userName },
//     // });

//     return {
//       fileName: file.name,
//       folderName,
//       uploadedAt: new Date(),
//       status: "In Process",
//       url: blobUrl,
//       uploadId,   
//        modelType,        // keep it for localStorage/UI
//     };
//   } catch (error) {
//     console.error("Azure upload error:", error);
//     throw error;
//   }
// };



// new **********************************************
import { ContainerClient } from "@azure/storage-blob";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { sasToken } from "../sasToken";

// Azure info
const CONTAINER_URL = "https://docqmentor2blob.blob.core.windows.net/docqmentor2";
const BLOB_SERVICE_URL_WITH_SAS = `${CONTAINER_URL}?${sasToken}`;
const CONTAINER_NAME = "docqmentor2";
const AZURE_FUNCTION_URL =
  "https://docqmentorfuncapp.azurewebsites.net/api/DocQmentorFunc?code=5ttVguFIlYsgNTLnI7I-hGlMyInPTM_Y-3ihASWqOxLzAzFuaOzdpQ==";

// Helpers
const splitCamelCase = (text) => text.replace(/([a-z])([A-Z])/g, "$1 $2");

const extractFolderName = (filename) => {
  const baseName = filename.substring(0, filename.lastIndexOf(".")) || filename;
  let parts = baseName.split(/[\s\-_]+/);
  const filteredParts = parts.filter(
    (part) => !/^\d+$/.test(part) && !/^copy$/i.test(part) && !/^-/.test(part)
  );
  let cleaned = filteredParts.join(" ");
  cleaned = splitCamelCase(cleaned);
  return cleaned.trim().toUpperCase();
};

// ✅ Enhanced upload with metadata
export const uploadToAzure = async (file, modelType, userId, userName, onProgress) => {
  const uploadId = uuidv4();
  const containerClient = new ContainerClient(BLOB_SERVICE_URL_WITH_SAS);

  const folderName = extractFolderName(file.name);
  // ✅ User requested REMOVING unique ID prefix.
  const uniqueFileName = file.name;

  // Upload to 'uploads' folder — 'rawupload' is reserved for BlobTrigger-only flow
  const filePath = `uploads/${uniqueFileName}`;
  const blockBlobClient = containerClient.getBlockBlobClient(filePath);

  try {
    // 3️⃣ Metadata for Blob (Critical for Backend Trigger)
    const blobMetadata = {
      modelType: modelType || "invoice",
      documentName: file.name,
      uploadedBy: userName || "Unknown",
      uploadedByEmail: userId || "unknown@domain.com"
    };

    // 1️⃣ Upload to Azure Blob with Metadata
    await blockBlobClient.uploadData(file, {
      blobHTTPHeaders: { blobContentType: file.type },
      metadata: blobMetadata,
      onProgress: (ev) => {
        if (onProgress && ev.loadedBytes && file.size) {
          const percent = Math.round((ev.loadedBytes * 100) / file.size);
          onProgress(percent);
        }
      },
    });

    // 2️⃣ Generate SAS-protected URL
    // const sasToken = BLOB_SERVICE_URL_WITH_SAS.split("?")[1];
    const blobUrlWithSAS = blockBlobClient.url; // Already includes SAS

    // 3️⃣ Metadata for Cosmos DB - NOT SAVING HERE ANYMORE
    // const metadata = {
    //   fileName: file.name,
    //   fileSizeKB: file.size,
    //   fileFormat: file.type || "application/pdf",
    //   UploadDate: new Date().toISOString(),
    //   pageCount: 0, // can be updated later
    // };

    // 4️⃣ Send to backend for immediate processing
    const backendResponse = await axios.post(
      AZURE_FUNCTION_URL,
      {
        blobUrl: blobUrlWithSAS,
        documentName: file.name,
        modelType,
        uploadedBy: { id: userId, name: userName },
        uploadedAt: new Date().toISOString(),
        extractedData: {},
        confidenceScores: {},
        versionHistory: []
      },
      {
        headers: { "Content-Type": "application/json" }
      }
    );

    const splitCount = backendResponse?.data?.results?.length ?? 0;

    // 5️⃣ Return UI info
    return {
      fileName: file.name,
      folderName,
      uploadedAt: new Date(),
      status: "Uploaded (Processing)",
      url: blobUrlWithSAS,
      uploadId,
      modelType,
      splitCount,
    };
  } catch (error) {
    console.error("=== UPLOAD ERROR ===");
    console.error("Message:", error.message);
    console.error("Status:", error.response?.status);
    console.error("Backend response:", JSON.stringify(error.response?.data, null, 2));
    throw error;
  }
};