const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const session = require("express-session");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, "uploads");
const PASSWORD = "mysecretpassword";
const SESSION_SECRET = 'mysecretkey';

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, file.originalname),
});

const upload = multer({ storage });

const generateFileHash = (filePath) => new Promise((resolve, reject) => {
  const hash = crypto.createHash("md5");
  const stream = fs.createReadStream(filePath);
  stream.on("data", (data) => hash.update(data));
  stream.on("end", () => resolve(hash.digest("hex")));
  stream.on("error", reject);
});

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

app.use(bodyParser.urlencoded({ extended: true }));

let isAuthenticationEnabled = true;

const checkAuthentication = (req, res, next) => {
  if (isAuthenticationEnabled && req.session && req.session.isAuthenticated) {
    return next();
  } else if (isAuthenticationEnabled) {
    return res.redirect("/login");
  }
  return next();
};

app.get("/login", (req, res) => {
  res.send(`
    <h1>Login</h1>
    <form action="/login" method="POST">
      <label for="password">Password: </label>
      <input type="password" id="password" name="password" required />
      <button type="submit">Submit</button>
    </form>
  `);
});

app.post("/login", (req, res) => {
  const { password } = req.body;
  if (password === PASSWORD) {
    req.session.isAuthenticated = true;
    return res.redirect("/");
  }
  res.send(`
    <h1>Login Failed</h1>
    <p>Incorrect password. <a href="/login">Try again</a></p>
  `);
});

app.post("/logout", (req, res) => {
  req.session.isAuthenticated = false;
  res.redirect("/login");
});

app.get("/", checkAuthentication, (req, res) => {
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
        <span id="uploadSpeed"></span>
        <span id="eta"></span>
    </div>
    <div id="uploadStatus"></div>

    ${isAuthenticationEnabled ? `
    <form action="/logout" method="POST">
      <button type="submit">Logout</button>
    </form>
    ` : ''}

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

            document.getElementById('progressContainer').style.display = 'block';
            let startTime = Date.now();

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    document.getElementById('progressBar').value = percentComplete;
                    document.getElementById('progressText').textContent = Math.round(percentComplete) + '%';

                    const elapsedTime = (Date.now() - startTime) / 1000;
                    const uploadSpeed = (event.loaded / elapsedTime / 1024).toFixed(2);
                    document.getElementById('uploadSpeed').textContent = uploadSpeed + ' KB/s';

                    const remainingTime = ((event.total - event.loaded) / (event.loaded / elapsedTime)).toFixed(2);
                    document.getElementById('eta').textContent = remainingTime + 's';
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    document.getElementById('uploadStatus').innerHTML = xhr.responseText;
                } else {
                    document.getElementById('uploadStatus').textContent = 'Upload failed.';
                }

                document.getElementById('progressContainer').style.display = 'none';
                document.getElementById('progressBar').value = 0;
                document.getElementById('progressText').textContent = '0%';
                document.getElementById('uploadSpeed').textContent = '';
                document.getElementById('eta').textContent = '';
            };

            xhr.onerror = () => {
                document.getElementById('uploadStatus').textContent = 'Upload failed.';
            };

            xhr.send(formData);
        }
    </script>
  `);
});

app.post("/upload", checkAuthentication, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded");
  }

  try {
    const filePath = path.join(UPLOAD_DIR, req.file.originalname);
    const fileHash = await generateFileHash(filePath);
    const hashFilePath = path.join(UPLOAD_DIR, `${fileHash}.meta`);

    if (!fs.existsSync(hashFilePath)) {
      fs.writeFileSync(hashFilePath, req.file.originalname);
    }

    res.send(`File uploaded successfully: <a href="/file/${fileHash}">${req.file.originalname}</a>`);
  } catch (error) {
    console.error("Error generating file hash:", error);
    res.status(500).send("Error processing file");
  }
});

app.get("/file/:hash", (req, res) => {
  const hash = req.params.hash;
  const hashFilePath = path.join(UPLOAD_DIR, `${hash}.meta`);

  if (!fs.existsSync(hashFilePath)) {
    return res.status(404).send("File not found");
  }

  const originalname = fs.readFileSync(hashFilePath, "utf-8");
  const filePath = path.join(UPLOAD_DIR, originalname);

  res.download(filePath, originalname, (err) => {
    if (err) {
      console.error("Error sending file:", err);
      res.status(500).send("Error downloading file");
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});