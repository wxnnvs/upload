# File Upload Application

This is a simple file upload application built with Express and Multer.

## Prerequisites

- Node.js (v12 or higher)
- npm (v6 or higher)

## Setup

1. **Clone the repository:**

    ```sh
    git clone <repository-url>
    cd <repository-directory>
    ```

2. **Install dependencies:**

    ```sh
    npm install
    ```

3. **Run the application:**

    ```sh
    node app.js
    ```

4. **Access the application:**

    Open your web browser and navigate to `http://localhost:3000`.

## Project Structure

- `app.js`: Main application file.
- `uploads/`: Directory where uploaded files are stored.
- `package.json`: Project metadata and dependencies.
- `.gitignore`: Specifies files and directories to be ignored by Git.

## Features

- File upload with progress bar.
- File storage with unique filenames.
- MD5 hash generation for uploaded files.
- Download files by hash.
- Periodic cleanup of old files.

## License

This project is licensed under the ISC License.