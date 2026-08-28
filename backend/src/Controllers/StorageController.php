<?php
declare(strict_types=1);

namespace CliniCore\Controllers;

use CliniCore\Config\Env;
use CliniCore\Utils\Response;
use CliniCore\Middleware\AuthMiddleware;

class StorageController {
    public function upload(): void {
        $user = AuthMiddleware::authenticate();

        if (empty($_FILES['file'])) {
            Response::error('NO_FILE', 'No file uploaded.', 400);
        }

        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            Response::error('UPLOAD_ERROR', "File upload error code: {$file['error']}", 500);
        }

        // Validate MIME type
        $allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mime, $allowedMimes, true)) {
            Response::error('INVALID_FILE_TYPE', 'Only JPEG, PNG, WEBP, and PDF files are permitted.', 415);
        }

        $storagePath = (string) Env::get('STORAGE_PATH', __DIR__ . '/../../storage/uploads');
        if (!is_dir($storagePath)) {
            mkdir($storagePath, 0775, true);
        }

        $type = $_POST['type'] ?? 'prescriptions';
        $subDir = "{$storagePath}/{$type}";
        if (!is_dir($subDir)) {
            mkdir($subDir, 0775, true);
        }

        $extension = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg';
        $fileName = bin2hex(random_bytes(16)) . '.' . strtolower($extension);
        $destination = "{$subDir}/{$fileName}";

        if (!move_uploaded_file($file['tmp_name'], $destination)) {
            Response::error('SAVE_FAILED', 'Failed to write file to storage vault.', 500);
        }

        $fileUrl = "/api/v1/storage/file?type={$type}&name={$fileName}";

        Response::success([
            'file_url'   => $fileUrl,
            'file_name'  => $fileName,
            'size_kb'    => round($file['size'] / 1024)
        ], 201);
    }

    public function serve(): void {
        AuthMiddleware::authenticate();

        $allowedTypes = ['prescriptions', 'reports', 'xrays', 'documents', 'profiles'];
        $type = $_GET['type'] ?? 'prescriptions';
        if (!in_array($type, $allowedTypes, true)) {
            Response::badRequest('Invalid file storage category.');
            return;
        }

        $name = basename($_GET['name'] ?? '');

        if (!$name) {
            Response::notFound('File parameter missing.');
            return;
        }

        $storagePath = (string) Env::get('STORAGE_PATH', __DIR__ . '/../../storage/uploads');
        $filePath = "{$storagePath}/{$type}/{$name}";

        if (!file_exists($filePath)) {
            Response::notFound('Requested image not found in storage vault.');
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $filePath);
        finfo_close($finfo);

        header("Content-Type: {$mime}");
        header('Content-Length: ' . filesize($filePath));
        header('Cache-Control: private, max-age=86400');
        readfile($filePath);
        exit;
    }
}
