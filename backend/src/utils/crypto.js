import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

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

/**
 * Tạo chuỗi ngẫu nhiên an toàn cho Refresh Token (64 bytes hex)
 */
export function generateRefreshTokenString() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Băm token bằng thuật toán SHA-256 trước khi lưu vào DB
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Ký Access Token JWT
 */
export function generateAccessToken(payload, expiresIn = config.JWT_ACCESS_EXPIRES_IN) {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, { expiresIn });
}

/**
 * Xác thực Access Token JWT
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, config.JWT_ACCESS_SECRET);
}

export { bcrypt, jwt, crypto };
export default {
  hashPassword,
  hashPasswordSync,
  comparePassword,
  generateRefreshTokenString,
  hashToken,
  generateAccessToken,
  verifyAccessToken,
  bcrypt,
  jwt,
  crypto,
};
