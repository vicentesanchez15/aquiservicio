const { createClient } = require("@supabase/supabase-js");

module.exports = function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
};
