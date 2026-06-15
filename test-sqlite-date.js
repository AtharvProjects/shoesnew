const db = require('better-sqlite3')('c:/Users/ashitosh/.gemini/antigravity-ide/scratch/Footwear_Billing_Software-main/billing.db');
console.log(db.prepare("SELECT date('2026-06-14T09:32:00.000Z', 'localtime') as d").get());
console.log(db.prepare("SELECT date('2026-06-14 09:32:00', 'localtime') as d2").get());
