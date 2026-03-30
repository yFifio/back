import jwt from 'jsonwebtoken';
export const authAdminMiddleware = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token)
        return res.status(401).json({ error: 'Token não fornecido' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        req.userId = decoded.id;
        req.isAdmin = Boolean(decoded.isAdmin);
        if (!req.isAdmin)
            return res.status(403).json({ error: 'Acesso negado' });
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
};
