/**
 * Database module for Gajraj Kirana Stores Billing Software
 * Uses better-sqlite3 for synchronous SQLite operations.
 * All tables: products, customers, invoices, invoice_items, settings, categories
 */

// Import removed to avoid native module load during build
// import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

/* ---------- Data Directory Resolution ---------- */
const APP_NAME = 'GajrajKirana';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function getDataDir(): string {
  // Allow explicit override via environment variable
  if (process.env.DATA_DIR) return process.env.DATA_DIR;

  // Development mode: use project root
  if (!IS_PRODUCTION) return process.cwd();

  // Production mode: use %LOCALAPPDATA%\GajrajKirana\
  const localAppData = process.env.LOCALAPPDATA
    || path.join(os.homedir(), 'AppData', 'Local');
  const dataDir = path.join(localAppData, APP_NAME);

  // Create directories on first run
  fs.mkdirSync(path.join(dataDir, 'backups'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'logs'), { recursive: true });

  return dataDir;
}

/** Resolved data directory — use this for all mutable file paths */
export const DATA_DIR = getDataDir();

/* ---------- Connection ---------- */
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'gajraj_store.db');

let db: any;
if (process.env.NEXT_PHASE === 'phase-production-build') {
  console.log('[DB] Skipping SQLite initialization during Next.js build');
  const dummy = () => ({ all: () => [], get: () => null, run: () => {} });
  db = { prepare: dummy, exec: () => {}, transaction: (cb: any) => cb, pragma: () => {} };
} else {
  const Database = require('better-sqlite3');
  db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  /* ---------- Schema ---------- */
  db.exec(`
  -- Product categories
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Dynamic Units
  CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Products / Inventory
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    brand TEXT DEFAULT '',
    article_no TEXT DEFAULT '',
    size TEXT DEFAULT '',
    color TEXT DEFAULT '',
    category TEXT DEFAULT '',
    hsn_code TEXT DEFAULT '',
    purchase_price REAL DEFAULT 0,
    selling_price REAL NOT NULL DEFAULT 0,
    quantity REAL DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    low_stock_alert REAL DEFAULT 10,
    gst_rate REAL DEFAULT 0,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Customers
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    gstin TEXT DEFAULT '',
    balance REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Invoices (bills)
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER,
    customer_name TEXT DEFAULT 'Walk-in Customer',
    customer_phone TEXT DEFAULT '',
    subtotal REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    gst_enabled INTEGER DEFAULT 0,
    gst_amount REAL DEFAULT 0,
    gst_rate REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    amount_paid REAL DEFAULT 0,
    payment_method TEXT DEFAULT 'cash',
    payment_status TEXT DEFAULT 'paid',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  -- Invoice line items
  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    brand TEXT DEFAULT '',
    article_no TEXT DEFAULT '',
    size TEXT DEFAULT '',
    color TEXT DEFAULT '',
    quantity REAL NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'pcs',
    price REAL NOT NULL DEFAULT 0,
    discount REAL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  -- Store settings (key-value)
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
  );

  -- Performance Indexes
  CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_invoices_customer_name ON invoices(customer_name);
  CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
  CREATE INDEX IF NOT EXISTS idx_products_quantity ON products(quantity);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
`);

/**
 * Perform automatic schema migrations so older imported databases 
 * get patched with new columns gracefully. 
 */
function ensureColumnExists(table: string, column: string, typeDef: string) {
  // PRAGMA table_info returns [{cid, name, type, notnull, dflt_value, pk}]
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  const exists = columns.some(c => c.name === column);
  if (!exists) {
    try {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDef}`).run();
      console.log(`[DB] Migrated schema: Added ${column} to ${table}`);
    } catch (err: any) {
      if (err.message && err.message.includes('duplicate column name')) {
        // Ignore duplicate column name errors caused by concurrent Next.js build workers
      } else {
        console.error(`[DB] Migration failed for ${table}.${column}:`, err);
        // Throwing the error here to make it visible in build logs, but maybe we shouldn't throw to not break build.
      }
    }
  }
}

if (process.env.NEXT_PHASE !== 'phase-production-build') {
  // Migrate Products table
  ensureColumnExists('products', 'category', "TEXT DEFAULT ''");
  ensureColumnExists('products', 'brand', "TEXT DEFAULT ''");
  ensureColumnExists('products', 'article_no', "TEXT DEFAULT ''");
  ensureColumnExists('products', 'size', "TEXT DEFAULT ''");
  ensureColumnExists('products', 'color', "TEXT DEFAULT ''");
  ensureColumnExists('products', 'hsn_code', "TEXT DEFAULT ''");
  ensureColumnExists('products', 'low_stock_alert', "REAL DEFAULT 10");
  ensureColumnExists('products', 'gst_rate', "REAL DEFAULT 0");
  ensureColumnExists('products', 'description', "TEXT DEFAULT ''");

  // Migrate Customers table
  ensureColumnExists('customers', 'gstin', "TEXT DEFAULT ''");
  ensureColumnExists('customers', 'balance', "REAL DEFAULT 0");
  ensureColumnExists('customers', 'gender', "TEXT DEFAULT 'Unspecified'");

  // Migrate Invoices table
  ensureColumnExists('invoices', 'gst_enabled', "INTEGER DEFAULT 0");
  ensureColumnExists('invoices', 'gst_amount', "REAL DEFAULT 0");
  ensureColumnExists('invoices', 'gst_rate', "REAL DEFAULT 0");
  ensureColumnExists('invoices', 'amount_paid', "REAL DEFAULT 0");
  ensureColumnExists('invoices', 'payment_method', "TEXT DEFAULT 'cash'");
  ensureColumnExists('invoices', 'payment_status', "TEXT DEFAULT 'paid'");
  ensureColumnExists('invoices', 'notes', "TEXT DEFAULT ''");

  // Migrate Invoice Items table
  ensureColumnExists('invoice_items', 'discount', "REAL DEFAULT 0");
  ensureColumnExists('invoice_items', 'brand', "TEXT DEFAULT ''");
  ensureColumnExists('invoice_items', 'article_no', "TEXT DEFAULT ''");
  ensureColumnExists('invoice_items', 'size', "TEXT DEFAULT ''");
  ensureColumnExists('invoice_items', 'color', "TEXT DEFAULT ''");

  /* ---------- Migrations ---------- */
  const migrations: string[] = [
    // Existing
    'ALTER TABLE invoices ADD COLUMN amount_paid REAL DEFAULT 0',

    // GST per-item columns on invoice_items
    'ALTER TABLE invoice_items ADD COLUMN hsn_code TEXT DEFAULT \'\'',
    'ALTER TABLE invoice_items ADD COLUMN gst_rate REAL DEFAULT 0',
    'ALTER TABLE invoice_items ADD COLUMN taxable_amount REAL DEFAULT 0',
    'ALTER TABLE invoice_items ADD COLUMN cgst_rate REAL DEFAULT 0',
    'ALTER TABLE invoice_items ADD COLUMN cgst_amount REAL DEFAULT 0',
    'ALTER TABLE invoice_items ADD COLUMN sgst_rate REAL DEFAULT 0',
    'ALTER TABLE invoice_items ADD COLUMN sgst_amount REAL DEFAULT 0',
    'ALTER TABLE invoice_items ADD COLUMN igst_rate REAL DEFAULT 0',
    'ALTER TABLE invoice_items ADD COLUMN igst_amount REAL DEFAULT 0',
    'ALTER TABLE invoice_items ADD COLUMN gst_inclusive INTEGER DEFAULT 0',

    // GST totals on invoices
    'ALTER TABLE invoices ADD COLUMN taxable_amount REAL DEFAULT 0',
    'ALTER TABLE invoices ADD COLUMN cgst_amount REAL DEFAULT 0',
    'ALTER TABLE invoices ADD COLUMN sgst_amount REAL DEFAULT 0',
    'ALTER TABLE invoices ADD COLUMN igst_amount REAL DEFAULT 0',
    'ALTER TABLE invoices ADD COLUMN is_igst INTEGER DEFAULT 0',
    'ALTER TABLE invoices ADD COLUMN round_off REAL DEFAULT 0',
    'ALTER TABLE invoices ADD COLUMN customer_gstin TEXT DEFAULT \'\'',
    'ALTER TABLE invoices ADD COLUMN customer_address TEXT DEFAULT \'\'',

    // Extra charges on invoice
    'ALTER TABLE invoices ADD COLUMN hamali REAL DEFAULT 0',
    'ALTER TABLE invoices ADD COLUMN market_cess REAL DEFAULT 0',
    'ALTER TABLE invoices ADD COLUMN other_exp REAL DEFAULT 0',

    // Weight in KG per bag/count item (optional, for dual BAG+KG display on invoice)
    'ALTER TABLE invoice_items ADD COLUMN weight_kg REAL DEFAULT 0',
  ];

  for (const sql of migrations) {
    try {
      db.exec(sql);
    } catch (error: any) {
      if (!error.message.includes('duplicate column name')) {
        console.error('Migration error:', error);
      }
    }
  }

  /* ---------- Seed default settings ---------- */
  const seedSettings = db.prepare(
    `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`
  );
  const defaultSettings: [string, string][] = [
    ['store_name', 'Footwear Store'],
    ['store_address', ''],
    ['store_phone', ''],
    ['store_email', ''],
    ['store_gstin', ''],
    ['store_state_code', '27'],
    ['app_language', 'en'],
    ['gmail_user', ''],
    ['gmail_app_password', ''],
    ['low_stock_email', ''],
    ['invoice_prefix', 'INV'],
    ['invoice_counter', '1'],
    ['invoice_theme', 'professional'],
    ['gst_inclusive', '0'],
    ['bank_name', ''],
    ['bank_account_no', ''],
    ['bank_branch', ''],
    ['bank_ifsc', ''],
    ['upi_id', ''],
    ['wa_channel_men', ''],
    ['wa_channel_women', ''],
    ['wa_message_template_en', 'Hello {{customer_name}},\n\nYour invoice #{{invoice_number}} for Rs. {{total_amount}} has been generated at {{store_name}}.\n\nThank you for shopping with us!'],
    ['wa_message_template_mr', 'नमस्कार {{customer_name}},\n\nतुमचे {{total_amount}} चे बिल {{store_name}} येथे तयार आहे.\nबिल क्रमांक: {{invoice_number}}\nतारीख: {{date}}\n\nभेट दिल्याबद्दल धन्यवाद!'],
  ];
  const seedTx = db.transaction(() => {
    for (const [k, v] of defaultSettings) seedSettings.run(k, v);
  });
  seedTx();

  /* ---------- Seed default categories ---------- */
  const seedCat = db.prepare(
    `INSERT OR IGNORE INTO categories (name) VALUES (?)`
  );
  const defaultCategories = [
    "Men's Formal", "Men's Casual", "Men's Sports", "Women's Formal", "Women's Casual", 'Kids', 'Sandals', 'Slippers', 'Accessories',
  ];
  const seedCatTx = db.transaction(() => {
    for (const c of defaultCategories) seedCat.run(c);
  });
  seedCatTx();

  /* ---------- Seed default units ---------- */
  const seedUnit = db.prepare(
    `INSERT OR IGNORE INTO units (name) VALUES (?)`
  );
  const defaultUnits = ['pair', 'pcs', 'box'];
  const seedUnitTx = db.transaction(() => {
    for (const u of defaultUnits) seedUnit.run(u);
  });
  seedUnitTx();
}
}

export default db;
