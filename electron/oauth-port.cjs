/** Fixed port for packaged app HTTP origin (Google OAuth "Authorized JavaScript origins"). */
const OAUTH_LOCAL_PORT =
  Number(process.env.NOTE_APP_OAUTH_PORT) || 53463

module.exports = { OAUTH_LOCAL_PORT }
