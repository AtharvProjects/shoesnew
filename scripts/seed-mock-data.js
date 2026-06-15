const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'gajraj_store.db');
const db = new Database(dbPath);

console.log('Seeding mock data for Footwear software...');

try {
  db.exec('BEGIN TRANSACTION');

  // Insert Mock Products
  const insertProduct = db.prepare(`
    INSERT INTO products (
      name, sku, brand, article_no, size, color, category, hsn_code,
      purchase_price, selling_price, quantity, unit, low_stock_alert, gst_rate, description
    ) VALUES (
      @name, @sku, @brand, @article_no, @size, @color, @category, @hsn_code,
      @purchase_price, @selling_price, @quantity, @unit, @low_stock_alert, @gst_rate, @description
    )
  `);

  const mockProducts = [
    {
      name: 'Nike Air Zoom Pegasus', sku: 'NK-PEG-39-9', brand: 'Nike', article_no: 'PEG39', size: '9 UK', color: 'Black/White', category: "Men's Sports", hsn_code: '6404', purchase_price: 6500, selling_price: 9995, quantity: 24, unit: 'pair', low_stock_alert: 5, gst_rate: 18, description: 'Running shoes'
    },
    {
      name: 'Puma Smash v2 L', sku: 'PM-SMV2-8', brand: 'Puma', article_no: 'SMV2', size: '8 UK', color: 'White', category: "Men's Casual", hsn_code: '6404', purchase_price: 2100, selling_price: 3499, quantity: 12, unit: 'pair', low_stock_alert: 3, gst_rate: 18, description: 'Classic leather sneakers'
    },
    {
      name: 'Adidas Lite Racer 2.0', sku: 'AD-LR2-10', brand: 'Adidas', article_no: 'LR20', size: '10 UK', color: 'Navy Blue', category: "Men's Sports", hsn_code: '6404', purchase_price: 1800, selling_price: 2999, quantity: 8, unit: 'pair', low_stock_alert: 2, gst_rate: 18, description: 'Lightweight running shoes'
    },
    {
      name: 'Bata Comfit Slip-On', sku: 'BT-CMFT-7', brand: 'Bata', article_no: 'COMF12', size: '7 UK', color: 'Brown', category: "Men's Formal", hsn_code: '6403', purchase_price: 900, selling_price: 1499, quantity: 15, unit: 'pair', low_stock_alert: 5, gst_rate: 12, description: 'Comfortable formal slip-ons'
    },
    {
      name: 'Woodland Camel Boots', sku: 'WL-CB-9', brand: 'Woodland', article_no: 'GC04', size: '9 UK', color: 'Camel', category: "Men's Casual", hsn_code: '6403', purchase_price: 3200, selling_price: 4995, quantity: 6, unit: 'pair', low_stock_alert: 2, gst_rate: 18, description: 'Rugged outdoor boots'
    },
    {
      name: 'Crocs Classic Clog', sku: 'CR-CLG-8', brand: 'Crocs', article_no: 'CLS01', size: 'M8/W10', color: 'Navy', category: 'Sandals', hsn_code: '6402', purchase_price: 1500, selling_price: 2495, quantity: 30, unit: 'pair', low_stock_alert: 10, gst_rate: 18, description: 'Classic comfortable clogs'
    },
    {
      name: 'Paragon Vertex Sandals', sku: 'PR-VTX-9', brand: 'Paragon', article_no: 'VTX88', size: '9 UK', color: 'Black', category: 'Sandals', hsn_code: '6402', purchase_price: 300, selling_price: 499, quantity: 50, unit: 'pair', low_stock_alert: 15, gst_rate: 5, description: "Daily wear men's sandals"
    },
    {
      name: 'Metro Women embellished Heels', sku: 'MT-HLS-6', brand: 'Metro', article_no: 'MTH09', size: '6 UK', color: 'Rose Gold', category: "Women's Formal", hsn_code: '6403', purchase_price: 1400, selling_price: 2290, quantity: 10, unit: 'pair', low_stock_alert: 3, gst_rate: 12, description: 'Party wear heels'
    },
    {
      name: 'Skechers GOwalk Joy', sku: 'SK-GWJ-5', brand: 'Skechers', article_no: 'GWJ22', size: '5 UK', color: 'Grey', category: "Women's Casual", hsn_code: '6404', purchase_price: 2800, selling_price: 4499, quantity: 18, unit: 'pair', low_stock_alert: 4, gst_rate: 18, description: 'Comfortable walking shoes'
    },
    {
      name: 'Campus Kids Velcro Sneakers', sku: 'CM-KDS-12', brand: 'Campus', article_no: 'KID01', size: '12 UK Kids', color: 'Red/Blue', category: 'Kids', hsn_code: '6404', purchase_price: 550, selling_price: 899, quantity: 20, unit: 'pair', low_stock_alert: 5, gst_rate: 12, description: 'Easy wear for kids'
    }
  ];

  for (const product of mockProducts) {
    insertProduct.run(product);
  }
  console.log('Inserted 10 mock products.');

  // Insert Mock Customers
  const insertCustomer = db.prepare(`
    INSERT INTO customers (name, phone, gstin, address) VALUES (@name, @phone, @gstin, @address)
  `);

  const mockCustomers = [
    { name: 'Rahul Sharma', phone: '9876543210', gstin: '', address: 'Andheri West, Mumbai' },
    { name: 'Sneha Patel', phone: '9123456789', gstin: '', address: 'Navrangpura, Ahmedabad' },
    { name: 'Ramesh Trading Co.', phone: '9988776655', gstin: '27AADCB2230M1Z2', address: 'Dadar East, Mumbai' },
    { name: 'Vikram Singh', phone: '9898989898', gstin: '', address: 'Koramangala, Bengaluru' }
  ];

  for (const customer of mockCustomers) {
    insertCustomer.run(customer);
  }
  console.log('Inserted 4 mock customers.');

  db.exec('COMMIT');
  console.log('Seeding completed successfully!');
} catch (error) {
  db.exec('ROLLBACK');
  console.error('Error seeding data:', error);
}
