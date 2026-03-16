# Minecraft Server Management System

This project provides a Flask-based API for managing Minecraft server packages, with support for uploading and extracting 7z/7zip compressed archives.

## API Endpoints

### POST /api/upload-package

Upload and extract a 7z or 7zip package.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Form field: `file` (the 7z/7zip file)

**Response (Success - 200):**
```json
{
  "message": "Package uploaded and extracted successfully",
  "original_filename": "example.7z",
  "server_directory": "servers/example",
  "files_extracted": 15
}
```

**Response (Error - 400/409/500):**
```json
{
  "error": "Error description"
}
```

**Error Codes:**
- `400`: Bad Request (missing file, invalid file type)
- `409`: Conflict (server directory already exists)
- `500`: Internal Server Error (extraction failed)

**Features:**
- Accepts 7z and 7zip file formats
- No file size limit
- Creates a directory named after the uploaded file (without extension)
- Only extracted contents are stored (original archive is deleted after extraction)
- Automatically flattens unnecessary nested directories (if archive has a root folder with the same name)
- Prevents duplicate server uploads (rejects if server directory already exists and has content)
- Secure filename handling

**Directory Structure:**
```
servers/
└── example/                    # Directory named after uploaded file
    ├── file1.txt               # Extracted content (flattened if needed)
    ├── file2.jar
    └── ...
```

**Note:** If the uploaded archive contains a root folder with the same name as the archive (e.g., `example.7z` contains `example/` folder), the system will automatically flatten the structure by moving contents up one level, avoiding redundant nested directories.

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
cd app
python app.py
```

The server will start on `http://localhost:5000`

## Testing

You can test the API using curl:

```bash
curl -X POST -F "file=@example.7z" http://localhost:5000/api/upload-package
```

Or using a tool like Postman:
- Method: POST
- URL: `http://localhost:5000/api/upload-package`
- Body: form-data with key `file` and value as the 7z file