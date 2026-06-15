const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'invoices', 'page.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const replacements = [
  // A4 Layout
  [/'TAX INVOICE'/g, "t('Tax Invoice').toUpperCase()"],
  [/'BILL OF SUPPLY'/g, "t('Bill of Supply').toUpperCase()"],
  [/Buyer :/g, "{t('Buyer')} :"],
  [/Invoice No/g, "{t('Invoice No.')}"],
  [/Invoice Date/g, "{t('Date')}"],
  [/Motor Vehicle No/g, "{t('Vehicle No.')}"],
  [/<td className="font-bold p-1 px-2 border-r border-black whitespace-nowrap">Time<\/td>/g, '<td className="font-bold p-1 px-2 border-r border-black whitespace-nowrap">{t(\'Time\')}</td>'],
  [/<td className="border border-black p-1 text-center" style={{ width: '25px' }}>SI<br\/>No<\/td>/g, '<td className="border border-black p-1 text-center" style={{ width: \'25px\' }}>{t(\'SI No\')}</td>'],
  [/<td className="border border-black p-1" style={{ width: '35%' }}>Particulars<br\/><span className="font-bold">\.<\/span><\/td>/g, '<td className="border border-black p-1" style={{ width: \'35%\' }}>{t(\'Particulars\')}</td>'],
  [/<td className="border border-black p-1 text-center" style={{ width: '55px' }}>HSN\/<br\/>SAC<\/td>/g, '<td className="border border-black p-1 text-center" style={{ width: \'55px\' }}>HSN/SAC</td>'],
  [/<td className="border border-black p-1 text-center" style={{ width: '30px' }}>GST<br\/>%<\/td>/g, '<td className="border border-black p-1 text-center" style={{ width: \'30px\' }}>GST %</td>'],
  [/<td className="border border-black p-1 text-center" style={{ width: '40px' }}>BAG<br\/><span className="font-bold">\.<\/span><\/td>/g, '<td className="border border-black p-1 text-center" style={{ width: \'40px\' }}>{t(\'BAG\')}</td>'],
  [/<td className="border border-black p-1 text-center" style={{ width: '65px' }}>KG<br\/><span className="font-bold">\.<\/span><\/td>/g, '<td className="border border-black p-1 text-center" style={{ width: \'65px\' }}>{t(\'KG\')}</td>'],
  [/<td className="border border-black p-1 text-center" style={{ width: '45px' }}>Tax<br\/>Incl<\/td>/g, '<td className="border border-black p-1 text-center" style={{ width: \'45px\' }}>{t(\'Tax Incl\')}</td>'],
  [/<td className="border border-black p-1 text-center" style={{ width: '50px' }}>Rate<br\/><span className="font-bold">\.<\/span><\/td>/g, '<td className="border border-black p-1 text-center" style={{ width: \'50px\' }}>{t(\'Rate\')}</td>'],
  [/<td className="border border-black p-1 text-right" style={{ width: '80px' }}>Net<br\/>Value<\/td>/g, '<td className="border border-black p-1 text-right" style={{ width: \'80px\' }}>{t(\'Net Value\')}</td>'],
  [/<td className="border border-black p-1">Total :<\/td>/g, '<td className="border border-black p-1">{t(\'Total\')} :</td>'],
  [/<td className="p-1 border-r border-black text-right" style={{ width: '15%' }}>Taxable Value<\/td>/g, '<td className="p-1 border-r border-black text-right" style={{ width: \'15%\' }}>{t(\'Taxable Value\')}</td>'],
  [/<td className="p-1 border-r border-black text-center" colSpan={2}>Central Tax<\/td>/g, '<td className="p-1 border-r border-black text-center" colSpan={2}>{t(\'Central Tax\')}</td>'],
  [/<td className="p-1 border-r border-black text-center" colSpan={2}>State Tax<\/td>/g, '<td className="p-1 border-r border-black text-center" colSpan={2}>{t(\'State Tax\')}</td>'],
  [/<td className="p-1 border-r border-black text-center" colSpan={2}>Integrated Tax<\/td>/g, '<td className="p-1 border-r border-black text-center" colSpan={2}>{t(\'Integrated Tax\')}</td>'],
  [/<td className="p-1 text-right" style={{ width: '15%' }}>Total Tax<\/td>/g, '<td className="p-1 text-right" style={{ width: \'15%\' }}>{t(\'Total Tax\')}</td>'],
  [/<td className="p-0.5 border-r border-black text-center" style={{ width: '8%' }}>Rate<\/td>/g, '<td className="p-0.5 border-r border-black text-center" style={{ width: \'8%\' }}>{t(\'Rate\')}</td>'],
  [/<td className="p-0.5 border-r border-black text-right" style={{ width: '12%' }}>Amount<\/td>/g, '<td className="p-0.5 border-r border-black text-right" style={{ width: \'12%\' }}>{t(\'Amount\')}</td>'],
  [/<td className="p-0.5 border-r border-black text-center" style={{ width: '10%' }}>Rate<\/td>/g, '<td className="p-0.5 border-r border-black text-center" style={{ width: \'10%\' }}>{t(\'Rate\')}</td>'],
  [/<td className="p-0.5 border-r border-black text-right" style={{ width: '20%' }}>Amount<\/td>/g, '<td className="p-0.5 border-r border-black text-right" style={{ width: \'20%\' }}>{t(\'Amount\')}</td>'],
  [/<td className="font-bold border-r border-black">Total :<\/td>/g, '<td className="font-bold border-r border-black">{t(\'Total\')} :</td>'],
  [/<td colSpan={4} className="font-bold border-r border-black p-1 align-top">[\s\S]*?<\/td>/g, '<td colSpan={4} className="font-bold border-r border-black p-1 align-top">\n                                {t(\'Amount in Words\')} :<br/>\n                                {amountInWords(selectedInvoice?.total_amount || 0, language)}\n                              </td>'],

  // Amount in words fix (A4 Layout)
  [/Invoice Amount In Words :/g, "{t('Amount in Words')} :"],
  [/amountInWords\(selectedInvoice\?.total_amount\)/g, "amountInWords(selectedInvoice?.total_amount || 0, language)"],
  [/\{selectedInvoice \? amountInWords\(selectedInvoice\.total_amount\) : ''\}/g, "{selectedInvoice ? amountInWords(selectedInvoice.total_amount, language) : ''}"],
  [/<p>\{selectedInvoice \? amountInWords\(selectedInvoice\.total_amount\) : ''\}<\/p>/g, "<p>{selectedInvoice ? amountInWords(selectedInvoice.total_amount, language) : ''}</p>"],

  // Thermal layout
  [/<th className="text-left font-bold pb-1 w-2\/5">Item<\/th>/g, '<th className="text-left font-bold pb-1 w-2/5">{t(\'Item\')}</th>'],
  [/<th className="text-center font-bold pb-1 w-1\/5">Qty<\/th>/g, '<th className="text-center font-bold pb-1 w-1/5">{t(\'Qty\')}</th>'],
  [/<th className="text-right font-bold pb-1 w-1\/5">Rate<\/th>/g, '<th className="text-right font-bold pb-1 w-1/5">{t(\'Rate\')}</th>'],
  [/<th className="text-right font-bold pb-1 w-1\/5">Amt<\/th>/g, '<th className="text-right font-bold pb-1 w-1/5">{t(\'Amt\')}</th>'],
  [/<span>Sub Total<\/span>/g, '<span>{t(\'Sub Total\')}</span>'],
  [/<span>\(\-\) Discount<\/span>/g, '<span>(-) {t(\'Discount\')}</span>'],
  [/<p>Thank you for visiting!<\/p>/g, '<p>{t(\'Thank you for visiting!\')}</p>'],
];

replacements.forEach(([pattern, replacement]) => {
  code = code.replace(pattern, replacement);
});

fs.writeFileSync(filePath, code);
console.log('Translations injected successfully.');
