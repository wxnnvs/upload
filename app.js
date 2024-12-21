const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const session = require("express-session");
const bodyParser = require("body-parser"); // For parsing POST data

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

// Password for the page
const PASSWORD = "mysecretpassword"; // Change this to your desired password

// Session setup (required for storing authentication state)
app.use(session({
  secret: 'mysecretkey',  // change this secret key to a more secure value
  resave: false,
  saveUninitialized: true
}));

// Body parser middleware to handle form data
app.use(bodyParser.urlencoded({ extended: true })); // Make sure this is before your routes

// Track whether authentication is enabled
let isAuthenticationEnabled = true; // Default state is enabled

// Middleware to check if the user is authenticated
const checkAuthentication = (req, res, next) => {
  if (isAuthenticationEnabled && req.session && req.session.isAuthenticated) {
    return next(); // User is authenticated, proceed to next middleware
  } else if (isAuthenticationEnabled) {
    return res.redirect("/login"); // Redirect to login page if authentication is enabled and user is not authenticated
  }
  return next(); // If authentication is disabled, proceed without checking for login
};

// Serve login page
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

// Handle login form submission
app.post("/login", (req, res) => {
  const { password } = req.body; // req.body.password is now properly populated
  if (password === PASSWORD) {
    // Password is correct, create a session and redirect to the upload page
    req.session.isAuthenticated = true;
    return res.redirect("/");
  }
  // Password is incorrect, show an error message
  res.send(`
    <h1>Login Failed</h1>
    <p>Incorrect password. <a href="/login">Try again</a></p>
  `);
});

// Handle logout
app.post("/logout", (req, res) => {
  req.session.isAuthenticated = false;
  res.redirect("/login");
});

// Serve the upload page only if authenticated
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
app.post("/upload", checkAuthentication, upload.single("file"), async (req, res) => {
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
