import { jwt, crypto, hashPassword } from '../../utils/crypto.js';
import config from '../../config/env.js';
import { query, withTransaction } from '../../utils/dbHelper.js';
import { updatePassword, revokeAllUserTokens } from './authRepository.js';
import { AppError, ValidationError } from '../../utils/errors.js';

const secret = () => crypto.createHmac('sha256', config.JWT_REFRESH_SECRET).update('password-reset-v1').digest('hex');
export function makeResetToken(user) {
  return jwt.sign({ sub: String(user.user_id), version: String(user.version), email: user.email, purpose: 'password-reset' }, secret(), { expiresIn: '30m', jwtid: crypto.randomUUID() });
}
export function readResetToken(token) {
  try {
    const payload = jwt.verify(token, secret(), { algorithms: ['HS256'] });
    if (payload.purpose !== 'password-reset' || !/^\d+$/.test(payload.sub) || !/^\d+$/.test(payload.version) || typeof payload.email !== 'string') throw new Error();
    return payload;
  } catch { throw new ValidationError('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'); }
}
function mailConfig() {
  const { RESET_EMAIL_API_KEY, RESET_EMAIL_FROM, APP_PUBLIC_URL } = config;
  let url;
  try { url = new URL(APP_PUBLIC_URL); } catch { throw new AppError('Dịch vụ khôi phục mật khẩu chưa được cấu hình.', 503, 'RESET_UNAVAILABLE'); }
  if (!RESET_EMAIL_API_KEY || !RESET_EMAIL_FROM || (config.NODE_ENV === 'production' && config.JWT_REFRESH_SECRET === 'ptud_lhu_super_secret_refresh_key_2026_dev_only') || !['https:', ...(config.NODE_ENV === 'production' ? [] : ['http:'])].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new AppError('Dịch vụ khôi phục mật khẩu chưa được cấu hình.', 503, 'RESET_UNAVAILABLE');
  return { key: RESET_EMAIL_API_KEY, from: RESET_EMAIL_FROM, url };
}
export async function requestPasswordReset(email) {
  const mail = mailConfig();
  const result = await query('SELECT TOP (2) user_id, email, version FROM app.users WHERE lower(email)=lower($1) AND status=\'ACTIVE\'', [email]);
  if (result.rows.length === 1) {
    const user = result.rows[0];
    const link = new URL('reset-password', mail.url.href.endsWith('/') ? mail.url : `${mail.url.href}/`);
    link.hash = new URLSearchParams({ token: makeResetToken(user) }).toString();
    try {
      const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${mail.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: mail.from, to: [user.email], subject: 'Đặt lại mật khẩu', text: `Dùng liên kết sau trong 30 phút để đặt lại mật khẩu: ${link.href}\nNếu bạn không yêu cầu, hãy bỏ qua email này.` }), signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('mail delivery failed');
    } catch { console.error('Không thể gửi email khôi phục mật khẩu.'); }
  }
}
export async function resetPassword(token, password) {
  const payload = readResetToken(token);
  const hash = await hashPassword(password);
  await withTransaction(async ({ client }) => {
    const result = await query('SELECT email, version, status FROM app.users WITH (UPDLOCK, HOLDLOCK) WHERE user_id=$1', [payload.sub], client);
    const user = result.rows[0];
    if (!user || user.status !== 'ACTIVE' || String(user.version) !== payload.version || user.email !== payload.email) throw new ValidationError('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    await updatePassword(payload.sub, hash, client);
    await revokeAllUserTokens(payload.sub, client);
  });
}
