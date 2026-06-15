const jsPDF = require('jspdf');
console.log('jsPDF:', typeof jsPDF);
console.log('jsPDF.jsPDF:', typeof jsPDF.jsPDF);
const doc = new (jsPDF.jsPDF || jsPDF.default || jsPDF)();
try {
  const autoTable = require('jspdf-autotable');
  console.log('autoTable:', typeof autoTable);
  console.log('autoTable.default:', typeof autoTable.default);
  const fn = autoTable.default || autoTable;
  fn(doc, { head: [['A']], body: [['B']] });
  console.log('autoTable successful');
} catch (e) {
  console.error('autoTable failed:', e);
}
