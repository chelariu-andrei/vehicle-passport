package com.vehiclepassport.server.shared.config;

import io.smallrye.config.ConfigMapping;
import java.util.Optional;

/** Supabase Auth admin API, used only to delete a user at purge time. The key comes from the environment only. */
@ConfigMapping(prefix = "supabase.admin")
public interface SupabaseAdminConfig {

    String url();

    Optional<String> serviceRoleKey();
}
