<?php
declare(strict_types=1);

/**
 * 🏥 CliniCore Enterprise REST API Gateway (PHP 8.3)
 * Front Controller & Routing Gateway
 */

// Enable PSR-4 Autoloader
spl_autoload_register(function ($class) {
    $prefix = 'CliniCore\\';
    $baseDir = __DIR__ . '/../src/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relativeClass = substr($class, $len);
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    if (file_exists($file)) {
        require_once $file;
    }
});

use CliniCore\Config\Env;
use CliniCore\Utils\Response;
use CliniCore\Controllers\AuthController;
use CliniCore\Controllers\PatientController;
use CliniCore\Controllers\VisitController;
use CliniCore\Controllers\InventoryController;
use CliniCore\Controllers\PosSalesController;
use CliniCore\Controllers\B2bSalesController;
use CliniCore\Controllers\PurchaseController;
use CliniCore\Controllers\FinanceController;
use CliniCore\Controllers\StorageController;
use CliniCore\Controllers\SystemController;
use CliniCore\Controllers\SyncController;
use CliniCore\Controllers\TelemetryController;

// Handle CORS Pre-Flight Requests & Cross-Origin Headers
$allowedOrigins = [
    'https://clinicore.me',
    'https://www.clinicore.me',
    'https://api.clinicore.me',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
];
$customCorsOrigin = Env::get('CORS_ALLOWED_ORIGINS');
if ($customCorsOrigin) {
    foreach (explode(',', (string)$customCorsOrigin) as $o) {
        $trimmed = trim($o);
        if ($trimmed) $allowedOrigins[] = $trimmed;
    }
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header("Access-Control-Allow-Credentials: true");
} else {
    header("Access-Control-Allow-Origin: https://clinicore.me");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH");
header("Access-Control-Allow-Headers: Authorization, Content-Type, Accept, Origin, X-Requested-With, X-Idempotency-Key");
header("Access-Control-Max-Age: 86400");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Parse URL Route & Method
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Health check endpoint
if ($uri === '/api/health' || $uri === '/api/v1/health') {
    Response::success([
        'status'    => 'healthy',
        'app'       => 'CliniCore Enterprise Engine',
        'version'   => '2.0.0',
        'runtime'   => 'PHP ' . PHP_VERSION,
        'timestamp' => date('c')
    ]);
}

// ----------------------------------------------------------------------------
// API ROUTING DISPATCHER
// ----------------------------------------------------------------------------

try {
    // 1. Auth Routes
    if ($uri === '/api/v1/auth/login' && $method === 'POST') {
        (new AuthController())->login();
    } elseif ($uri === '/api/v1/auth/me' && $method === 'GET') {
        (new AuthController())->me();
    }

    // 2. Patient Master Routes
    elseif ($uri === '/api/v1/patients' && $method === 'GET') {
        (new PatientController())->search();
    } elseif ($uri === '/api/v1/patients' && $method === 'POST') {
        (new PatientController())->create();
    }

    // 3. OPD Queue & Visit Consultations
    elseif ($uri === '/api/v1/visits/today' && $method === 'GET') {
        (new VisitController())->getTodayQueue();
    } elseif ($uri === '/api/v1/visits' && $method === 'POST') {
        (new VisitController())->register();
    } elseif (preg_match('#^/api/v1/visits/([a-zA-Z0-9_-]+)/complete$#', $uri, $matches) && $method === 'POST') {
        (new VisitController())->complete($matches[1]);
    }

    // 4. Inventory Catalog
    elseif ($uri === '/api/v1/inventory' && $method === 'GET') {
        (new InventoryController())->getAll();
    }

    // 5. POS Counter Sales Checkout
    elseif ($uri === '/api/v1/pos/checkout' && $method === 'POST') {
        (new PosSalesController())->checkout();
    }

    // 6. B2B Wholesale Routes
    elseif ($uri === '/api/v1/b2b/parties' && $method === 'GET') {
        (new B2bSalesController())->getParties();
    } elseif ($uri === '/api/v1/b2b/parties' && $method === 'POST') {
        (new B2bSalesController())->createParty();
    } elseif ($uri === '/api/v1/b2b/checkout' && $method === 'POST') {
        (new B2bSalesController())->checkout();
    }

    // 7. Supplier Purchases & GRN
    elseif ($uri === '/api/v1/purchases/suppliers' && $method === 'GET') {
        (new PurchaseController())->getSuppliers();
    } elseif ($uri === '/api/v1/purchases' && $method === 'POST') {
        (new PurchaseController())->createPurchase();
    }

    // 8. Finance, Cashbook & Expenses
    elseif ($uri === '/api/v1/finance/cashbook' && $method === 'GET') {
        (new FinanceController())->getCashbook();
    } elseif ($uri === '/api/v1/finance/expenses' && $method === 'POST') {
        (new FinanceController())->recordExpense();
    }

    // 9. Private File Storage Vault
    elseif ($uri === '/api/v1/storage/upload' && $method === 'POST') {
        (new StorageController())->upload();
    } elseif ($uri === '/api/v1/storage/file' && $method === 'GET') {
        (new StorageController())->serve();
    }

    // 10. Automated Notifications, Centralized Config, Security & 1-Click Backup Downloads
    elseif ($uri === '/api/v1/system/send-email' && $method === 'POST') {
        (new SystemController())->sendEmail();
    } elseif ($uri === '/api/v1/system/config' && $method === 'GET') {
        (new SystemController())->getConfig();
    } elseif ($uri === '/api/v1/system/config' && $method === 'POST') {
        (new SystemController())->saveConfig();
    } elseif ($uri === '/api/v1/system/verify-passcode' && $method === 'POST') {
        (new SystemController())->verifyPasscode();
    } elseif ($uri === '/api/v1/system/prepare-backup' && $method === 'POST') {
        (new SystemController())->prepareBackup();
    } elseif ($uri === '/api/v1/system/download-backup' && $method === 'GET') {
        (new SystemController())->downloadBackup();
    } elseif ($uri === '/api/v1/system/sync-state' && $method === 'GET') {
        (new SystemController())->getSyncState();
    } elseif ($uri === '/api/v1/system/sync-state' && $method === 'POST') {
        (new SystemController())->saveSyncState();
    } elseif ($uri === '/api/v1/system/trigger-scheduled-backup' && ($method === 'GET' || $method === 'POST')) {
        (new SystemController())->triggerScheduledBackup();
    } elseif ($uri === '/api/v1/system/factory-reset' && $method === 'POST') {
        (new SystemController())->factoryReset();
    } elseif ($uri === '/api/v1/system/restore-backup-data' && $method === 'POST') {
        (new SystemController())->restoreBackupData();
    } elseif ($uri === '/api/v1/time' && $method === 'GET') {
        (new SyncController())->time();
    } elseif ($uri === '/api/v1/sync/push' && $method === 'POST') {
        (new SyncController())->push();
    } elseif ($uri === '/api/v1/sync/pull' && $method === 'GET') {
        (new SyncController())->pull();
    } elseif ($uri === '/api/v1/telemetry/events' && $method === 'POST') {
        (new TelemetryController())->ingestEvents();
    }

    // Unmatched Route Fallback
    else {
        Response::notFound("Endpoint '{$method} {$uri}' does not exist on CliniCore API.");
    }
} catch (\Throwable $e) {
    error_log("Unhandled API Error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
    Response::error(
        'INTERNAL_SERVER_ERROR',
        'An internal server error occurred while processing your request.',
        500,
        Env::get('APP_DEBUG') ? ['message' => $e->getMessage(), 'trace' => $e->getTraceAsString()] : null
    );
}
