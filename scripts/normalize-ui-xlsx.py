"""Normalize the XML namespace syntax for the app's ExcelJS input reader.

Workbooks are authored with artifact-tool. This only repackages equivalent
SpreadsheetML XML with its default namespace; it does not edit cells/styles.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from io import BytesIO
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
ET.register_namespace('', MAIN)
ET.register_namespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
for name in ['kpi-valid.xlsx', 'kpi-invalid.xlsx']:
    target = ROOT / 'docs/testing/kits/fixtures' / name
    source = BytesIO(target.read_bytes())
    result = BytesIO()
    with ZipFile(source) as original, ZipFile(result, 'w', ZIP_DEFLATED) as dest:
        for entry in original.infolist():
            content = original.read(entry.filename)
            if entry.filename.endswith('.xml'):
                element = ET.fromstring(content)
                if element.tag.startswith('{' + MAIN + '}'):
                    content = ET.tostring(element, encoding='utf-8', xml_declaration=True)
            dest.writestr(entry, content)
    target.write_bytes(result.getvalue())
    print('Normalized namespace syntax:', name)
