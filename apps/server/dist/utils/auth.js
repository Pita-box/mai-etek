"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthenticatedUserFromAuthorizationHeader = getAuthenticatedUserFromAuthorizationHeader;
const db_1 = require("@maietek/db");
async function getAuthenticatedUserFromAuthorizationHeader(authorizationHeader) {
    if (!authorizationHeader) {
        return { user: null, error: 'No authorization header', status: 401 };
    }
    const token = authorizationHeader.replace('Bearer ', '').trim();
    if (!token) {
        return { user: null, error: 'Unauthorized', status: 401 };
    }
    const supabaseAdmin = (0, db_1.createAdminClient)();
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
        return { user: null, error: 'Unauthorized', status: 401 };
    }
    return {
        user: {
            id: user.id,
            user_metadata: user.user_metadata,
        },
        error: null,
        status: 200,
    };
}
