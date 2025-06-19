const express = require("express");
const fs = require("fs");
const path = require("path");
const busboy = require("busboy");
const session = require("express-session");

const app = express();
const uploadDir = path.join(__dirname, "upload");
const PASSWORD = "mysecretpassword"; // Change this to your desired password
let isAuthenticationEnabled = true; // Set to false to disable authentication

// Add middleware to parse urlencoded form data
app.use(express.urlencoded({ extended: true }));

// Session setup (required for storing authentication state)
app.use(
  session({
    secret: "skibidikey", // change this secret key to a more secure value
    resave: false,
    saveUninitialized: true,
  })
);

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const checkAuthentication = (req, res, next) => {
  if (isAuthenticationEnabled && req.session && req.session.isAuthenticated) {
    return next(); // User is authenticated, proceed to next middleware
  } else if (isAuthenticationEnabled) {
    return res.redirect("/login"); // Redirect to login page if authentication is enabled and user is not authenticated
  }
  return next(); // If authentication is disabled, proceed to next middleware
};
app.get("/login", (_, res) => {
  res.send(`<html>
    <head>
      <title>Login</title>
    </head>
    <body>
      <h1>Login</h1>
      <form action="/login" method="post">
        <input type="password" name="password" placeholder="Password" />
        <button type="submit">Login</button>
      </form>
    </body>
  </html>`);
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
  res.redirect("/login");
});

// super minimal file upload homepage
app.get("/", checkAuthentication, (_, res) => {
  res.send(`
        <h1>Upload File</h1>
        <form action="/upload" method="post" enctype="multipart/form-data">
            <input type="file" name="file" />
            <button type="submit">Upload</button>
        </form>
    `);
});

app.post("/upload", (req, res) => {
  console.log("Incoming upload request...");

  const bb = busboy({ headers: req.headers });
  let uploadComplete = false;
  bb.on("file", (_, file, info) => {
    filename = info.filename;
    filePath = path.join(uploadDir, path.basename(filename));

    console.log(`Receiving file: ${filename}`);
    filePath = path.join(uploadDir, path.basename(filename));

    console.log(`Receiving file: ${filename}`);

    const writeStream = fs.createWriteStream(filePath);

    file.on("data", (data) => {
      console.log(`Received ${data.length} bytes for ${filename}`);
    });

    file.on("end", () => {
      console.log(`Finished receiving file: ${filename}`);
    });

    file.on("error", (err) => {
      console.error(`File stream error: ${err}`);
      return res.status(500).send("File stream error");
    });

    writeStream.on("close", () => {
      console.log(`Saved file to: ${filePath}`);
      uploadComplete = true;
    });

    writeStream.on("error", (err) => {
      console.error(`Write stream error: ${err}`);
      return res.status(500).send("Write stream error");
    });

    file.pipe(writeStream);
  });

  bb.on("close", () => {
    if (uploadComplete) {
      console.log("Upload complete.");
      res
        .status(200)
        .send(
          req.protocol +
            "://" +
            req.get("host") +
            "/file/" +
            encodeURIComponent(filename)
        );
    } else {
      console.warn("Upload failed or file event never fired");
      res
        .status(500)
        .send(
          req.protocol +
            "://" +
            req.get("host") +
            "/file/" +
            encodeURIComponent(filename)
        );
    }
  });

  bb.on("error", (err) => {
    console.error(`Busboy error: ${err}`);
    res.status(500).send("Busboy error");
  });

  req.pipe(bb);
});

app.get("/file/:filename", (req, res) => {
  const fileName = req.params.filename;
  const fullPath = path.join(uploadDir, path.basename(fileName));

  if (fs.existsSync(fullPath)) {
    console.log(`Serving file: ${fileName}`);
    res.sendFile(fullPath);
  } else {
    console.warn(`File not found: ${fileName}`);
    res.status(404).send("File not found");
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
