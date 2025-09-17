import axios from "axios";
import { sasToken } from "../sasToken"; 

const containerName = "docqmentor2";
const storageAccountUrl = "https://docqmentor2blob.blob.core.windows.net";

const splitCamelCase = (text) => text.replace(/([a-z])([A-Z])/g, "$1 $2");

const extractFolderName = (filename) => {
  const baseName = filename.substring(0, filename.lastIndexOf(".")) || filename;
  let parts = baseName.split(/[\s\-_]+/);
  const filteredParts = parts.filter(
    (part) =>
      !/^\d+$/.test(part) &&
      !/^copy$/i.test(part) &&
      !/^-/.test(part)
  );
  let cleaned = filteredParts.join(" ");
  cleaned = splitCamelCase(cleaned);
  return cleaned.trim().toUpperCase();
};

export const uploadToAzure = async (file) => {
  const originalFileName = file.name;

  // ✅ Get domain from localStorage or default to 'Invoice'
  const domain = localStorage.getItem("selectedDomain") || "Invoice";

  const folderName = extractFolderName(originalFileName);
  const timestamp = Date.now();
  const uniqueFileName = `${timestamp}-${originalFileName}`;

  // ✅ Construct blob path: domain folder → unique file
  const blobPath = `${encodeURIComponent(domain)}/${encodeURIComponent(folderName)}/${encodeURIComponent(uniqueFileName)}`;
  const blobUrl = `${storageAccountUrl}/${containerName}/${blobPath}${sasToken}`;

  try {
    const response = await axios.put(blobUrl, file, {
      headers: {
        "x-ms-blob-type": "BlockBlob",
        "Content-Type": file.type,
      },
    });

    if (response.status === 201 || response.status === 200) {
      return {
        fileName: originalFileName,
        uniqueBlobName: uniqueFileName,
        folderName: `${domain}/${folderName}`,
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
