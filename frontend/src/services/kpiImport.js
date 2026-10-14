const escapeCsv = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
export async function readKpiFile(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error('Tệp nhập mục tiêu tối đa 5 MB.');
  if (/\.csv$/i.test(file.name)) return file.text();
  if (/\.tsv$/i.test(file.name)) return (await file.text()).replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim()).map(line => line.split('\t').map(escapeCsv).join(',')).join('\n');
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Chọn CSV, TSV hoặc Excel XLSX. Với XLS cũ, hãy lưu lại thành XLSX.');
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets.find(s => s.rowCount > 0);
  if (!sheet) throw new Error('Tệp Excel không có dữ liệu.');
  if (sheet.rowCount > 501 || sheet.columnCount > 30) throw new Error('Bảng nhập tối đa 500 dòng dữ liệu và 30 cột.');
  const lines = [];
  sheet.eachRow(row => {
    const cells = [];
    for (let i = 1; i <= sheet.columnCount; i++) {
      const cell = row.getCell(i);
      cells.push(escapeCsv(cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : cell.text));
    }
    lines.push(cells.join(','));
  });
  const csv = lines.join('\n');
  if (csv.length > 500000) throw new Error('Nội dung sau chuyển đổi tối đa 500.000 ký tự.');
  return csv;
}
