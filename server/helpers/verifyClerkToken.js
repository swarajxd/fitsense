// server/helpers/verifyClerkToken.js
// Uses @clerk/clerk-sdk-node to verify an incoming Clerk token.
// If you are using a different Clerk package or different env var name, adjust accordingly.

const { Clerk } = require('@clerk/clerk-sdk-node');

const clerk = new Clerk({ apiKey: process.env.CLERK_API_KEY });

/*
  verifyClerkToken(req)
  - DEV fallback: returns x-clerk-user-id header when NODE_ENV !== 'production'
  - PROD: expects Authorization: Bearer <Clerk JWT> and verifies with Clerk SDK
  - Returns clerkUserId (string) or throws Error on failure
*/
async function verifyClerkToken(req) {
  // Dev shortcut: accept header (keep for local testing only)
  if (process.env.NODE_ENV !== 'production' && req.headers['x-clerk-user-id']) {
    return req.headers['x-clerk-user-id'];
  }

  // Expect Authorization header
  const auth = req.headers.authorization;
  if (!auth) throw new Error('Missing Authorization header');

  const token = auth.split(' ')[1];
  if (!token) throw new Error('Malformed Authorization header');

  // Clerk Node SDK verification: verify token/session and return user id.
  // NOTE: API shape varies by clerk SDK version. The approach below uses Clerk server SDK methods.
  // If your installed version exposes different helpers, adapt by calling the appropriate verify method.
  try {
    // verify session/token - this method name may vary by Clerk SDK version; check your version's docs
    const sessionInfo = await clerk.sessions.verifySession(token);

    // sessionInfo should contain the user id (subject). Common keys: userId, sub, etc.
    const userId = sessionInfo?.userId || sessionInfo?.sub || sessionInfo?.user_id;
    if (!userId) throw new Error('Could not determine user id from Clerk session');
    return userId;
  } catch (err) {
    // Re-throw a clearer error for the proxy's error handling
    throw new Error(`Clerk verification failed: ${err.message || err}`);
  }
}

module.exports = verifyClerkToken;
