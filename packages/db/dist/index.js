"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabaseClient = exports.createAdminClient = exports.createStandardClient = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const createStandardClient = () => {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
    return (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey);
};
exports.createStandardClient = createStandardClient;
const createAdminClient = () => {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    return (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};
exports.createAdminClient = createAdminClient;
const getSupabaseClient = () => (0, exports.createStandardClient)();
exports.getSupabaseClient = getSupabaseClient;
