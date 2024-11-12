const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// Temporary storage folder for uploads
const UPLOAD_DIR = path.join(__dirname, "uploads");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

// Configure Multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Generate an MD5 hash for a file
const generateFileHash = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("md5");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
};

app.get("/", (req, res) => {
  res.send(`
        <h1>Upload a File</h1>
        <form id="uploadForm">
            <input type="file" id="fileInput" name="file" />
            <button type="button" onclick="uploadFile()">Upload</button>
        </form>
        <br>
        <div id="progressContainer" style="display: none;">
            <progress id="progressBar" value="0" max="100" style="width: 100%;"></progress>
            <span id="progressText">0%</span>
        </div>
        <div id="uploadStatus"></div>

        <script>
            function uploadFile() {
                const fileInput = document.getElementById('fileInput');
                const file = fileInput.files[0];
                if (!file) {
                    alert('Please select a file first.');
                    return;
                }

                const formData = new FormData();
                formData.append('file', file);

                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/upload', true);

                // Show progress bar
                document.getElementById('progressContainer').style.display = 'block';

                // Update progress bar
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = (event.loaded / event.total) * 100;
                        document.getElementById('progressBar').value = percentComplete;
                        document.getElementById('progressText').textContent = Math.round(percentComplete) + '%';
                    }
                };

                // Handle completion
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        document.getElementById('uploadStatus').innerHTML = xhr.responseText;
                    } else {
                        document.getElementById('uploadStatus').textContent = 'Upload failed.';
                    }

                    // Reset progress bar after upload
                    document.getElementById('progressContainer').style.display = 'none';
                    document.getElementById('progressBar').value = 0;
                    document.getElementById('progressText').textContent = '0%';
                };

                xhr.onerror = () => {
                    document.getElementById('uploadStatus').textContent = 'Upload failed.';
                };

                // Send the file
                xhr.send(formData);
            }
        </script>
    `);
});

// Handle file upload
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded");
  }

  try {
    const filePath = path.join(UPLOAD_DIR, req.file.filename);
    const fileHash = await generateFileHash(filePath);

    // Save the hash for file access later
    const hashFilePath = path.join(UPLOAD_DIR, `${fileHash}.meta`);
    fs.writeFileSync(hashFilePath, req.file.filename);

    res.send(
      `File uploaded successfully: <a href="/file/${fileHash}">${req.file.originalname}</a>`
    );
  } catch (error) {
    console.error("Error generating file hash:", error);
    res.status(500).send("Error processing file");
  }
});

// Serve files by hash for download
app.get("/file/:hash", (req, res) => {
  const hash = req.params.hash;
  const hashFilePath = path.join(UPLOAD_DIR, `${hash}.meta`);

  // Check if the hash exists
  if (!fs.existsSync(hashFilePath)) {
    return res.status(404).send("File not found");
  }

  const filename = fs.readFileSync(hashFilePath, "utf-8");
  const filePath = path.join(UPLOAD_DIR, filename);

  // Send the file as an attachment
  res.download(filePath, filename, (err) => {
    if (err) {
      console.error("Error sending file:", err);
      res.status(500).send("Error downloading file");
    }
  });
});

// Clear old files periodically (e.g., every hour)
setInterval(() => {
  const expiration = 60 * 60 * 1000; // 1 hour in milliseconds
  fs.readdir(UPLOAD_DIR, (err, files) => {
    if (err) return console.error("Error reading upload directory:", err);

    files.forEach((file) => {
      const filePath = path.join(UPLOAD_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return console.error("Error getting file stats:", err);

        if (Date.now() - stats.mtimeMs > expiration) {
          fs.unlink(filePath, (err) => {
            if (err) console.error("Error deleting file:", err);
            else console.log("Deleted old file:", file);
          });
        }
      });
    });
  });
}, 60 * 60 * 1000); // Run every hour

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
