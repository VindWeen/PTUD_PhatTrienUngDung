import fs from 'node:fs';
import {connectDB,getDbPoolConfig} from '../../backend/src/config/database.js';
if(getDbPoolConfig().database!=='PTUD_LHU_Demo')throw new Error('Demo only');
const p=await connectDB();
try{
 const users=(await p.query('SELECT user_id,username,display_name,status FROM app.users ORDER BY username')).rows;
 const roles=(await p.query('SELECT ur.user_id,r.code FROM app.user_roles ur JOIN app.roles r ON r.role_id=ur.role_id WHERE ur.revoked_at IS NULL')).rows;
 const scopes=(await p.query('SELECT s.user_id,u.name,s.include_descendants FROM app.user_unit_scopes s JOIN app.organization_units u ON u.unit_id=s.unit_id WHERE s.revoked_at IS NULL')).rows;
 const lecturers=(await p.query('SELECT l.user_id,u.name FROM app.lecturers l JOIN app.lecturer_assignments a ON a.lecturer_id=l.lecturer_id JOIN app.organization_units u ON u.unit_id=a.unit_id WHERE a.is_primary=1 AND (a.valid_to IS NULL OR a.valid_to>SYSUTCDATETIME())')).rows;
 const reps=(await p.query('SELECT r.user_id,u.name,r.valid_to FROM app.unit_representatives r JOIN app.organization_units u ON u.unit_id=r.unit_id WHERE r.revoked_at IS NULL')).rows;
 const label={LECTURER:'Giảng viên',MANAGER:'Quản lý',ADMIN:'Quản trị',COUNCIL:'Hội đồng',RECORDS_OFFICER:'Chuyên viên',UNIT_REPRESENTATIVE:'Đại diện'};
 const rows=users.map(u=>{const ids=r=>String(r.user_id)===String(u.user_id);const detail=[...lecturers.filter(ids).map(r=>'Công tác: '+r.name),...scopes.filter(ids).map(r=>'Phạm vi: '+r.name+(r.include_descendants?' và đơn vị con':'')),...reps.filter(ids).map(r=>'Đại diện: '+r.name+(r.valid_to&&new Date(r.valid_to)<new Date()?' (đã hết hạn)':''))].join('; ');return `| ${u.username} | ${u.display_name} | ${roles.filter(ids).map(r=>label[r.code]||r.code).join(', ')} | ${detail||'Quản trị hệ thống'} | ${u.status} |`;});
 fs.writeFileSync('docs/RICH_DEMO_ACCOUNTS.md','# Tài khoản của bộ demo mở rộng\n\nXuất từ PTUD_LHU_Demo ngày 12/11/2026. Tất cả là tài khoản trình diễn. Mật khẩu web chung **demo1234**; `locked.demo` cố ý bị khóa. Các tài khoản cũ giữ đơn vị và quyền có sẵn. Không dùng danh sách này như danh bạ nhân sự thật.\n\n| Đăng nhập | Tên hiển thị | Vai trò | Đơn vị và phạm vi | Trạng thái |\n|---|---|---|---|---|\n'+rows.join('\n')+'\n\n[Hướng dẫn chọn tình huống](RICH_DEMO_DATA.md) · [Kịch bản 9 phút](DEMO_9_PHUT.md)\n');
 console.log('Wrote '+users.length+' demo accounts; no hashes or SQL credentials exported.');
}finally{await p.end();}
