"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.register = void 0;
const zod_1 = require("zod");
const db_1 = require("@maietek/db");
const authSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
const register = async (req, res) => {
    try {
        const parsed = authSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.format() });
        }
        const { email, password } = parsed.data;
        const adminAuthClient = (0, db_1.createAdminClient)();
        const { data, error } = await adminAuthClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(201).json({ message: 'User registered successfully', user: data.user });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = authSchema.parse(req.body);
        const standardSupabase = (0, db_1.getSupabaseClient)();
        const { data, error } = await standardSupabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) {
            return res.status(401).json({ error: error.message });
        }
        res.status(200).json({ session: data.session, user: data.user });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.login = login;
