import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Authenticate user from request
 * @param {Request} req - The request object
 * @returns {Promise<Object>} - The authenticated user object
 * @throws {Object} - Error object with status and error message
 */
export async function authenticate(req) {
    const authHeader = req.headers.get('authorization');
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        throw { status: 401, error: 'Access token required' };
    }

    try {
        const user = jwt.verify(token, JWT_SECRET);
        return user;
    } catch (error) {
        throw { status: 403, error: 'Invalid or expired token' };
    }
}

/**
 * Generate JWT token for user
 * @param {Object} payload - Token payload
 * @param {string} expiresIn - Token expiration time (default: '30d')
 * @returns {string} - JWT token
 */
export function generateToken(payload, expiresIn = '30d') {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} - Decoded token payload
 * @throws {Error} - If token is invalid
 */
export function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}
