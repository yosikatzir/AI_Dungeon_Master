/**
 * The one account with admin privileges. Admin status is derived from the
 * username at request time — there is no separate role column to drift out
 * of sync.
 */
export const ADMIN_USERNAME = "yosikatzir";
