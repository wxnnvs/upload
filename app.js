/* IMPORTS */

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const session = require("express-session");
const bodyParser = require("body-parser"); // For parsing POST data
const multer = require("multer"); // For handling multipart/form-data

/* VARIABLES AND STUFF */
/* !! CHANGE THE SESSION SECRET ON LINE 62 !! */

const app = express();

const PORT = process.env.PORT || 3000; // Port to listen on
const UPLOAD_DIR = path.join(__dirname, "uploads"); // Directory where uploads get saved
const PASSWORD = "mysecretpassword"; // Change this to your desired password
let isAuthenticationEnabled = true; // Set to false to disable authentication
const CLEAR_FILES_ENABLED = false; // Set to true to enable automatic file deletion
const CLEAR_FILES_INTERVAL_HOURS = 1; // Set the interval in hours

/* ACTUAL CODE */

app.use(express.static(path.join(__dirname, "public")));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = UPLOAD_DIR;
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir); // Ensure the upload directory exists
    }
    cb(null, uploadDir); // Save files directly to ./uploads
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage }).single("file");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

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

// Session setup (required for storing authentication state)
app.use(
  session({
    secret: "mysecretkey", // change this secret key to a more secure value
    resave: false,
    saveUninitialized: true,
  })
);

// Body parser middleware to handle form data
app.use(bodyParser.urlencoded({ extended: true })); // Make sure this is before your routes

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
// res.sendFile(path.join(__dirname, 'pages', 'login.html'));

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "login.html"));
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
  res.sendFile(path.join(__dirname, "pages", "wrong-pass.html"));
});

// Handle logout
app.post("/logout", (req, res) => {
  req.session.isAuthenticated = false;
  res.redirect("/login");
});

// Serve the upload page only if authenticated
app.get("/", checkAuthentication, (req, res) => {
  if (isAuthenticationEnabled) {
    res.sendFile(path.join(__dirname, "pages", "index1.html"));
  } else {
    res.sendFile(path.join(__dirname, "pages", "index2.html"));
  }
});

// Browse files
app.get("/browse", checkAuthentication, (req, res) => {
  fs.readdir(UPLOAD_DIR, (err, files) => {
    if (err) {
      return res.status(500).send("Error reading upload directory");
    }

    const fileList = files
      .filter((file) => file.endsWith(".meta"))
      .map((file) => {
        try {
          const filePath = path.join(UPLOAD_DIR, file);
          // read file contents, this refers to another file
          const ogFile = fs.readFileSync(filePath, "utf-8").trim();
          const ogFilePath = path.join(UPLOAD_DIR, ogFile);
          const stats = fs.statSync(ogFilePath);
          const shortName =
            ogFile.length > 60
              ? ogFile.slice(0, 30) + "..." + ogFile.slice(-27)
              : ogFile;
          return {
            fullName: ogFile,
            shortName: shortName,
            size: stats.size,
            link: file.replace(".meta", ""),
          };
        } catch (error) {
          console.error(`Error processing file ${file}:`, error);
          return null;
        }
      })
      .filter((file) => file !== null);

    res.send(`
      <link rel="stylesheet" type="text/css" href="/style.css">
      <h1>File List</h1>
      <ul>
        ${fileList
          .map(
            (file) =>
              `<li title="${file.fullName}"><a class="file-link" href="/file/${
                file.link
              }">${file.shortName}</a> (${(file.size / (1024 * 1024)).toFixed(
                2
              )} MB)</li>`
          )
          .join("")}
      </ul>
      <button class="nav" onclick="window.location.href='/'">Upload More Files</button>
      ${
        isAuthenticationEnabled
          ? `
        <form action="/logout" method="POST">
          <button type="submit" class="logout">Logout</button>
        </form>
        `
          : ""
      }
    `);
  });
});

app.post("/upload", checkAuthentication, upload, async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded");
  }

  const md5 = req.body.md5; // Get the MD5 hash from the request body

  try {
    const filePath = path.join(UPLOAD_DIR, req.file.originalname);
    const fileHash = await generateFileHash(filePath);

    // Check if the hash file already exists
    const hashFilePath = path.join(UPLOAD_DIR, `${fileHash}.meta`);
    if (fs.existsSync(hashFilePath)) {
      return res.send(
        `<p class="success">File uploaded succesfully:<br> <a href="/file/${fileHash}">${req.file.originalname}</a></p>`
      );
    } else {
      // Save the hash for file access later
      fs.writeFileSync(hashFilePath, req.file.originalname);

      res.send(
        `<p class="success">File uploaded successfully:<br> <a href="/file/${fileHash}">${req.file.originalname}</a></p>`
      );
    }
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

  const originalname = fs.readFileSync(hashFilePath, "utf-8");
  const filePath = path.join(UPLOAD_DIR, originalname);

  // Send the file as an attachment
  res.download(filePath, originalname, (err) => {
    if (err) {
      console.error("Error sending file:", err);
      res.status(500).send("Error downloading file");
    }
  });
});

if (CLEAR_FILES_ENABLED) {
  setInterval(() => {
    const expiration = CLEAR_FILES_INTERVAL_HOURS * 60 * 60 * 1000; // Convert hours to milliseconds
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
  }, CLEAR_FILES_INTERVAL_HOURS * 60 * 60 * 1000); // Convert hours to milliseconds
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
