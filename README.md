# File Upload Application

This is a simple file upload application built with Express and Multer.

# Docker

`docker run -p 3000:3000 -v /path/to/local/uploads:/app/uploads --restart unless-stopped wxnnvs/upload`

To edit the password follow these steps:
1. `docker cp <containername or -id>:/app/app.js .`
2. Edit local `app.js` as you want
3. `docker cp app.js <containername or -id>:/app/app.js`

# Manual
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

## License

This project is licensed under the DO WHATEVER THE FUCK U WANT LICENSE

(leaving a mention would be nice tho)