<?php
/**
 * Database Seed Script for CliniCore
 * Inserts mock data from 07_Mock_Data.json into MySQL tables.
 */

// Define absolute path to backend database config
require_once __DIR__ . '/../backend/src/config/db.php';

echo "Starting CliniCore Database Seeding...\n";

try {
    // 1. Initialize Database Connection
    $database = new Database();
    $db = $database->getConnection();
    
    if (!$db) {
        throw new Exception("Failed to get database connection.");
    }

    // 2. Load and Parse Mock Data JSON
    $mockDataPath = __DIR__ . '/../context/07_Mock_Data.json';
    if (!file_exists($mockDataPath)) {
        throw new Exception("Mock data file not found at: " . $mockDataPath);
    }

    $jsonContent = file_get_contents($mockDataPath);
    $data = json_decode($jsonContent, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Invalid JSON format in mock data: " . json_last_error_msg());
    }

    // Helper function to format ISO 8601 strings to MySQL DateTime format
    $toMysqlDateTime = function($isoString) {
        if (empty($isoString)) return null;
        $timestamp = strtotime($isoString);
        return $timestamp ? date('Y-m-d H:i:s', $timestamp) : null;
    };

    // Helper function to format simple dates (Y-m-d)
    $toMysqlDate = function($dateString) {
        if (empty($dateString)) return null;
        $timestamp = strtotime($dateString);
        return $timestamp ? date('Y-m-d', $timestamp) : null;
    };

    // 3. Disable Foreign Key Checks to avoid order-of-truncation issues
    echo "Disabling foreign key checks and clearing existing tables...\n";
    $db->exec("SET FOREIGN_KEY_CHECKS = 0");
    
    $tables = [
        'store_sales',
        'store_inventory',
        'prescription_items',
        'visits',
        'patients',
        'users',
        'clinics'
    ];
    
    foreach ($tables as $table) {
        $db->exec("TRUNCATE TABLE `$table`");
        echo "Truncated table: $table\n";
    }
    
    $db->exec("SET FOREIGN_KEY_CHECKS = 1");

    // 4. Seed Clinic
    if (isset($data['clinic'])) {
        echo "Seeding clinic...\n";
        $clinic = $data['clinic'];
        $stmt = $db->prepare("INSERT INTO clinics (id, name, logo_url, address, created_at) VALUES (:id, :name, :logo_url, :address, :created_at)");
        $stmt->execute([
            ':id' => $clinic['id'],
            ':name' => $clinic['name'],
            ':logo_url' => $clinic['logo_url'],
            ':address' => $clinic['address'],
            ':created_at' => $toMysqlDateTime($clinic['created_at'])
        ]);
        echo "Successfully seeded clinic: " . $clinic['name'] . "\n";
    }

    // 5. Seed Users
    if (isset($data['users']) && is_array($data['users'])) {
        echo "Seeding users...\n";
        $stmt = $db->prepare("INSERT INTO users (id, clinic_id, name, role, phone, email, password_hash) VALUES (:id, :clinic_id, :name, :role, :phone, :email, :password_hash)");
        
        // Generate a standard bcrypt password hash for mock users to log in
        // Default password: 'password'
        $defaultPasswordHash = password_hash('password', PASSWORD_BCRYPT);

        foreach ($data['users'] as $user) {
            $stmt->execute([
                ':id' => $user['id'],
                ':clinic_id' => $user['clinic_id'],
                ':name' => $user['name'],
                ':role' => $user['role'],
                ':phone' => $user['phone'] ?? null,
                ':email' => $user['email'] ?? null,
                ':password_hash' => $defaultPasswordHash
            ]);
            echo "Successfully seeded user: " . $user['name'] . " (Role: " . $user['role'] . ")\n";
        }
    }

    // 6. Seed Patients
    if (isset($data['patients']) && is_array($data['patients'])) {
        echo "Seeding patients...\n";
        $stmt = $db->prepare("INSERT INTO patients (id, clinic_id, full_name, phone, cnic, age, gender, created_at) VALUES (:id, :clinic_id, :full_name, :phone, :cnic, :age, :gender, :created_at)");

        foreach ($data['patients'] as $patient) {
            $stmt->execute([
                ':id' => $patient['id'],
                ':clinic_id' => $patient['clinic_id'],
                ':full_name' => $patient['full_name'],
                ':phone' => $patient['phone'],
                ':cnic' => !empty($patient['cnic']) ? $patient['cnic'] : null,
                ':age' => isset($patient['age']) ? intval($patient['age']) : null,
                ':gender' => !empty($patient['gender']) ? $patient['gender'] : null,
                ':created_at' => $toMysqlDateTime($patient['created_at'])
            ]);
            echo "Successfully seeded patient: " . $patient['full_name'] . "\n";
        }
    }

    // 7. Seed Visits
    if (isset($data['visits']) && is_array($data['visits'])) {
        echo "Seeding visits...\n";
        $stmt = $db->prepare("INSERT INTO visits (id, patient_id, clinic_id, visit_date, symptoms, diagnosis, fee_amount, follow_up_date, notes) VALUES (:id, :patient_id, :clinic_id, :visit_date, :symptoms, :diagnosis, :fee_amount, :follow_up_date, :notes)");

        foreach ($data['visits'] as $visit) {
            $stmt->execute([
                ':id' => $visit['id'],
                ':patient_id' => $visit['patient_id'],
                ':clinic_id' => $visit['clinic_id'],
                ':visit_date' => $toMysqlDateTime($visit['visit_date']),
                ':symptoms' => $visit['symptoms'] ?? null,
                ':diagnosis' => $visit['diagnosis'] ?? null,
                ':fee_amount' => isset($visit['fee_amount']) ? floatval($visit['fee_amount']) : 0.00,
                ':follow_up_date' => $toMysqlDate($visit['follow_up_date']),
                ':notes' => $visit['notes'] ?? null
            ]);
            echo "Successfully seeded visit: " . $visit['id'] . "\n";
        }
    }

    // 8. Seed Prescription Items
    if (isset($data['prescription_items']) && is_array($data['prescription_items'])) {
        echo "Seeding prescription items...\n";
        $stmt = $db->prepare("INSERT INTO prescription_items (id, visit_id, medicine_name, dosage, duration) VALUES (:id, :visit_id, :medicine_name, :dosage, :duration)");

        foreach ($data['prescription_items'] as $item) {
            $stmt->execute([
                ':id' => $item['id'],
                ':visit_id' => $item['visit_id'],
                ':medicine_name' => $item['medicine_name'],
                ':dosage' => $item['dosage'] ?? null,
                ':duration' => $item['duration'] ?? null
            ]);
            echo "Successfully seeded prescription item: " . $item['medicine_name'] . " for visit " . $item['visit_id'] . "\n";
        }
    }

    // 9. Seed Store Inventory
    if (isset($data['store_inventory']) && is_array($data['store_inventory'])) {
        echo "Seeding store inventory...\n";
        $stmt = $db->prepare("INSERT INTO store_inventory (id, clinic_id, medicine_name, stock_qty, unit_price, low_stock_threshold) VALUES (:id, :clinic_id, :medicine_name, :stock_qty, :unit_price, :low_stock_threshold)");

        foreach ($data['store_inventory'] as $inventory) {
            $stmt->execute([
                ':id' => $inventory['id'],
                ':clinic_id' => $inventory['clinic_id'],
                ':medicine_name' => $inventory['medicine_name'],
                ':stock_qty' => intval($inventory['stock_qty']),
                ':unit_price' => floatval($inventory['unit_price']),
                ':low_stock_threshold' => isset($inventory['low_stock_threshold']) ? intval($inventory['low_stock_threshold']) : 10
            ]);
            echo "Successfully seeded inventory item: " . $inventory['medicine_name'] . "\n";
        }
    }

    // 10. Seed Store Sales
    if (isset($data['store_sales']) && is_array($data['store_sales'])) {
        echo "Seeding store sales...\n";
        $stmt = $db->prepare("INSERT INTO store_sales (id, clinic_id, inventory_id, quantity_sold, sale_amount, sale_date, linked_visit_id) VALUES (:id, :clinic_id, :inventory_id, :quantity_sold, :sale_amount, :sale_date, :linked_visit_id)");

        foreach ($data['store_sales'] as $sale) {
            $stmt->execute([
                ':id' => $sale['id'],
                ':clinic_id' => $sale['clinic_id'],
                ':inventory_id' => $sale['inventory_id'],
                ':quantity_sold' => intval($sale['quantity_sold']),
                ':sale_amount' => floatval($sale['sale_amount']),
                ':sale_date' => $toMysqlDateTime($sale['sale_date']),
                ':linked_visit_id' => !empty($sale['linked_visit_id']) ? $sale['linked_visit_id'] : null
            ]);
            echo "Successfully seeded store sale: " . $sale['id'] . "\n";
        }
    }

    echo "CliniCore Database Seeding completed successfully!\n";

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
