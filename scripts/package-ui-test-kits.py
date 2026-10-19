"""Zip the prepared tester directories. No database/application access."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1] / 'output/ui-test-kits'
DELIVERY = Path(__file__).resolve().parents[1] / 'docs/testing/kits/packages'
DELIVERY.mkdir(parents=True, exist_ok=True)
for tester in [1, 2]:
    source = ROOT / f'tester-{tester}'
    manifest = json.loads((source / 'MANIFEST.json').read_text(encoding='utf-8'))
    for entry in manifest['files']:
        content = (source / entry['path']).read_bytes()
        assert len(content) == entry['bytes']
        assert hashlib.sha256(content).hexdigest() == entry['sha256']
    target = DELIVERY / f'tester-{tester}.zip'
    with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
        for file in sorted(source.rglob('*')):
            if file.is_file():
                archive.write(file, file.relative_to(source).as_posix())
    with ZipFile(target) as archive:
        assert archive.testzip() is None
        assert len(archive.namelist()) == len(manifest['files']) + 1
    print(f'tester-{tester}.zip: {len(manifest["cases"])} cases, {target.stat().st_size} bytes, ZIP verified')
