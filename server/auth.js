/**
 * server/auth.js - Authentication & Security Subsystem
 * Implements HMAC-SHA256 JWT token generation, verification, and role-based access control (RBAC).
 */
const crypto = require('crypto');
const Database = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'OmniQuiz_PRO_Master_Secret_Key_2026_Secured';
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Base64 URL Encoder
 */
function base64UrlEncode(str) {
    return Buffer.from(str).toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

/**
 * Base64 URL Decoder
 */
function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return Buffer.from(str, 'base64').toString('utf8');
}

/**
 * Sign JWT Token
 */
function signToken(payload) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Date.now();
    const claims = {
        ...payload,
        iat: Math.floor(now / 1000),
        exp: Math.floor((now + TOKEN_EXPIRY_MS) / 1000)
    };

    const headerEncoded = base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = base64UrlEncode(JSON.stringify(claims));

    const signature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${headerEncoded}.${payloadEncoded}`)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

/**
 * Verify JWT Token
 */
function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerEncoded, payloadEncoded, signature] = parts;

    const expectedSignature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${headerEncoded}.${payloadEncoded}`)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return null;
    }

    try {
        const payload = JSON.parse(base64UrlDecode(payloadEncoded));
        const nowSec = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < nowSec) {
            return null; // Expired
        }
        return payload;
    } catch (e) {
        return null;
    }
}

/**
 * Express Middleware: Optional / Required Authentication
 */
function authenticate(required = false) {
    return (req, res, next) => {
        const authHeader = req.headers['authorization'] || req.headers['x-auth-token'];
        let token = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7).trim();
        } else if (authHeader) {
            token = authHeader.trim();
        }

        if (!token) {
            if (required) {
                return res.status(401).json({
                    success: false,
                    error: 'Yêu cầu đăng nhập để truy cập tài nguyên này!'
                });
            }
            req.user = null;
            return next();
        }

        const payload = verifyToken(token);
        if (!payload) {
            if (required) {
                return res.status(401).json({
                    success: false,
                    error: 'Phiên đăng nhập đã hết hạn hoặc token không hợp lệ!'
                });
            }
            req.user = null;
            return next();
        }

        // Fetch user from DB to ensure still active
        const user = Database.findUserById(payload.userId);
        if (!user) {
            if (required) {
                return res.status(401).json({
                    success: false,
                    error: 'Tài khoản không còn tồn tại trên hệ thống!'
                });
            }
            req.user = null;
            return next();
        }

        req.user = {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role
        };
        next();
    };
}

/**
 * Express Middleware: Role-based Authorization
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Vui lòng đăng nhập trước!'
            });
        }
        if (!roles.includes(req.user.role) && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: `Quyền truy cập bị từ chối! Yêu cầu vai trò: ${roles.join(' hoặc ')}.`
            });
        }
        next();
    };
}

module.exports = {
    signToken,
    verifyToken,
    authenticate,
    requireRole
};
