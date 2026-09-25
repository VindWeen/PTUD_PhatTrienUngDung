import bcrypt from 'bcryptjs';

/**
 * Băm mật khẩu bằng thuật toán bcrypt
 */
export async function hashPassword(plainTextPassword, saltRounds = 10) {
  return bcrypt.hash(plainTextPassword, saltRounds);
}

/**
 * Băm mật khẩu đồng bộ
 */
export function hashPasswordSync(plainTextPassword, saltRounds = 10) {
  return bcrypt.hashSync(plainTextPassword, saltRounds);
}

/**
 * So sánh mật khẩu dạng thô với mã băm
 */
export async function comparePassword(plainTextPassword, hashedPassword) {
  return bcrypt.compare(plainTextPassword, hashedPassword);
}

export { bcrypt };
export default { hashPassword, hashPasswordSync, comparePassword, bcrypt };
