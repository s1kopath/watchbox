import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;

function getSecret() {
  if (!SECRET) {
    throw new Error('JWT_SECRET is not set');
  }
  return SECRET;
}

export function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: '30d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

export function getUserFromReq(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const token = Array.isArray(header) ? header[0] : header;
  const match = /^Bearer (.+)$/.exec(token || '');
  if (!match) return null;
  return verifyToken(match[1]);
}

export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
