import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { hashPassword } from '../../utils/crypto.js';
import { withTransaction } from '../../utils/dbHelper.js';
import { ConflictError, ValidationError, AppError } from '../../utils/errors.js';

export const registrationSchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
  password: z.string().min(8).refine(v => Buffer.byteLength(v, 'utf8') <= 72),
}).strict();

export async function register(raw) {
  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError('Họ tên, email hoặc mật khẩu không hợp lệ. Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte.');
  const { email, fullName, password } = parsed.data;
  const passwordHash = await hashPassword(password);
  const suffix = randomBytes(16).toString('hex');
  try {
    return await withTransaction(async ({ query }) => {
      // Serialize public registrations for the same normalized address.
      await query(`DECLARE @lockResult int; EXEC @lockResult=sys.sp_getapplock @Resource=$1, @LockMode=N'Exclusive', @LockOwner=N'Transaction', @LockTimeout=10000; IF @lockResult < 0 THROW 51000, N'Registration lock unavailable', 1;`, [email]);
      const duplicate = await query('SELECT TOP (1) 1 FROM app.users WITH (UPDLOCK, HOLDLOCK) WHERE lower(email)=lower($1)', [email]);
      if (duplicate.rowCount) throw new ConflictError('Email đã được sử dụng.', 'EMAIL_IN_USE');
      const role = await query("SELECT role_id FROM app.roles WHERE code='LECTURER' AND is_active=1");
      if (!role.rowCount) throw new AppError('Không thể đăng ký vì vai trò giảng viên chưa được cấu hình.', 503, 'REGISTRATION_UNAVAILABLE');
      const created = await query(`INSERT INTO app.users (username,email,display_name,password_hash)
        OUTPUT INSERTED.user_id VALUES ($1,$2,$3,$4)`, [`self_${suffix}`, email, fullName, passwordHash]);
      const userId = created.rows[0].user_id;
      await query('INSERT INTO app.user_roles (user_id,role_id) VALUES ($1,$2)', [userId, role.rows[0].role_id]);
      // This is an internal temporary code, not a verified employee identity.
      await query('INSERT INTO app.lecturers (user_id,employee_code,full_name,email) VALUES ($1,$2,$3,$4)', [userId, `SELF_${suffix}`, fullName, email]);
      await query("INSERT INTO app.audit_logs (user_id,action,entity_name,entity_id,new_values) VALUES ($1,'AUTH_REGISTER','users',$1,$2)", [userId, JSON.stringify({ status: 'ACTIVE', source: 'SELF_REGISTRATION' })]);
      return { message: 'Đăng ký thành công. Bạn có thể đăng nhập bằng email. Liên hệ quản trị viên để được xác nhận thông tin và phân công đơn vị.' };
    });
  } catch (error) {
    if (error.code === '23505' || [2601,2627].includes(error.number)) throw new ConflictError('Email hoặc tài khoản đã được sử dụng.', 'REGISTRATION_CONFLICT');
    throw error;
  }
}
